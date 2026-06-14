from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Provider(Base, TimestampMixin):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_number: Mapped[str | None] = mapped_column(String(100))
    contact_email: Mapped[str | None] = mapped_column(String(255))

    sites = relationship("Site", back_populates="provider", cascade="all, delete-orphan")
    programmes = relationship(
        "Programme", back_populates="provider", cascade="all, delete-orphan"
    )
    learners = relationship("Learner", back_populates="provider")
