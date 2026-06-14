"""Stipend calculation: count verified attendance days per learner over a
period and turn that into payable line items + a POPIA-safe bank CSV.
"""

from __future__ import annotations

import csv
import io
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AttendanceRecord, Learner
from app.models.enums import LearnerStatus, VerificationStatus
from app.services.popia import mask_id_number


def compute_lines(
    db: Session, provider_id: int, period_start: date, period_end: date
) -> list[dict]:
    """One row per learner with >=1 verified attendance day in the period."""
    verified_days = (
        select(
            AttendanceRecord.learner_id.label("learner_id"),
            func.count(AttendanceRecord.id).label("days"),
        )
        .where(
            AttendanceRecord.verification_status == VerificationStatus.VERIFIED,
            AttendanceRecord.attendance_date >= period_start,
            AttendanceRecord.attendance_date <= period_end,
        )
        .group_by(AttendanceRecord.learner_id)
        .subquery()
    )

    stmt = (
        select(Learner, verified_days.c.days)
        .join(verified_days, verified_days.c.learner_id == Learner.id)
        .where(
            Learner.provider_id == provider_id,
            Learner.status != LearnerStatus.DELETED,
        )
        .order_by(Learner.last_name, Learner.first_name)
    )

    lines: list[dict] = []
    for learner, days in db.execute(stmt).all():
        rate = float(learner.stipend_rate_per_day or 0)
        lines.append(
            {
                "learner_id": learner.id,
                "learner_name": learner.full_name,
                "id_number": learner.id_number,
                "verified_days": int(days),
                "daily_rate": rate,
                "total_amount": round(rate * int(days), 2),
            }
        )
    return lines


def summarise(lines: list[dict]) -> dict:
    return {
        "total_learners": len(lines),
        "total_days": sum(line["verified_days"] for line in lines),
        "total_amount_rand": round(sum(line["total_amount"] for line in lines), 2),
    }


def build_bank_csv(lines: list[dict], rows_extra: dict[int, dict] | None = None) -> str:
    """Bank-submission CSV. POPIA §10.3: ID numbers are masked in the export."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Learner",
            "ID Number (masked)",
            "Account Holder",
            "Bank",
            "Account Number",
            "Branch Code",
            "Verified Days",
            "Daily Rate (R)",
            "Amount Due (R)",
        ]
    )
    rows_extra = rows_extra or {}
    for line in lines:
        bank = rows_extra.get(line["learner_id"], {})
        writer.writerow(
            [
                line["learner_name"],
                mask_id_number(line["id_number"]),
                bank.get("account_holder", ""),
                bank.get("bank_name", ""),
                bank.get("account_number", ""),
                bank.get("branch_code", ""),
                line["verified_days"],
                f"{line['daily_rate']:.2f}",
                f"{line['total_amount']:.2f}",
            ]
        )
    return buffer.getvalue()
