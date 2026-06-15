# TASAP — Training, Attendance, Stipend & Audit Platform

Workforce-programme management for the South African learnership ecosystem.
TASAP replaces paper registers and spreadsheets with a real-time digital
platform that links **GPS-verified attendance** to **stipend payment** and
produces **audit-ready** reports.

This repository is a monorepo:

| Path        | What it is                                                        |
| ----------- | ---------------------------------------------------------------- |
| `backend/`  | FastAPI + SQLAlchemy 2 + Alembic JSON API (deploys to Render)     |
| `frontend/` | Next.js 15 (App Router) + TypeScript + Tailwind 4 (deploys to Vercel) |
| `render.yaml` | Render blueprint for the API service + managed PostgreSQL       |

The architecture is decoupled: the frontend talks to the backend only through
typed REST endpoints. There are no server-rendered templates.

---

## Quick start (local)

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# For a quick local run you can use SQLite; production uses PostgreSQL.
export DATABASE_URL="sqlite:///./tasap.db"
export SECRET_KEY="dev-secret-change-me"

python -m app.seed              # creates tables + demo data (idempotent)
uvicorn app.main:app --reload   # http://localhost:8000  (docs at /docs)
```

With PostgreSQL, set `DATABASE_URL=postgresql://user:pass@host:5432/tasap` and
run migrations instead of relying on the seed's `create_all`:

```bash
alembic upgrade head
python -m app.seed
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL + SECRET_KEY (same as backend)
npm run dev                          # http://localhost:3000
```

> **`SECRET_KEY` must be identical** on the backend and the frontend — the edge
> middleware verifies the JWT locally with it.

### Demo logins

| Username     | Password     | Role               | Notes                                   |
| ------------ | ------------ | ------------------ | --------------------------------------- |
| `superadmin` | `admin123`   | super_admin        | full access everywhere                  |
| `auditor`    | `audit123`   | auditor            | read-only, **cross-provider**           |
| `admin`      | `admin123`   | provider_admin     | full access within their provider       |
| `verifier`   | `verify123`  | provider_verifier  | verify / bulk-verify attendance         |
| `payroll`    | `payroll123` | provider_payroll   | run stipend batches, export CSV         |
| `mentor`     | `mentor123`  | mentor             | record attendance (legacy SHA-256 acct) |
| `learner`    | `learner123` | learner            | self check-in only                      |

The `mentor` account is stored with a legacy SHA-256 hash to demonstrate the
**transparent bcrypt migration** — its hash is upgraded on first login.

---

## Architecture notes

### Authentication & sessions
- `POST /api/v1/auth/login` verifies credentials (transparent SHA-256 → bcrypt
  migration) and returns `access_token` (8h) + `refresh_token` (30d).
- The Next.js login **server action** stores those tokens as `httpOnly` cookies
  on the web origin. Server components read the cookie and forward it to the API
  as a `Bearer` token (`lib/api.ts`). Client components never hold the token —
  they mutate and poll through **server actions** (no `app/api/` routes).
- `middleware.ts` verifies the JWT at the edge (jose) on every dashboard route.

### Provider scoping (the security backbone, spec §6.5)
Every learner / attendance / stipend query is filtered by the caller's
`provider_id` inside FastAPI dependencies (`app/deps.py`) — never trusted from
the client. `super_admin` and `auditor` bypass scoping; `learner` accounts are
further narrowed to their own record.

### File storage (Supabase, **no AWS**)
`app/services/storage.py` talks to Supabase Storage over REST with `httpx`.
The bucket is **private**; signatures are served only via short-lived signed
URLs. With no Supabase env vars configured the service degrades to an offline
"demo mode" so the app runs end-to-end without external services.

### POPIA
- SA ID numbers are masked in every export (`9204**5086082`).
- Signature images are biometric data — private bucket, signed URLs ≤ 1h.
- Auditor data access is logged; a per-learner data-subject export endpoint
  exists at `GET /api/v1/learners/{id}/export`.

### Design system ("Mineral")
All colour tokens live as CSS custom properties in `frontend/app/globals.css`.
Components never hardcode hex. Icons are Tabler webfont (`ti ti-*`), not
lucide-react.

---

## Project layout

```
backend/app/
  main.py            FastAPI app + CORS + routers
  config.py          env-driven settings
  database.py        engine, session, Base, TimestampMixin
  security.py        bcrypt + SHA-256 migration, JWT
  deps.py            auth, role guards, provider scoping
  models/            SQLAlchemy 2 models (+ enums.py)
  schemas/           Pydantic request/response models
  routers/           auth, learners, attendance, dashboard, stipends, sites, providers
  services/          storage (Supabase), geofence, stipend_calc, popia
  serializers.py     ORM -> response builders
  seed.py            demo data
  alembic/           migrations (0001_initial)

frontend/
  app/
    globals.css                     Mineral tokens + component styles
    layout.tsx                      root layout (imports Tabler + globals)
    (auth)/login/                   login page + server action
    (dashboard)/
      layout.tsx                    auth guard + app shell
      actions.ts                    server actions (mutations + polling)
      dashboard/  learners/  learners/[id]/  learners/new/  attendance/  stipends/
  components/   SideNav, SiteRail, HeatmapCalendar, LearnerRegister,
                AttendanceTable, BatchList, StipendActions, ui.tsx, …
  lib/          api.ts, auth.ts, types.ts, format.ts
  middleware.ts edge JWT guard
```

---

## Testing

```bash
# Backend end-to-end (SQLite): auth, migration, scoping, role guards,
# geofence, bulk verify, stipend batch + CSV, POPIA masking.
cd backend
DATABASE_URL="sqlite:///./smoke.db" SECRET_KEY="test" python smoke_test.py

# Schema/model drift check
alembic upgrade head && alembic revision --autogenerate -m check   # should be empty

# Frontend
cd frontend && npm run typecheck && npm run build
```

---

## Deployment

- **API → Render**: push the repo; Render reads `render.yaml` (rootDir
  `backend`, runs `alembic upgrade head` on deploy). Set `SUPABASE_*`,
  `CORS_ORIGINS`, and `APP_BASE_URL` manually in the dashboard.
- **Frontend → Vercel**: set the project root to `frontend/`. Set
  `NEXT_PUBLIC_API_URL` (the Render URL) and `SECRET_KEY` (same as the API).

---

## Build-order status (spec §11)

| Phase | Deliverable | Status |
| ----- | ----------- | ------ |
| 1 | Backend auth + learners API + schema + migrations | ✅ |
| 2 | Frontend login + sidebar + topbar shell + dashboard layout | ✅ |
| 3 | Attendance API + Supabase signature upload | ✅ (storage offline = demo mode) |
| 4 | Dashboard: stat cards + heatmap + learner register (in-place check-in) | ✅ |
| 5 | Learners list + detail (+ create + edit) | ✅ |
| 6 | Attendance table + bulk verify | ✅ |
| 7 | Stipend batch calculation + CSV export | ✅ |
| 8 | Mobile responsiveness + site rail live polling | ✅ polling, FAB, breakpoints + bottom tab bar |
| 9 | Auditor cross-provider read-only views | ✅ |
| 10 | POPIA: ID masking, signed-URL expiry, data export | ✅ |

**Organisation & admin modules:** dedicated Programmes, Sites, Providers and
Admin (Users) pages are wired to their backend APIs. Programmes and Sites are
provider-scoped (provider_admin+ can create); Providers is visible to
auditor/super_admin and creatable by super_admin; the Admin module is
super_admin-only with full user create / edit / delete. Each page is gated both
in the sidebar (`canSee`) and by an in-page role guard, and at the edge via
middleware. The learner edit-profile form and the mobile bottom-tab-bar nav
(< 768px) are also in place.
