from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import LearnerStatus, VerificationStatus


class BankDetailsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_holder: str | None = None
    bank_name: str | None = None
    account_number_last4: str | None = None
    branch_code: str | None = None
    verification_status: str


class BankDetailsUpdate(BaseModel):
    account_holder: str | None = None
    bank_name: str | None = None
    account_number: str | None = None
    branch_code: str | None = None
    verification_status: str | None = None


class LearnerBase(BaseModel):
    first_name: str
    last_name: str
    id_number: str = Field(min_length=13, max_length=13)
    email: EmailStr | None = None
    phone: str | None = None
    site_id: int | None = None
    programme_id: int | None = None
    stipend_rate_per_day: float = 0


class LearnerCreate(LearnerBase):
    status: str = LearnerStatus.ACTIVE
    # Only honoured for cross-provider roles; otherwise taken from the JWT.
    provider_id: int | None = None


class LearnerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    id_number: str | None = Field(default=None, min_length=13, max_length=13)
    email: EmailStr | None = None
    phone: str | None = None
    site_id: int | None = None
    programme_id: int | None = None
    stipend_rate_per_day: float | None = None
    status: str | None = None


class LearnerStatusUpdate(BaseModel):
    status: str


class LearnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    site_id: int | None = None
    site_name: str | None = None
    programme_id: int | None = None
    programme_name: str | None = None
    first_name: str
    last_name: str
    full_name: str
    id_number: str
    email: str | None = None
    phone: str | None = None
    status: str
    stipend_rate_per_day: float
    bank_details_status: str


class LearnerDetailOut(LearnerOut):
    enrolment_date: datetime | None = None
    bank_details: BankDetailsOut | None = None
