"""FastAPI dependencies: authentication, role guards, and provider scoping.

Provider scoping (spec §6.5) is enforced here, never trusted from the client:
every learner / attendance / stipend query is filtered by the caller's
provider_id, except for the cross-provider roles (super_admin, auditor).
"""

from __future__ import annotations

import logging

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import Select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.models.enums import Role
from app.security import ACCESS, decode_token

logger = logging.getLogger("tasap.audit")

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


def _extract_token(authorization: str | None, cookie_token: str | None) -> str:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    if cookie_token:
        return cookie_token
    raise _CREDENTIALS_EXC


def get_current_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from a Bearer header or access_token cookie."""
    token = _extract_token(authorization, access_token)
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:  # expired / invalid signature / malformed
        raise _CREDENTIALS_EXC from exc

    if payload.get("type") != ACCESS:
        raise _CREDENTIALS_EXC

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id else None
    if user is None:
        raise _CREDENTIALS_EXC

    # POPIA §10.3: log all data access performed by auditor-role users.
    if user.role == Role.AUDITOR:
        logger.info("auditor_access user_id=%s username=%s", user.id, user.username)
    return user


def require_roles(*roles: str):
    """Dependency factory: 403 unless the caller holds one of `roles`.

    super_admin is implicitly allowed everywhere.
    """
    allowed = set(roles) | {Role.SUPER_ADMIN}

    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _guard


def scope_provider(stmt: Select, user: User, provider_col) -> Select:
    """Filter a SELECT to the caller's provider unless they are cross-provider.

    `provider_col` is the provider_id column for the primary table being queried
    (e.g. Learner.provider_id, Site.provider_id).
    """
    if user.role in Role.CROSS_PROVIDER:
        return stmt
    return stmt.where(provider_col == user.provider_id)


def is_cross_provider(user: User) -> bool:
    return user.role in Role.CROSS_PROVIDER


def is_provider_writer(user: User) -> bool:
    return user.role in Role.PROVIDER_WRITERS
