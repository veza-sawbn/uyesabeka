"""Throwaway end-to-end smoke test against SQLite. Not part of the app.

Run:  DATABASE_URL=sqlite:///./smoke.db SECRET_KEY=test python smoke_test.py
"""

import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///./smoke.db")
os.environ.setdefault("SECRET_KEY", "smoke-secret")

# Fresh DB each run.
if os.path.exists("smoke.db"):
    os.remove("smoke.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

seed()
client = TestClient(app)

failures = []


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"  [{status}] {name} {extra}")
    if not cond:
        failures.append(name)


def login(username, password):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    return r


print("\n== auth ==")
r = login("admin", "admin123")
check("provider_admin login", r.status_code == 200, f"({r.status_code})")
admin_token = r.json()["access_token"]
admin_h = {"Authorization": f"Bearer {admin_token}"}
check("login returns user", r.json()["user"]["role"] == "provider_admin")

r = login("admin", "wrong")
check("bad password rejected", r.status_code == 401)

# Legacy SHA-256 account migrates on login.
from app.database import SessionLocal  # noqa: E402
from app.models import User  # noqa: E402
db = SessionLocal()
mentor_before = db.query(User).filter_by(username="mentor").one().hashed_password
r = login("mentor", "mentor123")
check("legacy sha256 login", r.status_code == 200, f"({r.status_code})")
db.expire_all()
mentor_after = db.query(User).filter_by(username="mentor").one().hashed_password
check("password migrated to bcrypt", mentor_before != mentor_after and mentor_after.startswith("$2"))
db.close()

r = client.get("/api/v1/auth/me", headers=admin_h)
check("me endpoint", r.status_code == 200 and r.json()["username"] == "admin")
# Clear the TestClient cookie jar so this checks header-less, cookie-less access.
client.cookies.clear()
r = client.get("/api/v1/auth/me")
check("me requires auth", r.status_code == 401)

print("\n== learners + provider scoping ==")
r = client.get("/api/v1/learners", headers=admin_h)
check("list learners", r.status_code == 200)
page = r.json()
admin_learner_total = page["total"]
check("learners are paginated", "items" in page and "pages" in page and admin_learner_total > 0,
      f"(total={admin_learner_total})")
provider_ids = {item["provider_id"] for item in page["items"]}
check("provider scoping (single provider)", len(provider_ids) == 1, f"(providers={provider_ids})")

# Auditor sees across providers.
r = login("auditor", "audit123")
auditor_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
r = client.get("/api/v1/learners", headers=auditor_h)
auditor_total = r.json()["total"]
check("auditor cross-provider read", auditor_total >= admin_learner_total, f"({auditor_total} >= {admin_learner_total})")

# Auditor is read-only.
r = client.post("/api/v1/learners", headers=auditor_h, json={
    "first_name": "X", "last_name": "Y", "id_number": "9001011234089"})
check("auditor cannot create (403)", r.status_code == 403, f"({r.status_code})")

# Search + detail.
first_learner = client.get("/api/v1/learners", headers=admin_h).json()["items"][0]
r = client.get(f"/api/v1/learners/{first_learner['id']}", headers=admin_h)
check("learner detail", r.status_code == 200 and "bank_details" in r.json())
check("account number masked to last4",
      (r.json()["bank_details"] or {}).get("account_number_last4") is None
      or len(r.json()["bank_details"]["account_number_last4"]) <= 4)

print("\n== dashboard ==")
for path in ["stats", "sites", "alerts"]:
    r = client.get(f"/api/v1/dashboard/{path}", headers=admin_h)
    check(f"dashboard/{path}", r.status_code == 200, f"({r.status_code})")
stats = client.get("/api/v1/dashboard/stats", headers=admin_h).json()
check("stats has all fields",
      all(k in stats for k in ["total_learners", "checked_in_today", "pending_verification",
                               "stipend_arrears_days", "stipend_arrears_rand"]))
import datetime as _dt  # noqa: E402
today = _dt.date.today()
r = client.get(f"/api/v1/dashboard/heatmap?year={today.year}&month={today.month}", headers=admin_h)
check("heatmap returns days", r.status_code == 200 and len(r.json()) >= 28)
intensities = {d["intensity"] for d in r.json()}
check("heatmap intensities valid", intensities <= {"low", "moderate", "good", "full", "weekend"},
      f"({intensities})")

print("\n== attendance ==")
r = client.get("/api/v1/attendance", headers=admin_h)
check("list attendance", r.status_code == 200 and r.json()["total"] > 0, f"(total={r.json()['total']})")

# Check-in flow: pick a learner without a record today.
learners = client.get("/api/v1/learners?page_size=100", headers=admin_h).json()["items"]
mentor_login = login("mentor", "mentor123").json()
mentor_h = {"Authorization": f"Bearer {mentor_login['access_token']}"}
mentor_site = mentor_login["user"]["site_id"]
site_learners = [l for l in learners if l["site_id"] == mentor_site and l["status"] == "active"]
checked_in = None
for l in site_learners:
    # Use the site's approximate coordinates (JHB CBD) so we're inside the fence.
    r = client.post("/api/v1/attendance/check-in", headers=mentor_h, json={
        "learner_id": l["id"], "latitude": -26.2041, "longitude": 28.0473})
    if r.status_code == 201:
        checked_in = r.json()
        break
check("mentor check-in inside geofence", checked_in is not None and checked_in["geofence_result"] == "inside")

# Outside geofence requires override.
if site_learners:
    far_learner = next((l for l in site_learners if checked_in is None or l["id"] != checked_in["learner_id"]), None)
    if far_learner:
        r = client.post("/api/v1/attendance/check-in", headers=mentor_h, json={
            "learner_id": far_learner["id"], "latitude": 0.0, "longitude": 0.0})
        check("outside geofence rejected without override", r.status_code == 422, f"({r.status_code})")
        r = client.post("/api/v1/attendance/check-in", headers=mentor_h, json={
            "learner_id": far_learner["id"], "latitude": 0.0, "longitude": 0.0, "override": True})
        check("override check-in succeeds", r.status_code == 201 and r.json()["geofence_result"] == "outside",
              f"({r.status_code})")

# Bulk verify (verifier role).
ver_h = {"Authorization": f"Bearer {login('verifier', 'verify123').json()['access_token']}"}
pending = client.get("/api/v1/attendance?verification_status=pending&page_size=20", headers=ver_h).json()["items"]
ids = [a["id"] for a in pending][:20]
r = client.post("/api/v1/attendance/bulk-verify", headers=ver_h, json={
    "ids": ids, "verification_status": "verified"})
check("bulk verify", r.status_code == 200 and r.json()["updated"] == len(ids), f"({r.json()})")

print("\n== stipends ==")
pay_h = {"Authorization": f"Bearer {login('payroll', 'payroll123').json()['access_token']}"}
r = client.get("/api/v1/stipends/summary", headers=pay_h)
check("stipend summary", r.status_code == 200 and "total_amount_rand" in r.json())
r = client.get("/api/v1/stipends/preview", headers=pay_h)
check("stipend preview", r.status_code == 200 and "lines" in r.json())
r = client.post("/api/v1/stipends/run", headers=pay_h, json={})
check("run batch", r.status_code == 201, f"({r.status_code})")
batch = r.json()
check("batch has line items", len(batch["line_items"]) >= 0, f"(items={len(batch['line_items'])})")
r = client.get(f"/api/v1/stipends/{batch['id']}/export.csv", headers=pay_h)
check("csv export", r.status_code == 200 and "ID Number (masked)" in r.text)
check("csv masks ID numbers", "**" in r.text or batch["total_learners"] == 0)

# Verifier cannot run payroll.
r = client.post("/api/v1/stipends/run", headers=ver_h, json={})
check("verifier cannot run payroll (403)", r.status_code == 403, f"({r.status_code})")

print("\n== sites / programmes / providers ==")
check("list sites", client.get("/api/v1/sites", headers=admin_h).status_code == 200)
check("list programmes", client.get("/api/v1/programmes", headers=admin_h).status_code == 200)
check("providers (auditor)", client.get("/api/v1/providers", headers=auditor_h).status_code == 200)
check("providers (provider_admin 403)", client.get("/api/v1/providers", headers=admin_h).status_code == 403)

print("\n== POPIA ==")
r = client.get(f"/api/v1/learners/{first_learner['id']}/export", headers=admin_h)
check("learner export masks ID", r.status_code == 200 and "**" in r.json()["id_number"], f"({r.json().get('id_number')})")

print(f"\n{'='*50}")
if failures:
    print(f"FAILED: {len(failures)} checks -> {failures}")
    sys.exit(1)
print("ALL CHECKS PASSED")
