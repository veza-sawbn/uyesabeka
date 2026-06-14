from datetime import date

from pydantic import BaseModel, ConfigDict


class StipendSummary(BaseModel):
    period_start: date
    period_end: date
    total_learners: int
    total_verified_days: int
    total_amount_rand: float
    current_batch_status: str | None = None


class StipendPreviewLine(BaseModel):
    learner_id: int
    learner_name: str
    id_number: str
    verified_days: int
    daily_rate: float
    total_amount: float


class StipendPreview(BaseModel):
    period_start: date
    period_end: date
    total_learners: int
    total_days: int
    total_amount_rand: float
    lines: list[StipendPreviewLine]


class StipendLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int
    learner_name: str | None = None
    verified_days: int
    daily_rate: float
    total_amount: float
    payment_status: str


class StipendBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    period_start: date
    period_end: date
    total_learners: int
    total_days: int
    total_amount_rand: float
    status: str
    initiated_by: int | None = None
    line_items: list[StipendLineOut] = []


class BatchRunRequest(BaseModel):
    period_start: date | None = None
    period_end: date | None = None
