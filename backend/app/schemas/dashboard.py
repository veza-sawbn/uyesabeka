from datetime import date

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_learners: int
    checked_in_today: int
    pending_verification: int
    stipend_arrears_days: int
    stipend_arrears_rand: float


class SiteHeadcount(BaseModel):
    id: int
    name: str
    current: int
    total: int
    ratio: float  # 0..1
    status: str  # "ok" | "warn" | "crit"


class HeatmapDay(BaseModel):
    date: date
    count: int
    total: int
    intensity: str  # low | moderate | good | full | weekend


class Alert(BaseModel):
    severity: str  # critical | warning | info
    message: str
    learner_id: int | None = None
    site_id: int | None = None
