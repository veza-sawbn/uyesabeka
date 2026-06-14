"""Seed the database with demo data.

Run from the backend/ directory:  python -m app.seed

Creates two providers, sites, programmes, learners (with bank details), a full
set of role accounts, and a month of attendance so the dashboard is populated.
One account is stored as legacy SHA-256 to demonstrate the transparent bcrypt
migration on first login.

Demo logins (all): see the table printed at the end.
"""

from __future__ import annotations

import random
from datetime import date, datetime, time, timezone

from passlib.hash import hex_sha256

from app.database import Base, SessionLocal, engine
from app.models import (
    AttendanceRecord,
    BankDetails,
    Learner,
    Programme,
    Provider,
    Site,
    User,
)
from app.models.enums import (
    AttendanceStatus,
    GeofenceResult,
    LearnerStatus,
    Role,
    VerificationStatus,
)
from app.security import hash_password

random.seed(42)

FIRST_NAMES = ["Thabo", "Lerato", "Sipho", "Naledi", "Mandla", "Zanele", "Kabelo",
               "Ayanda", "Tshepo", "Nomvula", "Bongani", "Palesa", "Sibusiso", "Refilwe"]
LAST_NAMES = ["Nkosi", "Dlamini", "Mokoena", "Khumalo", "Ndlovu", "Mahlangu",
              "Sithole", "Molefe", "Zwane", "Mthembu"]
BANKS = ["Capitec", "FNB", "Standard Bank", "Absa", "Nedbank"]


def _sa_id() -> str:
    """A plausibly-shaped 13-digit SA ID (not validated against the checksum)."""
    yy = random.randint(96, 99)
    mm = random.randint(1, 12)
    dd = random.randint(1, 28)
    seq = random.randint(0, 9999)
    return f"{yy:02d}{mm:02d}{dd:02d}{seq:04d}08{random.randint(0,9)}"


def _weekdays_until_today(today: date) -> list[date]:
    first = today.replace(day=1)
    days = []
    for n in range(first.toordinal(), today.toordinal() + 1):
        dd = date.fromordinal(n)
        if dd.weekday() < 5:  # Mon-Fri
            days.append(dd)
    return days


def seed() -> None:
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        if db.query(Provider).count() > 0:
            print("Database already seeded; skipping.")
            return

        # --- Providers ---
        prov_a = Provider(name="Ubuntu Skills Academy", registration_number="SDP-2021-0481",
                          contact_email="admin@ubuntuskills.co.za")
        prov_b = Provider(name="Khanya Training Institute", registration_number="SDP-2020-0193",
                          contact_email="ops@khanya.co.za")
        db.add_all([prov_a, prov_b])
        db.flush()

        # --- Sites (Gauteng coordinates) ---
        site_jhb = Site(provider_id=prov_a.id, name="Johannesburg CBD",
                        address="12 Commissioner St, Johannesburg",
                        latitude=-26.2041, longitude=28.0473, geofence_radius_meters=150)
        site_soweto = Site(provider_id=prov_a.id, name="Soweto Centre",
                           address="Vilakazi St, Orlando West",
                           latitude=-26.2678, longitude=27.8585, geofence_radius_meters=200)
        site_pta = Site(provider_id=prov_b.id, name="Pretoria North",
                        address="Church St, Pretoria",
                        latitude=-25.7479, longitude=28.2293, geofence_radius_meters=150)
        db.add_all([site_jhb, site_soweto, site_pta])
        db.flush()

        # --- Programmes ---
        prog_it = Programme(provider_id=prov_a.id, name="End User Computing NQF4", sector="ICT",
                            start_date=date(2026, 1, 13), end_date=date(2026, 12, 11))
        prog_bus = Programme(provider_id=prov_a.id, name="Business Admin NQF3", sector="Services",
                             start_date=date(2026, 2, 3), end_date=date(2026, 11, 28))
        prog_pta = Programme(provider_id=prov_b.id, name="Electrical NQF2", sector="Manufacturing",
                             start_date=date(2026, 1, 20), end_date=date(2026, 12, 4))
        db.add_all([prog_it, prog_bus, prog_pta])
        db.flush()

        # --- Learners ---
        learners: list[Learner] = []
        site_prog = [(site_jhb, prog_it), (site_jhb, prog_bus), (site_soweto, prog_it), (site_pta, prog_pta)]
        for i in range(24):
            site, prog = site_prog[i % len(site_prog)]
            status = LearnerStatus.ACTIVE
            if i % 11 == 0 and i > 0:
                status = LearnerStatus.SUSPENDED
            bank_status = random.choice(
                [VerificationStatus.VERIFIED, VerificationStatus.VERIFIED,
                 VerificationStatus.PENDING, VerificationStatus.REJECTED]
            )
            learner = Learner(
                provider_id=site.provider_id,
                site_id=site.id,
                programme_id=prog.id,
                first_name=random.choice(FIRST_NAMES),
                last_name=random.choice(LAST_NAMES),
                id_number=_sa_id(),
                email=f"learner{i+1}@example.co.za",
                phone=f"07{random.randint(10000000, 99999999)}",
                status=status,
                stipend_rate_per_day=random.choice([80, 90, 100, 120]),
                bank_details_status=bank_status,
            )
            learner.bank_details = BankDetails(
                account_holder=f"{learner.first_name} {learner.last_name}",
                bank_name=random.choice(BANKS),
                account_number=str(random.randint(10**8, 10**9 - 1)),
                branch_code=str(random.randint(200000, 299999)),
                verification_status=bank_status,
            )
            learners.append(learner)
        db.add_all(learners)
        db.flush()

        # --- Attendance for the current month (weekdays up to today) ---
        today = date.today()
        for d in _weekdays_until_today(today):
            for learner in learners:
                if learner.status != LearnerStatus.ACTIVE:
                    continue
                if random.random() > 0.82:  # ~18% absent
                    continue
                site = next(s for s in [site_jhb, site_soweto, site_pta] if s.id == learner.site_id)
                verified = VerificationStatus.VERIFIED if (d < today and random.random() < 0.75) else VerificationStatus.PENDING
                db.add(
                    AttendanceRecord(
                        learner_id=learner.id,
                        site_id=site.id,
                        attendance_date=d,
                        check_in_time=datetime.combine(d, time(8, random.randint(0, 30)), tzinfo=timezone.utc),
                        check_out_time=datetime.combine(d, time(16, random.randint(0, 30)), tzinfo=timezone.utc),
                        check_in_latitude=site.latitude + random.uniform(-0.0005, 0.0005),
                        check_in_longitude=site.longitude + random.uniform(-0.0005, 0.0005),
                        geofence_result=GeofenceResult.INSIDE,
                        distance_from_site_meters=round(random.uniform(5, 90), 1),
                        attendance_status=AttendanceStatus.COMPLETED,
                        verification_status=verified,
                    )
                )

        # --- Users (one role of each + a legacy SHA-256 account) ---
        learner_account = learners[0]
        users = [
            User(username="superadmin", hashed_password=hash_password("admin123"),
                 role=Role.SUPER_ADMIN, full_name="System Administrator"),
            User(username="auditor", hashed_password=hash_password("audit123"),
                 role=Role.AUDITOR, full_name="External Auditor"),
            User(username="admin", hashed_password=hash_password("admin123"),
                 role=Role.PROVIDER_ADMIN, full_name="Provider Admin", provider_id=prov_a.id),
            User(username="verifier", hashed_password=hash_password("verify123"),
                 role=Role.PROVIDER_VERIFIER, full_name="Site Verifier", provider_id=prov_a.id),
            User(username="payroll", hashed_password=hash_password("payroll123"),
                 role=Role.PROVIDER_PAYROLL, full_name="Payroll Officer", provider_id=prov_a.id),
            # Legacy SHA-256 hash -> upgraded to bcrypt on first login.
            User(username="mentor", hashed_password=hex_sha256.hash("mentor123"),
                 role=Role.MENTOR, full_name="Site Mentor", provider_id=prov_a.id, site_id=site_jhb.id),
            User(username="learner", hashed_password=hash_password("learner123"),
                 role=Role.LEARNER, full_name=learner_account.full_name,
                 provider_id=learner_account.provider_id, learner_id=learner_account.id),
        ]
        db.add_all(users)
        db.commit()

        print("Seed complete.\n")
        print(f"  Providers: 2   Sites: 3   Programmes: 3   Learners: {len(learners)}")
        print("\n  Demo logins (username / password / role):")
        print("  ---------------------------------------------------")
        print("  superadmin / admin123   (super_admin)")
        print("  auditor    / audit123   (auditor, read-only)")
        print("  admin      / admin123   (provider_admin)")
        print("  verifier   / verify123  (provider_verifier)")
        print("  payroll    / payroll123 (provider_payroll)")
        print("  mentor     / mentor123  (mentor, legacy SHA-256 -> bcrypt)")
        print("  learner    / learner123 (learner, self only)")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
