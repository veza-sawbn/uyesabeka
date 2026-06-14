from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class CheckInRequest(BaseModel):
    learner_id: int
    latitude: float
    longitude: float
    signature_data: str | None = None  # base64 data-URI, optional
    override: bool = False  # mentor recording despite being outside the geofence


class CheckOutRequest(BaseModel):
    attendance_id: int
    latitude: float
    longitude: float


class AttendanceUpdate(BaseModel):
    verification_status: str | None = None
    attendance_status: str | None = None


class BulkVerifyRequest(BaseModel):
    ids: list[int]
    verification_status: str


class AttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    learner_id: int
    learner_name: str | None = None
    learner_id_number: str | None = None
    site_id: int
    site_name: str | None = None
    attendance_date: date
    check_in_time: datetime | None = None
    check_out_time: datetime | None = None
    hours: float | None = None
    geofence_result: str
    distance_from_site_meters: float | None = None
    attendance_status: str
    verification_status: str
    signature_url: str | None = None
