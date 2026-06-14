"""Password hashing and JWT helpers.

Passwords support a transparent SHA-256 -> bcrypt migration: legacy accounts
were stored as unsalted hex SHA-256. On first successful login the verified
password is re-hashed with bcrypt and persisted, so the legacy scheme drains
away without forcing a reset.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import settings

# bcrypt is the target scheme; hex_sha256 is accepted but deprecated, which is
# what drives verify_and_update to hand back a fresh bcrypt hash on login.
pwd_context = CryptContext(
    schemes=["bcrypt", "hex_sha256"],
    deprecated=["hex_sha256"],
    bcrypt__rounds=12,
)

ACCESS = "access"
REFRESH = "refresh"


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except ValueError:
        return False


def verify_and_migrate(plain: str, hashed: str) -> tuple[bool, str | None]:
    """Return (is_valid, new_hash). new_hash is set only when the stored hash
    used a deprecated scheme and should be replaced with the bcrypt version."""
    try:
        return pwd_context.verify_and_update(plain, hashed)
    except ValueError:
        return False, None


def _create_token(
    subject: str | int, token_type: str, expires_delta: timedelta, **claims: Any
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        **claims,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(subject: str | int, **claims: Any) -> str:
    return _create_token(
        subject,
        ACCESS,
        timedelta(hours=settings.access_token_expire_hours),
        **claims,
    )


def create_refresh_token(subject: str | int, **claims: Any) -> str:
    return _create_token(
        subject,
        REFRESH,
        timedelta(days=settings.refresh_token_expire_days),
        **claims,
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT. Raises jwt.PyJWTError on any problem."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
