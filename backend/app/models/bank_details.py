from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin
from app.models.enums import VerificationStatus


class BankDetails(Base, TimestampMixin):
    __tablename__ = "bank_details"

    id: Mapped[int] = mapped_column(primary_key=True)
    learner_id: Mapped[int] = mapped_column(
        ForeignKey("learners.id"), unique=True, nullable=False
    )
    account_holder: Mapped[str | None] = mapped_column(String(255))
    bank_name: Mapped[str | None] = mapped_column(String(150))
    account_number: Mapped[str | None] = mapped_column(String(40))
    branch_code: Mapped[str | None] = mapped_column(String(20))
    verification_status: Mapped[str] = mapped_column(
        String(20), default=VerificationStatus.PENDING, nullable=False
    )

    learner = relationship("Learner", back_populates="bank_details")
