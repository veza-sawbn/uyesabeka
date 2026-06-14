"""Authentication: login (with transparent SHA-256 -> bcrypt migration),
token refresh, current-user, logout. Tokens are returned in the JSON body
(consumed by the Next.js layer) and also set as httpOnly cookies for direct
API/Swagger use.
"""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.security import (
    REFRESH,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_and_migrate,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _claims(user: User) -> dict:
    return {
        "role": user.role,
        "provider_id": user.provider_id,
        "learner_id": user.learner_id,
        "site_id": user.site_id,
    }


def _set_cookie(response: Response, key: str, value: str, max_age: int) -> None:
    response.set_cookie(
        key=key,
        value=value,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    ok, new_hash = verify_and_migrate(payload.password, user.hashed_password)
    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    # Transparent migration: persist the upgraded bcrypt hash on first login.
    if new_hash:
        user.hashed_password = new_hash
        db.commit()

    access = create_access_token(user.id, **_claims(user))
    refresh = create_refresh_token(user.id)
    _set_cookie(response, "access_token", access, settings.access_token_expire_hours * 3600)
    _set_cookie(response, "refresh_token", refresh, settings.refresh_token_expire_days * 86400)

    return TokenResponse(access_token=access, refresh_token=refresh, user=UserOut.model_validate(user))


@router.post("/refresh")
def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing refresh token")
    try:
        payload = decode_token(refresh_token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token") from exc
    if payload.get("type") != REFRESH:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")

    access = create_access_token(user.id, **_claims(user))
    _set_cookie(response, "access_token", access, settings.access_token_expire_hours * 3600)
    return {"access_token": access, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"detail": "Logged out"}
