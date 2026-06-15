"""Providers — cross-provider roles only (super_admin, auditor)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import Provider, User
from app.models.enums import Role
from app.schemas.org import ProviderCreate, ProviderOut

router = APIRouter(prefix="/api/v1/providers", tags=["providers"])


@router.get("", response_model=list[ProviderOut])
def list_providers(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.AUDITOR)),
):
    return db.scalars(select(Provider).order_by(Provider.name)).all()


@router.post("", response_model=ProviderOut, status_code=status.HTTP_201_CREATED)
def create_provider(
    payload: ProviderCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    provider = Provider(
        name=payload.name,
        registration_number=payload.registration_number,
        contact_email=payload.contact_email,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider
