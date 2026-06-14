"""Dashboard aggregates: stat cards, live site rail (60s cache), attendance
heatmap, and the alert feed.
"""

from __future__ import annotations

import calendar
import time
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Select, distinct, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import AttendanceRecord, Learner, Site, User
from app.models.enums import LearnerStatus, Role, VerificationStatus
from app.schemas.dashboard import Alert, DashboardStats, HeatmapDay, SiteHeadcount
from app.services import stipend_calc

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])

# Site-rail cache (spec §4.2: refresh every 60s, no WebSockets for MVP).
_SITES_TTL = 60
_sites_cache: dict[str, tuple[float, list[dict]]] = {}


def _learner_scope(user: User) -> Select:
    stmt = select(Learner).where(Learner.status != LearnerStatus.DELETED)
    if user.role not in Role.CROSS_PROVIDER:
        stmt = stmt.where(Learner.provider_id == user.provider_id)
    if user.role == Role.MENTOR and user.site_id:
        stmt = stmt.where(Learner.site_id == user.site_id)
    return stmt


def _attendance_scope(user: User) -> Select:
    stmt = select(AttendanceRecord).join(Learner, AttendanceRecord.learner_id == Learner.id)
    if user.role not in Role.CROSS_PROVIDER:
        stmt = stmt.where(Learner.provider_id == user.provider_id)
    if user.role == Role.MENTOR and user.site_id:
        stmt = stmt.where(AttendanceRecord.site_id == user.site_id)
    return stmt


def _ratio_status(ratio: float) -> str:
    if ratio >= 0.7:
        return "ok"
    if ratio >= 0.4:
        return "warn"
    return "crit"


def _period_bounds(today: date) -> tuple[date, date]:
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.replace(day=1), today.replace(day=last_day)


@router.get("/stats", response_model=DashboardStats)
def stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    total_learners = db.scalar(select(func.count()).select_from(_learner_scope(user).subquery())) or 0

    # Distinct learners present today, counted over the AttendanceRecord⋈Learner
    # FROM so the aggregate column lives in the query's FROM (no cartesian product).
    checked_in_stmt = (
        select(func.count(distinct(AttendanceRecord.learner_id)))
        .select_from(AttendanceRecord)
        .join(Learner, AttendanceRecord.learner_id == Learner.id)
        .where(AttendanceRecord.attendance_date == today)
    )
    if user.role not in Role.CROSS_PROVIDER:
        checked_in_stmt = checked_in_stmt.where(Learner.provider_id == user.provider_id)
    if user.role == Role.MENTOR and user.site_id:
        checked_in_stmt = checked_in_stmt.where(AttendanceRecord.site_id == user.site_id)
    checked_in_today = db.scalar(checked_in_stmt) or 0
    pending = (
        db.scalar(
            select(func.count()).select_from(
                _attendance_scope(user)
                .where(AttendanceRecord.verification_status == VerificationStatus.PENDING)
                .subquery()
            )
        )
        or 0
    )

    # Arrears: verified days this month not yet covered by a paid batch.
    period_start, period_end = _period_bounds(today)
    arrears_days = 0
    arrears_rand = 0.0
    if user.provider_id and user.role not in Role.CROSS_PROVIDER:
        lines = stipend_calc.compute_lines(db, user.provider_id, period_start, period_end)
        summary = stipend_calc.summarise(lines)
        arrears_days = summary["total_days"]
        arrears_rand = summary["total_amount_rand"]

    return DashboardStats(
        total_learners=total_learners,
        checked_in_today=checked_in_today,
        pending_verification=pending,
        stipend_arrears_days=arrears_days,
        stipend_arrears_rand=arrears_rand,
    )


@router.get("/sites", response_model=list[SiteHeadcount])
def sites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cache_key = "all" if user.role in Role.CROSS_PROVIDER else f"p{user.provider_id}:s{user.site_id}"
    now = time.monotonic()
    cached = _sites_cache.get(cache_key)
    if cached and now - cached[0] < _SITES_TTL:
        return [SiteHeadcount(**row) for row in cached[1]]

    today = date.today()
    site_stmt = select(Site)
    if user.role not in Role.CROSS_PROVIDER:
        site_stmt = site_stmt.where(Site.provider_id == user.provider_id)
    if user.role == Role.MENTOR and user.site_id:
        site_stmt = site_stmt.where(Site.id == user.site_id)
    site_rows = db.scalars(site_stmt.order_by(Site.name)).all()

    result: list[dict] = []
    for site in site_rows:
        total = (
            db.scalar(
                select(func.count())
                .select_from(Learner)
                .where(Learner.site_id == site.id, Learner.status == LearnerStatus.ACTIVE)
            )
            or 0
        )
        current = (
            db.scalar(
                select(func.count(distinct(AttendanceRecord.learner_id))).where(
                    AttendanceRecord.site_id == site.id,
                    AttendanceRecord.attendance_date == today,
                )
            )
            or 0
        )
        ratio = (current / total) if total else 0.0
        result.append(
            {
                "id": site.id,
                "name": site.name,
                "current": current,
                "total": total,
                "ratio": round(ratio, 3),
                "status": _ratio_status(ratio),
            }
        )

    _sites_cache[cache_key] = (now, result)
    return [SiteHeadcount(**row) for row in result]


@router.get("/heatmap", response_model=list[HeatmapDay])
def heatmap(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total_learners = db.scalar(select(func.count()).select_from(_learner_scope(user).subquery())) or 0
    days_in_month = calendar.monthrange(year, month)[1]

    # Per-day distinct present learners for the month.
    counts_stmt = (
        _attendance_scope(user)
        .where(
            func.extract("year", AttendanceRecord.attendance_date) == year,
            func.extract("month", AttendanceRecord.attendance_date) == month,
        )
        .with_only_columns(
            AttendanceRecord.attendance_date,
            func.count(distinct(AttendanceRecord.learner_id)),
        )
        .group_by(AttendanceRecord.attendance_date)
    )
    counts = {row[0]: row[1] for row in db.execute(counts_stmt).all()}

    out: list[HeatmapDay] = []
    for day in range(1, days_in_month + 1):
        d = date(year, month, day)
        count = int(counts.get(d, 0))
        ratio = (count / total_learners) if total_learners else 0.0
        if d.weekday() >= 5:  # Sat/Sun
            intensity = "weekend"
        elif ratio >= 0.9:
            intensity = "full"
        elif ratio >= 0.75:
            intensity = "good"
        elif ratio >= 0.5:
            intensity = "moderate"
        else:
            intensity = "low"
        out.append(HeatmapDay(date=d, count=count, total=total_learners, intensity=intensity))
    return out


@router.get("/alerts", response_model=list[Alert])
def alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    out: list[Alert] = []

    # Critical: sites critically low today.
    for site in sites(db=db, user=user):
        if site.total and site.status == "crit":
            out.append(
                Alert(
                    severity="critical",
                    message=f"{site.name} attendance critically low ({site.current}/{site.total})",
                    site_id=site.id,
                )
            )

    # Warning: records awaiting verification.
    pending = (
        db.scalar(
            select(func.count()).select_from(
                _attendance_scope(user)
                .where(AttendanceRecord.verification_status == VerificationStatus.PENDING)
                .subquery()
            )
        )
        or 0
    )
    if pending:
        out.append(Alert(severity="warning", message=f"{pending} attendance records awaiting verification"))

    # Warning: suspended learners.
    suspended = (
        db.scalar(
            select(func.count()).select_from(
                _learner_scope(user).where(Learner.status == LearnerStatus.SUSPENDED).subquery()
            )
        )
        or 0
    )
    if suspended:
        out.append(Alert(severity="warning", message=f"{suspended} learners suspended — stipend at risk"))

    # Info: learners with unverified bank details.
    bank_pending = (
        db.scalar(
            select(func.count()).select_from(
                _learner_scope(user)
                .where(Learner.bank_details_status == VerificationStatus.PENDING)
                .subquery()
            )
        )
        or 0
    )
    if bank_pending:
        out.append(Alert(severity="info", message=f"{bank_pending} learners have unverified bank details"))

    return out
