"""Builders that turn ORM rows into response schemas, filling derived fields
(site/programme names, masked account numbers, signed signature URLs).
"""

from __future__ import annotations

from app.models import AttendanceRecord, BankDetails, Learner
from app.schemas.attendance import AttendanceOut
from app.schemas.learner import BankDetailsOut, LearnerDetailOut, LearnerOut
from app.services.storage import generate_signed_url


def learner_out(learner: Learner) -> LearnerOut:
    return LearnerOut(
        id=learner.id,
        provider_id=learner.provider_id,
        site_id=learner.site_id,
        site_name=learner.site.name if learner.site else None,
        programme_id=learner.programme_id,
        programme_name=learner.programme.name if learner.programme else None,
        first_name=learner.first_name,
        last_name=learner.last_name,
        full_name=learner.full_name,
        id_number=learner.id_number,
        email=learner.email,
        phone=learner.phone,
        status=learner.status,
        stipend_rate_per_day=float(learner.stipend_rate_per_day or 0),
        bank_details_status=learner.bank_details_status,
    )


def bank_details_out(bank: BankDetails | None) -> BankDetailsOut | None:
    if bank is None:
        return None
    acct = bank.account_number or ""
    last4 = acct[-4:] if len(acct) >= 4 else acct
    return BankDetailsOut(
        id=bank.id,
        account_holder=bank.account_holder,
        bank_name=bank.bank_name,
        account_number_last4=last4 or None,
        branch_code=bank.branch_code,
        verification_status=bank.verification_status,
    )


def learner_detail_out(learner: Learner) -> LearnerDetailOut:
    base = learner_out(learner).model_dump()
    return LearnerDetailOut(
        **base,
        enrolment_date=learner.created_at,
        bank_details=bank_details_out(learner.bank_details),
    )


def attendance_out(record: AttendanceRecord, include_signature: bool = True) -> AttendanceOut:
    signature_url = None
    if include_signature and record.signature_object_path:
        signature_url = generate_signed_url(record.signature_object_path, expires_in=3600)
    return AttendanceOut(
        id=record.id,
        learner_id=record.learner_id,
        learner_name=record.learner.full_name if record.learner else None,
        learner_id_number=record.learner.id_number if record.learner else None,
        site_id=record.site_id,
        site_name=record.site.name if record.site else None,
        attendance_date=record.attendance_date,
        check_in_time=record.check_in_time,
        check_out_time=record.check_out_time,
        hours=record.hours,
        geofence_result=record.geofence_result,
        distance_from_site_meters=record.distance_from_site_meters,
        attendance_status=record.attendance_status,
        verification_status=record.verification_status,
        signature_url=signature_url,
    )
