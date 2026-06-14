"""String constants for roles and status fields.

Stored as plain strings (not native PG enums) to keep migrations painless.
Frontend mirrors these exact values in lib/types.ts.
"""


class Role:
    SUPER_ADMIN = "super_admin"
    AUDITOR = "auditor"
    PROVIDER_ADMIN = "provider_admin"
    PROVIDER_VERIFIER = "provider_verifier"
    PROVIDER_PAYROLL = "provider_payroll"
    MENTOR = "mentor"
    LEARNER = "learner"

    ALL = {
        SUPER_ADMIN,
        AUDITOR,
        PROVIDER_ADMIN,
        PROVIDER_VERIFIER,
        PROVIDER_PAYROLL,
        MENTOR,
        LEARNER,
    }
    # Roles that see across every provider (no provider scoping).
    CROSS_PROVIDER = {SUPER_ADMIN, AUDITOR}
    # Roles allowed to mutate data within their provider.
    PROVIDER_WRITERS = {SUPER_ADMIN, PROVIDER_ADMIN}


class LearnerStatus:
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    DELETED = "deleted"  # soft delete


class VerificationStatus:
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class GeofenceResult:
    INSIDE = "inside"
    OUTSIDE = "outside"
    REJECTED = "rejected"


class AttendanceStatus:
    PRESENT = "present"
    COMPLETED = "completed"  # checked out
    OVERRIDE = "override"  # recorded outside geofence by a mentor


class BatchStatus:
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PAID = "paid"


class PaymentStatus:
    PENDING = "pending"
    PAID = "paid"
