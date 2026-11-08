# Pilot operations and release notes

## This increment

Equipment supports three real JPEG/PNG/WebP photos, condition, horsepower and transport information. Each input is limited to 1 MB and 16 megapixels. The server re-encodes each image to a maximum 1200-pixel JPEG under 300 KB and discards metadata. Photos live in PostgreSQL and therefore survive web-service restarts. They consume database capacity: this is bounded per-listing pilot storage, not an unlimited media service. Only active, unmoderated listings have publicly accessible photos; owners can preview their own archived or moderated photos.

Unaccepted rental requests expire at the earlier of their start time or 24 hours after creation. Expiry changes status to CANCELLED, records an explanation, releases the database exclusion reservation and adds in-app notifications. Acceptance, cancellation and expiry are transactional. Existing requests are assigned a deadline by migration 008. This can expire old pending requests on first use after upgrade.

Booking cards show progress, next actions, response deadlines and closure reasons. Owners or assigned operators report travel progress; the system does not track live GPS. Owners can save a readiness checklist. Farmers can save machines, book again with fresh dates/prices, report problems and view staff responses. Attachment charges are validated against the saved listing; changing rates in the browser is rejected.

Community & support contains village demand, rental groups, FPO assistance, reminder preferences and support cases. A group is a coordination view: members have separate bookings, slots, invoices and direct payments. Joining makes equipment, dates and individual costs visible to fellow members. Leaving removes the farmer's bookings from that group view without cancelling those bookings. A farmer can authorize an FPO account for seven days and revoke it immediately. Assistance never gives a coordinator the owner's private farmer-contact endpoint. Previously submitted bookings survive revocation.

## Before deployment

1. Back up the production database. Keep the archive outside the repository in access-controlled storage.
2. Install the updated requirements, including Pillow. Apply migrations 007, 008 and 009 before starting the new backend. The updated Render blueprint uses `python dev.py init && uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`.
3. Keep DATABASE_URL in Render environment settings. The plaintext value was removed from the blueprint; `sync: false` requires configuring it in Render. A credential previously committed remains in Git history: rotate it in the database provider, update Render and local settings, and verify connectivity. This change does not rotate credentials or rewrite history.
4. Set `FRONTEND_ORIGIN` to the exact allowed production origin(s), comma-separated. Arbitrary `*.vercel.app` origins are no longer trusted. A preview URL needs an explicit entry if it will use this backend.
5. Set `ADMIN_USER_IDS` to the comma-separated UUIDs of deliberately chosen existing staff accounts. There is no public admin signup and no automatic staff assignment. The account ID is shown in Community & support. Without this configuration, support cases are stored but nobody has staff access to process them. Appoint a person to review the queue; no external staff alert is sent.
6. Deploy the frontend after backend migrations and endpoints are healthy. Check `/api/health`: a disconnected database now returns HTTP 503. Unhandled errors expose only a request reference; logs record that reference and the exception class, without request bodies or credentials.
7. Verify a real owner listing, farmer request, owner acceptance, farmer contact access, support response and invoice in the deployed environment with consenting pilot users. Local test results do not establish live delivery or live reliability.

## In-app maintenance

Booking/discovery/activity requests run opportunistic expiry; Activity also creates upcoming-rental reminders once per participant. Opening Bookings or Notifications refreshes server records. No browser needs to remain open for database consistency on the next API request.

For an unattended maintenance pass, run:

```powershell
python dev.py maintenance
```

It expires overdue requests and creates in-app reminders for accepted rentals starting within 24 hours. It can safely be run repeatedly. This increment does not install a scheduler or activate a paid Render worker. Without a scheduler, an idle database is updated on the next relevant API request. Reminders are in-app records, not email/SMS deliveries. Preferences disable upcoming reminders, not essential booking-status notices.

## Backup and recovery

Use PostgreSQL client tools compatible with the database server. Set `PG_BIN` if they are not in PATH, for example the installed PostgreSQL `bin` directory. The script reads the root `.env` and environment variables, keeping credentials out of command-line arguments and console output.

```powershell
python scripts/database_backup.py backup --output C:\PrivateBackups\yantrasetu.dump
python scripts/database_backup.py verify --archive C:\PrivateBackups\yantrasetu.dump
```

The destination directory must already exist and the file must not exist. Backups include personal information and images. Protect them with filesystem access controls and encrypted storage; never commit them. The script streams a custom-format archive and verifies its table of contents.

`verify` requires CREATEDB permission, creates a uniquely named temporary database, restores the archive, checks schema version and core tables, then drops only that temporary database. It never restores over an existing database. The current local application role does not have CREATEDB permission, so the whole-database verification command could not be executed here. A native `pg_dump` / `pg_restore` round trip in a uniquely named disposable test schema succeeded, including exact text and binary-photo-byte comparison. Production recovery remains untested.

Before changing production after an incident, an authorized database administrator should restore the archive into a separate recovery database, validate row counts, photos, booking availability and authentication, then arrange a controlled cutover. Do not overwrite the only live database as a first recovery step. Define retention, off-device encrypted copies and a recurring restore drill before a wider launch; none was silently activated here.

## Validation and remaining limits

Validation on 8 November 2026: full backend suite **70 passed** against native PostgreSQL/PostGIS, with one FastAPI/Starlette test-client deprecation warning. After the final legacy-idempotency compatibility fix, all **8 operations tests passed again**. `npm run build` passed after the final translated-dropdown fix. `git diff --check` passed. Temporary browser QA servers and their identified synthetic schema were removed; no production data was used for browser QA.

Real PostgreSQL/PostGIS tests cover photo persistence, invalid upload rollback, moderation, expiry releasing reservations, owner-reported arrival, readiness, support privacy and staff resolution, reminder deduplication and opt-out, FPO consent/revocation, group membership/leaving, price tampering, saved equipment, demand privacy and foreign-origin rejection. Existing rental lifecycle and concurrent exclusion tests remain part of the suite.

Browser QA used a loopback-only backend with an isolated schema and synthetic accounts. Farmer password login, group creation, persisted support submission and Hindi/Punjabi labels were inspected. Owner/admin workflows have API integration coverage; a full cross-role mobile browser walkthrough and native-speaker copy review remain release checks. New form labels and consent text are translated; some dynamic operational/error messages still use English. Low-data mode makes equipment photo loading opt-in and does not claim to suppress all map/weather traffic.

Email setup remains paused as requested. Email recovery and meter-code delivery still depend on a working delivery provider. No SMS provider, payment processor, public deployment, automated production backup, credential rotation or Git push was performed by this increment. Payments remain directly between farmer and owner; reported paid figures are not independently verified receipts.
