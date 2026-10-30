# YantraSetu — native local development

**Don’t buy what your village can share.**

React/Vite + FastAPI + PostgreSQL/PostGIS. **Docker is not required or included.** No payment gateways, subscriptions, wallets, commissions or paid API integrations.

This is an initial development release, not the completed platform. Database-backed execution remains unverified in the delivery environment; see `docs/STATUS.md`. Live SMS, full localization, equipment photographs and advanced FPO/route functionality remain pending. Use synthetic data only. Development OTPs are visibly returned and must never be exposed publicly.

## 1. Prerequisites

- Python 3.12.
- Node.js 22 with npm.
- A running local PostgreSQL installation (16+), with matching PostGIS binaries and `btree_gist` available.
- Two terminals, plus pgAdmin or psql for initial database setup.

An existing PostgreSQL 18 installation can be used; do not reinstall it just for this project. Use a **new `yantrasetu` database**, not your existing `ADBMS` database.

On Windows, PostGIS can be added through StackBuilder for the selected PostgreSQL installation. Install the bundle matching the PostgreSQL major version. Official instructions: https://postgis.net/documentation/getting_started/install_windows/ . Installing server binaries and enabling the extension inside a database are separate steps.

## 2. Create the local database once

In pgAdmin, connect as your local database administrator. Create a login role named `yantrasetu` with a password you choose locally. Do not paste it into chat. Leave Superuser disabled. Then create a database named `yantrasetu`, owned by that role. Do not modify other databases.

Connect pgAdmin Query Tool to the **new yantrasetu database** as the administrator and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

The application role owns its new database and creates the application tables during migration. It does not need to be a superuser. If PostGIS is unavailable, install its matching server bundle first.

## 3. Backend — Windows PowerShell

Open a terminal in the extracted `yantrasetu` project directory:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Copy `.env.example` only on first setup; do not overwrite an existing configured `.env`.

Open `.env` in your editor:

- Set `PGPASSWORD` to the local `yantrasetu` database role's password.
- Set `OTP_SECRET` to the generated random value.
- Keep `PGDATABASE=yantrasetu` and `PGUSER=yantrasetu`; update host/port if your local server uses different values.
- Keep development mode and `FRONTEND_ORIGIN=http://localhost:5173`.

The application loads this project-root `.env` automatically. Shell/CI environment values take precedence. Separate `PG*` fields avoid URL-encoding a password; quote values containing special characters according to dotenv syntax. Never commit `.env`.

```powershell
.\.venv\Scripts\python.exe dev.py check
.\.venv\Scripts\python.exe dev.py init
.\.venv\Scripts\python.exe dev.py seed
.\.venv\Scripts\python.exe dev.py serve
```

`check` checks connectivity and extensions without changing the database. `init` applies the initial migration. `seed` is optional and idempotently creates labeled synthetic demo data. `serve` starts the API on **127.0.0.1:8000**. It does not run migrations automatically; run `init` before first startup.

No PowerShell activation or execution-policy change is needed when using the venv Python path above.

### Linux/macOS equivalent

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cp .env.example .env
# Edit .env and set your local database password and generated OTP_SECRET.
.venv/bin/python dev.py check
.venv/bin/python dev.py init
.venv/bin/python dev.py seed
.venv/bin/python dev.py serve
```

## 4. Frontend — second terminal

From the project directory:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` requests to the local backend. Port 5173 is fixed; if it is occupied, stop the conflicting development process rather than silently switching ports and breaking origin checks. API docs: http://localhost:8000/docs.

**Demo identities** (all synthetic; no SMS sent):

| Phone | Role |
|---|---|
| +919000000001 | Farmer |
| +919000000002 | Owner, farmer, FPO manager |
| +919000000003 | Operator |

Click Sign in, enter a demo phone, and use the visibly labeled development code. Existing users retain their saved name/roles; new accounts choose roles during registration. Use two browsers or separate normal/private sessions to act as owner and farmer simultaneously.

### Demo flow

1. Farmer searches around the default Ludhiana coordinates. Choose a machine.
2. Set a start a few minutes ahead, an end time and farm coordinates. Calculate the estimate, then request approval.
3. Owner opens My bookings and accepts. A rejected or cancelled booking releases its slot. Pending requests reserve slots until resolved.
4. Attempt another overlapping reservation to exercise database conflict handling. The protected interval includes the machine's turnaround buffer.
5. Optionally register the operator and assign them by phone. PostgreSQL also protects the operator's schedule.
6. Owner submits a start meter reading. Farmer opens Review & confirm reading and enters the development code. Work can start **only inside the approved time slot**.
7. Owner submits an end reading (plus completed acreage for acre pricing); farmer confirms. Example: ₹650/hour, 100 → 102.5 hours, ₹250 mobilization = ₹1,875.
8. Both parties can rate the completed booking. Open the invoice and use Print / save as PDF.
9. Record an outside-platform payment status. Its wording and audit trail explicitly say it is manually reported and unverified.
10. Owner opens YantraLink and chooses a machine/date with 1–8 approved bookings. Inspect the feasibility result and estimated distance comparison. No bookings are moved by the solver.

## Tests and build

From the project root on Windows:

```powershell
.\.venv\Scripts\python.exe dev.py test
```

On Linux/macOS, replace that executable with `.venv/bin/python`.

Six PostgreSQL integration tests skip unless `TEST_DATABASE_URL` is set. To run them, create a separate disposable `yantrasetu_test` database and configure that URL locally. The test role needs schema/extension privileges; enable PostGIS and btree_gist as an administrator first if using a non-superuser role. Do not point tests at a live/shared or academic database. The tests create isolated schemas and remove only those schemas afterward.

`.github/workflows/ci.yml` installs native PostgreSQL/PostGIS on its Linux runner, runs database tests and builds the frontend. It uses **no container service**. CI has not run remotely, and its updated setup remains unverified.

```sh
cd frontend
npm run build
```

## Layout

- `backend/app/main.py`: HTTP endpoints, authorization, transactional workflows.
- `backend/app/domain.py`: Decimal billing, meter validation, exact small-instance route solver.
- `backend/app/sms.py`: development-only delivery boundary.
- `backend/app/db.py`: PostgreSQL connection/transaction boundary.
- `db/001_initial.sql`: tables, PostGIS index, machine/operator exclusion constraints.
- `frontend/src/`: React UI, local draft handling and search caching.
- `frontend/public/sw.js`: app-shell caching; private APIs are never service-worker cached.
- `backend/tests/`: rules, request validation and real-PostgreSQL tests.
- `docs/`: architecture, constraints, external-service decisions and evidence.

## Stop and preserve data

Press **Ctrl+C** in the frontend and backend terminals. This stops the application processes; the local PostgreSQL service and saved data remain. No database or volume deletion is necessary.

## External decisions

No external service is active. See `docs/EXTERNAL_SERVICES.md` for live-SMS requirements. Hosting, real pilot data, liability terms and public deployment still require the project owner's decisions. Docker is excluded from the current scope and must not be reintroduced without a new request.

## Public home page and email / Google sign-in

The public home page now precedes the authenticated workspace. Email OTP and Continue with Google (followed by an email OTP) are available after configuration. See [authentication setup](docs/AUTH_SETUP.md) for migration 003, SMTP settings, Google client setup, security behavior and test limitations. Existing phone login remains available in development.
