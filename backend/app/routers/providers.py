"""Providers — cross-provider roles only (super_admin, auditor)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import Provider, User
from app.models.enums import Role
from app.schemas.org import ProviderOut

router = APIRouter(prefix="/api/v1/providers", tags=["providers"])


@router.get("", response_model=list[ProviderOut])
def list_providers(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.AUDITOR)),
):
    return db.scalars(select(Provider).order_by(Provider.name)).all()
