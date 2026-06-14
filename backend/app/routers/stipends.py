"""Stipends: monthly summary, payable preview, batch run, and bank CSV export.

A batch run snapshots verified attendance into immutable line items; the CSV is
the file a payroll officer submits to the bank (POPIA: ID numbers masked).
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles, scope_provider
from app.models import BankDetails, Learner, StipendBatch, StipendLineItem, User
from app.models.enums import BatchStatus, PaymentStatus, Role
from app.routers.dashboard import _period_bounds
from app.schemas.stipend import (
    BatchRunRequest,
    StipendBatchOut,
    StipendLineOut,
    StipendPreview,
    StipendPreviewLine,
    StipendSummary,
)
from app.services import stipend_calc

router = APIRouter(prefix="/api/v1/stipends", tags=["stipends"])


def _require_provider(user: User, override: int | None = None) -> int:
    provider_id = override if (override and user.role in Role.CROSS_PROVIDER) else user.provider_id
    if provider_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provider_id is required")
    return provider_id


def _batch_out(batch: StipendBatch) -> StipendBatchOut:
    items = [
        StipendLineOut(
            id=li.id,
            learner_id=li.learner_id,
            learner_name=li.learner.full_name if li.learner else None,
            verified_days=li.verified_days,
            daily_rate=float(li.daily_rate),
            total_amount=float(li.total_amount),
            payment_status=li.payment_status,
        )
        for li in batch.line_items
    ]
    return StipendBatchOut(
        id=batch.id,
        provider_id=batch.provider_id,
        period_start=batch.period_start,
        period_end=batch.period_end,
        total_learners=batch.total_learners,
        total_days=batch.total_days,
        total_amount_rand=float(batch.total_amount_rand),
        status=batch.status,
        initiated_by=batch.initiated_by,
        line_items=items,
    )


@router.get("/summary", response_model=StipendSummary)
def summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    provider_id: int | None = None,
):
    pid = _require_provider(user, provider_id)
    period_start, period_end = _period_bounds(date.today())
    lines = stipend_calc.compute_lines(db, pid, period_start, period_end)
    totals = stipend_calc.summarise(lines)

    latest = db.scalar(
        select(StipendBatch)
        .where(
            StipendBatch.provider_id == pid,
            StipendBatch.period_start == period_start,
        )
        .order_by(StipendBatch.created_at.desc())
    )
    return StipendSummary(
        period_start=period_start,
        period_end=period_end,
        total_learners=totals["total_learners"],
        total_verified_days=totals["total_days"],
        total_amount_rand=totals["total_amount_rand"],
        current_batch_status=latest.status if latest else None,
    )


@router.get("/preview", response_model=StipendPreview)
def preview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    period_start: date | None = None,
    period_end: date | None = None,
    provider_id: int | None = None,
):
    pid = _require_provider(user, provider_id)
    if not (period_start and period_end):
        period_start, period_end = _period_bounds(date.today())
    lines = stipend_calc.compute_lines(db, pid, period_start, period_end)
    totals = stipend_calc.summarise(lines)
    return StipendPreview(
        period_start=period_start,
        period_end=period_end,
        total_learners=totals["total_learners"],
        total_days=totals["total_days"],
        total_amount_rand=totals["total_amount_rand"],
        lines=[StipendPreviewLine(**line) for line in lines],
    )


@router.get("", response_model=list[StipendBatchOut])
def list_batches(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = select(StipendBatch).options(
        selectinload(StipendBatch.line_items).selectinload(StipendLineItem.learner)
    )
    stmt = scope_provider(stmt, user, StipendBatch.provider_id)
    batches = db.scalars(stmt.order_by(StipendBatch.created_at.desc())).all()
    return [_batch_out(b) for b in batches]


@router.post("/run", response_model=StipendBatchOut, status_code=status.HTTP_201_CREATED)
def run_batch(
    payload: BatchRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_PAYROLL, Role.PROVIDER_ADMIN)),
    provider_id: int | None = None,
):
    pid = _require_provider(user, provider_id)
    period_start = payload.period_start
    period_end = payload.period_end
    if not (period_start and period_end):
        period_start, period_end = _period_bounds(date.today())

    lines = stipend_calc.compute_lines(db, pid, period_start, period_end)
    totals = stipend_calc.summarise(lines)

    batch = StipendBatch(
        provider_id=pid,
        period_start=period_start,
        period_end=period_end,
        total_learners=totals["total_learners"],
        total_days=totals["total_days"],
        total_amount_rand=totals["total_amount_rand"],
        status=BatchStatus.DRAFT,
        initiated_by=user.id,
        line_items=[
            StipendLineItem(
                learner_id=line["learner_id"],
                verified_days=line["verified_days"],
                daily_rate=line["daily_rate"],
                total_amount=line["total_amount"],
                payment_status=PaymentStatus.PENDING,
            )
            for line in lines
        ],
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return _batch_out(batch)


def _get_scoped_batch(db: Session, user: User, batch_id: int) -> StipendBatch:
    stmt = (
        select(StipendBatch)
        .options(selectinload(StipendBatch.line_items).selectinload(StipendLineItem.learner))
        .where(StipendBatch.id == batch_id)
    )
    stmt = scope_provider(stmt, user, StipendBatch.provider_id)
    batch = db.scalar(stmt)
    if batch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Batch not found")
    return batch


@router.get("/{batch_id}", response_model=StipendBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _batch_out(_get_scoped_batch(db, user, batch_id))


@router.post("/{batch_id}/confirm", response_model=StipendBatchOut)
def confirm_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_PAYROLL, Role.PROVIDER_ADMIN)),
):
    batch = _get_scoped_batch(db, user, batch_id)
    batch.status = BatchStatus.CONFIRMED
    db.commit()
    db.refresh(batch)
    return _batch_out(batch)


@router.post("/{batch_id}/pay", response_model=StipendBatchOut)
def pay_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_PAYROLL, Role.PROVIDER_ADMIN)),
):
    batch = _get_scoped_batch(db, user, batch_id)
    batch.status = BatchStatus.PAID
    for li in batch.line_items:
        li.payment_status = PaymentStatus.PAID
    db.commit()
    db.refresh(batch)
    return _batch_out(batch)


@router.get("/{batch_id}/export.csv")
def export_batch_csv(
    batch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_PAYROLL, Role.PROVIDER_ADMIN)),
):
    batch = _get_scoped_batch(db, user, batch_id)
    learner_ids = [li.learner_id for li in batch.line_items]
    bank_rows: dict[int, dict] = {}
    if learner_ids:
        records = db.scalars(
            select(Learner)
            .options(selectinload(Learner.bank_details))
            .where(Learner.id.in_(learner_ids))
        ).all()
        for learner in records:
            bank = learner.bank_details
            bank_rows[learner.id] = {
                "account_holder": bank.account_holder if bank else "",
                "bank_name": bank.bank_name if bank else "",
                "account_number": bank.account_number if bank else "",
                "branch_code": bank.branch_code if bank else "",
            }

    lines = [
        {
            "learner_id": li.learner_id,
            "learner_name": li.learner.full_name if li.learner else "",
            "id_number": li.learner.id_number if li.learner else "",
            "verified_days": li.verified_days,
            "daily_rate": float(li.daily_rate),
            "total_amount": float(li.total_amount),
        }
        for li in batch.line_items
    ]
    csv_text = stipend_calc.build_bank_csv(lines, bank_rows)
    filename = f"stipend_batch_{batch.id}_{batch.period_start.isoformat()}.csv"
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
