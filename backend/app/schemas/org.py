from datetime import date

from pydantic import BaseModel, ConfigDict


class SiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    geofence_radius_meters: int


class SiteCreate(BaseModel):
    name: str
    address: str | None = None
    latitude: float
    longitude: float
    geofence_radius_meters: int = 150
    provider_id: int | None = None


class ProgrammeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider_id: int
    name: str
    sector: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class ProgrammeCreate(BaseModel):
    name: str
    sector: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    provider_id: int | None = None


class ProviderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    registration_number: str | None = None
    contact_email: str | None = None


class ProviderCreate(BaseModel):
    name: str
    registration_number: str | None = None
    contact_email: str | None = None
