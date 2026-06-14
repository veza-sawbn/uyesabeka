"""Sites and programmes — provider-scoped reads, admin-only writes.

These power the site/programme selectors in the learner and attendance filters.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, is_cross_provider, require_roles, scope_provider
from app.models import Programme, Site, User
from app.models.enums import Role
from app.schemas.org import ProgrammeOut, SiteCreate, SiteOut

router = APIRouter(prefix="/api/v1", tags=["sites"])


@router.get("/sites", response_model=list[SiteOut])
def list_sites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = scope_provider(select(Site), user, Site.provider_id)
    if user.role == Role.MENTOR and user.site_id:
        stmt = stmt.where(Site.id == user.site_id)
    return db.scalars(stmt.order_by(Site.name)).all()


@router.post("/sites", response_model=SiteOut, status_code=status.HTTP_201_CREATED)
def create_site(
    payload: SiteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.PROVIDER_ADMIN)),
):
    provider_id = payload.provider_id if is_cross_provider(user) else user.provider_id
    if provider_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "provider_id is required")
    site = Site(
        provider_id=provider_id,
        name=payload.name,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        geofence_radius_meters=payload.geofence_radius_meters,
    )
    db.add(site)
    db.commit()
    db.refresh(site)
    return site


@router.get("/programmes", response_model=list[ProgrammeOut])
def list_programmes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    stmt = scope_provider(select(Programme), user, Programme.provider_id)
    return db.scalars(stmt.order_by(Programme.name)).all()
