"""Attendance: list/filter, geofenced check-in (with signature upload to
Supabase), check-out, verification, and bulk verify.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles, scope_provider
from app.models import AttendanceRecord, Learner, User
from app.models.enums import (
    AttendanceStatus,
    GeofenceResult,
    LearnerStatus,
    Role,
    VerificationStatus,
)
from app.schemas.attendance import (
    AttendanceOut,
    AttendanceUpdate,
    BulkVerifyRequest,
    CheckInRequest,
    CheckOutRequest,
)
from app.schemas.common import Page
from app.serializers import attendance_out
from app.services import storage
from app.services.geofence import evaluate

router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])

_LOADED = (selectinload(AttendanceRecord.learner), selectinload(AttendanceRecord.site))


def _base_scoped(user: User):
    """SELECT over attendance joined to learner, narrowed by role/provider."""
    stmt = select(AttendanceRecord).join(Learner, AttendanceRecord.learner_id == Learner.id).options(*_LOADED)
    stmt = scope_provider(stmt, user, Learner.provider_id)
    if user.role == Role.LEARNER:
        stmt = stmt.where(AttendanceRecord.learner_id == user.learner_id)
    elif user.role == Role.MENTOR and user.site_id:
        stmt = stmt.where(AttendanceRecord.site_id == user.site_id)
    return stmt


@router.get("", response_model=Page[AttendanceOut])
def list_attendance(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    learner_id: int | None = None,
    site_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    verification_status: str | None = None,
    geofence_result: str | None = None,
):
    stmt = _base_scoped(user)
    if learner_id:
        stmt = stmt.where(AttendanceRecord.learner_id == learner_id)
    if site_id:
        stmt = stmt.where(AttendanceRecord.site_id == site_id)
    if date_from:
        stmt = stmt.where(AttendanceRecord.attendance_date >= date_from)
    if date_to:
        stmt = stmt.where(AttendanceRecord.attendance_date <= date_to)
    if verification_status:
        stmt = stmt.where(AttendanceRecord.verification_status == verification_status)
    if geofence_result:
        stmt = stmt.where(AttendanceRecord.geofence_result == geofence_result)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.check_in_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page.build([attendance_out(r) for r in rows], total, page, page_size)


@router.post("/check-in", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
def check_in(
    payload: CheckInRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MENTOR, Role.PROVIDER_ADMIN, Role.LEARNER)),
):
    learner_id = user.learner_id if user.role == Role.LEARNER else payload.learner_id
    learner = db.scalar(
        select(Learner).options(selectinload(Learner.site)).where(Learner.id == learner_id)
    )
    if learner is None or learner.status == LearnerStatus.DELETED:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Learner not found")
    if user.role not in Role.CROSS_PROVIDER and learner.provider_id != user.provider_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Learner outside your provider")
    if learner.site is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Learner has no assigned site")

    today = date.today()
    existing = db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.learner_id == learner.id,
            AttendanceRecord.attendance_date == today,
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already checked in today")

    geofence_result, distance = evaluate(
        payload.latitude,
        payload.longitude,
        learner.site.latitude,
        learner.site.longitude,
        learner.site.geofence_radius_meters,
    )
    if geofence_result == GeofenceResult.OUTSIDE and not payload.override:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Outside geofence ({distance:.0f}m from site). Override required.",
        )

    attendance_status = (
        AttendanceStatus.OVERRIDE if geofence_result == GeofenceResult.OUTSIDE else AttendanceStatus.PRESENT
    )

    object_path = None
    signature_url = None
    if payload.signature_data:
        object_path = storage.upload_base64_image(
            payload.signature_data, folder=f"signatures/{learner.id}", filename=today.isoformat()
        )
        signature_url = storage.generate_signed_url(object_path)

    record = AttendanceRecord(
        learner_id=learner.id,
        site_id=learner.site_id,
        attendance_date=today,
        check_in_time=datetime.now(timezone.utc),
        check_in_latitude=payload.latitude,
        check_in_longitude=payload.longitude,
        geofence_result=geofence_result,
        distance_from_site_meters=distance,
        attendance_status=attendance_status,
        verification_status=VerificationStatus.PENDING,
        signature_url=signature_url,
        signature_object_path=object_path,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return attendance_out(record)


@router.post("/check-out", response_model=AttendanceOut)
def check_out(
    payload: CheckOutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MENTOR, Role.PROVIDER_ADMIN, Role.LEARNER)),
):
    record = db.scalar(_base_scoped(user).where(AttendanceRecord.id == payload.attendance_id))
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attendance record not found")
    if record.check_out_time is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already checked out")

    record.check_out_time = datetime.now(timezone.utc)
    if record.attendance_status == AttendanceStatus.PRESENT:
        record.attendance_status = AttendanceStatus.COMPLETED
    db.commit()
    db.refresh(record)
    return attendance_out(record)


@router.patch("/{record_id}", response_model=AttendanceOut)
def update_attendance(
    record_id: int,
    payload: AttendanceUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_VERIFIER, Role.PROVIDER_ADMIN)),
):
    record = db.scalar(_base_scoped(user).where(AttendanceRecord.id == record_id))
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attendance record not found")
    if payload.verification_status is not None:
        record.verification_status = payload.verification_status
    if payload.attendance_status is not None:
        record.attendance_status = payload.attendance_status
    db.commit()
    db.refresh(record)
    return attendance_out(record)


@router.post("/bulk-verify")
def bulk_verify(
    payload: BulkVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_VERIFIER, Role.PROVIDER_ADMIN)),
):
    if not payload.ids:
        return {"updated": 0}
    records = db.scalars(
        _base_scoped(user).where(AttendanceRecord.id.in_(payload.ids))
    ).all()
    for record in records:
        record.verification_status = payload.verification_status
    db.commit()
    return {"updated": len(records)}
