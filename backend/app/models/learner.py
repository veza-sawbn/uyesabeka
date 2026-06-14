from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin
from app.models.enums import LearnerStatus, VerificationStatus


class Learner(Base, TimestampMixin):
    __tablename__ = "learners"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id"), index=True)
    programme_id: Mapped[int | None] = mapped_column(ForeignKey("programmes.id"))

    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # South African 13-digit ID number.
    id_number: Mapped[str] = mapped_column(String(13), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))

    status: Mapped[str] = mapped_column(String(20), default=LearnerStatus.ACTIVE, nullable=False)
    stipend_rate_per_day: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    bank_details_status: Mapped[str] = mapped_column(
        String(20), default=VerificationStatus.PENDING, nullable=False
    )

    provider = relationship("Provider", back_populates="learners")
    site = relationship("Site", back_populates="learners", foreign_keys=[site_id])
    programme = relationship("Programme", back_populates="learners")
    bank_details = relationship(
        "BankDetails",
        back_populates="learner",
        uselist=False,
        cascade="all, delete-orphan",
    )
    attendance_records = relationship("AttendanceRecord", back_populates="learner")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
