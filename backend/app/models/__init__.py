"""SQLAlchemy models. Importing this package registers every table on Base."""

from app.models.attendance import AttendanceRecord
from app.models.bank_details import BankDetails
from app.models.learner import Learner
from app.models.programme import Programme
from app.models.provider import Provider
from app.models.site import Site
from app.models.stipend import StipendBatch, StipendLineItem
from app.models.user import User

__all__ = [
    "AttendanceRecord",
    "BankDetails",
    "Learner",
    "Programme",
    "Provider",
    "Site",
    "StipendBatch",
    "StipendLineItem",
    "User",
]
