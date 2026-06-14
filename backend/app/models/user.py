from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))

    provider_id: Mapped[int | None] = mapped_column(ForeignKey("providers.id"))
    # learner_id is set only for role == learner (self-service accounts).
    learner_id: Mapped[int | None] = mapped_column(ForeignKey("learners.id"))
    # site_id scopes a mentor to their primary site; null for other roles.
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"))

    provider = relationship("Provider")
    learner = relationship("Learner", foreign_keys=[learner_id])
    site = relationship("Site", foreign_keys=[site_id])
