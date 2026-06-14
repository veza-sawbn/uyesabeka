from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin
from app.models.enums import BatchStatus, PaymentStatus


class StipendBatch(Base, TimestampMixin):
    __tablename__ = "stipend_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False, index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)

    total_learners: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_amount_rand: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=BatchStatus.DRAFT, nullable=False)
    initiated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    provider = relationship("Provider")
    line_items = relationship(
        "StipendLineItem", back_populates="batch", cascade="all, delete-orphan"
    )


class StipendLineItem(Base, TimestampMixin):
    __tablename__ = "stipend_line_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("stipend_batches.id"), nullable=False, index=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), nullable=False)

    verified_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    daily_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    payment_status: Mapped[str] = mapped_column(
        String(20), default=PaymentStatus.PENDING, nullable=False
    )

    batch = relationship("StipendBatch", back_populates="line_items")
    learner = relationship("Learner")
