from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin


class Site(Base, TimestampMixin):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider_id: Mapped[int] = mapped_column(ForeignKey("providers.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str | None] = mapped_column(String(500))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    geofence_radius_meters: Mapped[int] = mapped_column(Integer, default=150, nullable=False)

    provider = relationship("Provider", back_populates="sites")
    learners = relationship("Learner", back_populates="site")
    attendance_records = relationship("AttendanceRecord", back_populates="site")
