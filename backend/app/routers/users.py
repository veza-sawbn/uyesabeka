"""User administration — super_admin only (spec §1.1 Admin module)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import User
from app.models.enums import Role
from app.schemas.admin import UserAdminOut, UserCreate, UserUpdate
from app.security import hash_password

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _validate_role(role: str) -> None:
    if role not in Role.ALL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown role: {role}")


@router.get("", response_model=list[UserAdminOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_roles(Role.SUPER_ADMIN))):
    return db.scalars(select(User).order_by(User.username)).all()


@router.post("", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    _validate_role(payload.role)
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    user = User(
        username=payload.username,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        provider_id=payload.provider_id,
        site_id=payload.site_id,
        learner_id=payload.learner_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    data = payload.model_dump(exclude_unset=True)
    if "role" in data and data["role"] is not None:
        _validate_role(data["role"])
    password = data.pop("password", None)
    if password:
        user.hashed_password = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: User = Depends(require_roles(Role.SUPER_ADMIN)),
):
    if user_id == current.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}
