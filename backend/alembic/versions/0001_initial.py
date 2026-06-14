"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-14
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("registration_number", sa.String(100)),
        sa.Column("contact_email", sa.String(255)),
        *_timestamps(),
    )

    op.create_table(
        "programmes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("sector", sa.String(150)),
        sa.Column("start_date", sa.Date()),
        sa.Column("end_date", sa.Date()),
        *_timestamps(),
    )

    op.create_table(
        "sites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.String(500)),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("geofence_radius_meters", sa.Integer(), nullable=False, server_default="150"),
        *_timestamps(),
    )

    op.create_table(
        "learners",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id")),
        sa.Column("programme_id", sa.Integer(), sa.ForeignKey("programmes.id")),
        sa.Column("first_name", sa.String(120), nullable=False),
        sa.Column("last_name", sa.String(120), nullable=False),
        sa.Column("id_number", sa.String(13), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("phone", sa.String(40)),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("stipend_rate_per_day", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("bank_details_status", sa.String(20), nullable=False, server_default="pending"),
        *_timestamps(),
    )
    op.create_index("ix_learners_provider_id", "learners", ["provider_id"])
    op.create_index("ix_learners_site_id", "learners", ["site_id"])
    op.create_index("ix_learners_id_number", "learners", ["id_number"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(150), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("providers.id")),
        sa.Column("learner_id", sa.Integer(), sa.ForeignKey("learners.id")),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id")),
        *_timestamps(),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "bank_details",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("learner_id", sa.Integer(), sa.ForeignKey("learners.id"), nullable=False, unique=True),
        sa.Column("account_holder", sa.String(255)),
        sa.Column("bank_name", sa.String(150)),
        sa.Column("account_number", sa.String(40)),
        sa.Column("branch_code", sa.String(20)),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="pending"),
        *_timestamps(),
    )

    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("learner_id", sa.Integer(), sa.ForeignKey("learners.id"), nullable=False),
        sa.Column("site_id", sa.Integer(), sa.ForeignKey("sites.id"), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("check_in_time", sa.DateTime(timezone=True)),
        sa.Column("check_out_time", sa.DateTime(timezone=True)),
        sa.Column("check_in_latitude", sa.Float()),
        sa.Column("check_in_longitude", sa.Float()),
        sa.Column("geofence_result", sa.String(20), nullable=False),
        sa.Column("distance_from_site_meters", sa.Float()),
        sa.Column("attendance_status", sa.String(20), nullable=False),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("signature_url", sa.String(1000)),
        sa.Column("signature_object_path", sa.String(500)),
        *_timestamps(),
    )
    op.create_index("ix_attendance_records_learner_id", "attendance_records", ["learner_id"])
    op.create_index("ix_attendance_records_site_id", "attendance_records", ["site_id"])
    op.create_index("ix_attendance_records_attendance_date", "attendance_records", ["attendance_date"])

    op.create_table(
        "stipend_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("providers.id"), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("total_learners", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_amount_rand", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("initiated_by", sa.Integer(), sa.ForeignKey("users.id")),
        *_timestamps(),
    )
    op.create_index("ix_stipend_batches_provider_id", "stipend_batches", ["provider_id"])

    op.create_table(
        "stipend_line_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("stipend_batches.id"), nullable=False),
        sa.Column("learner_id", sa.Integer(), sa.ForeignKey("learners.id"), nullable=False),
        sa.Column("verified_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("daily_rate", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("payment_status", sa.String(20), nullable=False, server_default="pending"),
        *_timestamps(),
    )
    op.create_index("ix_stipend_line_items_batch_id", "stipend_line_items", ["batch_id"])


def downgrade() -> None:
    op.drop_table("stipend_line_items")
    op.drop_table("stipend_batches")
    op.drop_table("attendance_records")
    op.drop_table("bank_details")
    op.drop_table("users")
    op.drop_table("learners")
    op.drop_table("sites")
    op.drop_table("programmes")
    op.drop_table("providers")
