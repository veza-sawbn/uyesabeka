from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin
from app.models.enums import VerificationStatus


class AttendanceRecord(Base, TimestampMixin):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    learner_id: Mapped[int] = mapped_column(ForeignKey("learners.id"), nullable=False, index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), nullable=False, index=True)

    attendance_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    check_in_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    check_out_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    check_in_latitude: Mapped[float | None] = mapped_column(Float)
    check_in_longitude: Mapped[float | None] = mapped_column(Float)
    geofence_result: Mapped[str] = mapped_column(String(20), nullable=False)
    distance_from_site_meters: Mapped[float | None] = mapped_column(Float)

    attendance_status: Mapped[str] = mapped_column(String(20), nullable=False)
    verification_status: Mapped[str] = mapped_column(
        String(20), default=VerificationStatus.PENDING, nullable=False
    )

    signature_url: Mapped[str | None] = mapped_column(String(1000))
    # Bucket-relative path, used to re-issue signed URLs (POPIA: never public).
    signature_object_path: Mapped[str | None] = mapped_column(String(500))

    learner = relationship("Learner", back_populates="attendance_records")
    site = relationship("Site", back_populates="attendance_records")

    @property
    def hours(self) -> float | None:
        if self.check_in_time and self.check_out_time:
            delta = self.check_out_time - self.check_in_time
            return round(delta.total_seconds() / 3600, 2)
        return None

    @property
    def is_stipend_day(self) -> bool:
        """A day counts toward stipend only when the record is verified."""
        return self.verification_status == VerificationStatus.VERIFIED
