from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    username: str
    password: str
    role: str
    full_name: str | None = None
    provider_id: int | None = None
    site_id: int | None = None
    learner_id: int | None = None


class UserUpdate(BaseModel):
    password: str | None = None
    role: str | None = None
    full_name: str | None = None
    provider_id: int | None = None
    site_id: int | None = None


class UserAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None = None
    role: str
    provider_id: int | None = None
    site_id: int | None = None
    learner_id: int | None = None
