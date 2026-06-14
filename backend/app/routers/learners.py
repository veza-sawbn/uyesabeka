"""Learner CRUD, status changes, bank details, and POPIA data export.

Every query is provider-scoped through `scope_provider`; learner-role users are
further narrowed to their own record.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, is_cross_provider, require_roles, scope_provider
from app.models import BankDetails, Learner, User
from app.models.enums import LearnerStatus, Role
from app.schemas.common import Page
from app.schemas.learner import (
    BankDetailsUpdate,
    LearnerCreate,
    LearnerDetailOut,
    LearnerOut,
    LearnerStatusUpdate,
    LearnerUpdate,
)
from app.serializers import learner_detail_out, learner_out
from app.services.popia import mask_id_number

router = APIRouter(prefix="/api/v1/learners", tags=["learners"])

_LOADED = (selectinload(Learner.site), selectinload(Learner.programme), selectinload(Learner.bank_details))


def _get_scoped(db: Session, user: User, learner_id: int) -> Learner:
    stmt = select(Learner).options(*_LOADED).where(Learner.id == learner_id)
    stmt = scope_provider(stmt, user, Learner.provider_id)
    if user.role == Role.LEARNER:
        stmt = stmt.where(Learner.id == user.learner_id)
    learner = db.scalar(stmt)
    if learner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Learner not found")
    return learner


@router.get("", response_model=Page[LearnerOut])
def list_learners(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    site_id: int | None = None,
    programme_id: int | None = None,
    search: str | None = None,
    include_deleted: bool = False,
):
    stmt = select(Learner).options(*_LOADED)
    stmt = scope_provider(stmt, user, Learner.provider_id)
    if user.role == Role.LEARNER:
        stmt = stmt.where(Learner.id == user.learner_id)

    if not include_deleted:
        stmt = stmt.where(Learner.status != LearnerStatus.DELETED)
    if status_filter:
        stmt = stmt.where(Learner.status == status_filter)
    if site_id:
        stmt = stmt.where(Learner.site_id == site_id)
    if programme_id:
        stmt = stmt.where(Learner.programme_id == programme_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Learner.first_name.ilike(like),
                Learner.last_name.ilike(like),
                Learner.id_number.ilike(like),
            )
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Learner.last_name, Learner.first_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return Page.build([learner_out(r) for r in rows], total, page, page_size)


@router.post("", response_model=LearnerDetailOut, status_code=status.HTTP_201_CREATED)
def create_learner(
    payload: LearnerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    provider_id = payload.provider_id if is_cross_provider(user) else user.provider_id
    if provider_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provider_id is required")

    learner = Learner(
        provider_id=provider_id,
        site_id=payload.site_id,
        programme_id=payload.programme_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        id_number=payload.id_number,
        email=payload.email,
        phone=payload.phone,
        status=payload.status,
        stipend_rate_per_day=payload.stipend_rate_per_day,
    )
    learner.bank_details = BankDetails(account_holder=f"{payload.first_name} {payload.last_name}")
    db.add(learner)
    db.commit()
    db.refresh(learner)
    return learner_detail_out(learner)


@router.get("/{learner_id}", response_model=LearnerDetailOut)
def get_learner(
    learner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return learner_detail_out(_get_scoped(db, user, learner_id))


@router.put("/{learner_id}", response_model=LearnerDetailOut)
def update_learner(
    learner_id: int,
    payload: LearnerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    learner = _get_scoped(db, user, learner_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(learner, field, value)
    db.commit()
    db.refresh(learner)
    return learner_detail_out(learner)


@router.patch("/{learner_id}/status", response_model=LearnerOut)
def update_status(
    learner_id: int,
    payload: LearnerStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    learner = _get_scoped(db, user, learner_id)
    learner.status = payload.status
    db.commit()
    db.refresh(learner)
    return learner_out(learner)


@router.put("/{learner_id}/bank-details", response_model=LearnerDetailOut)
def update_bank_details(
    learner_id: int,
    payload: BankDetailsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    learner = _get_scoped(db, user, learner_id)
    bank = learner.bank_details or BankDetails(learner_id=learner.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(bank, field, value)
    learner.bank_details = bank
    if payload.verification_status:
        learner.bank_details_status = payload.verification_status
    db.commit()
    db.refresh(learner)
    return learner_detail_out(learner)


@router.delete("/{learner_id}", status_code=status.HTTP_200_OK)
def soft_delete_learner(
    learner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    learner = _get_scoped(db, user, learner_id)
    learner.status = LearnerStatus.DELETED
    db.commit()
    return {"detail": "Learner deleted"}


@router.get("/{learner_id}/export")
def export_learner(
    learner_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """POPIA data-subject access export. ID number is masked in the payload."""
    learner = _get_scoped(db, user, learner_id)
    detail = learner_detail_out(learner).model_dump()
    detail["id_number"] = mask_id_number(learner.id_number)
    return detail
