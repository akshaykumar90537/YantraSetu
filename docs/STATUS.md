# Development status — 30 October 2026

## Docker-free update

Dockerfiles, Compose and the container-only nginx configuration have been removed. Local configuration loads automatically from the project-root `.env`. `dev.py` provides native checks, migrations, seed, tests and API startup. Windows setup uses explicit venv executable paths; no PowerShell policy change is required. CI now installs PostgreSQL/PostGIS natively; that workflow and Windows startup have not been executed here. The helper help/error paths and the existing local tests were rechecked.

## Evidence and limits

- Local Python rule/request tests: recorded in `TEST_RESULTS.txt`.
- Vite production build: recorded in `BUILD_RESULTS.txt`.
- Browser inspection: desktop marketplace layout, Hindi/Punjabi language switching and backend-unavailable state inspected. Mobile breakpoints are coded but not browser-verified. No authenticated browser lifecycle could run without PostgreSQL.
- PostgreSQL/PostGIS is not installed in the execution environment. Docker is excluded by owner instruction. System package installation failed due to environment permission limitations. No database concurrency or full booking lifecycle result is claimed.
- CI config is supplied but has not run on GitHub.
- No site was published, external account created, SMS sent or paid service activated.

“Implemented” below means source exists, not that a database integration test passed.

| Requirement | Current implementation | Remaining work |
|---|---|---|
| Phone + OTP; owner, renter or both | Persistent challenges; HMAC digests; 5-minute expiry; 5 attempts; phone/IP rate limits; server sessions | Live delivery and real-provider verification |
| Equipment type/rate/location | Owner listing form, backend validation, PostGIS location search; labeled demo seed | Edit/archive listing UI, uploads, verified equipment records, richer specs |
| Availability | Reserved/maintenance interval lists, buffer, owner maintenance blocks | Full day/week/month calendar, working-hour rules |
| Radius search default 5 km | Server PostGIS ST_DWithin; category/radius/location controls | Map tiles, directions, address/village geocoding |
| Conflict-free booking | Database GiST exclusions for machine and operator, idempotency lock/hash, maintenance serialized on machine row | Execute real PostgreSQL race and API tests; expose alternative slots |
| Owner acceptance/rejection | Explicit pending/approved/rejected/cancelled transitions and notifications | Pending-request expiry policy and unattended cleanup |
| Meter billing confirmed by OTP | Reading bound to challenge; owner/operator proposes, farmer confirms; final bill uses saved rate | Photo evidence, operational overrun rescheduling, manual recovery policy |
| Hourly and per-acre pricing | Decimal billing, estimate, start/end readings, completed acreage, mobilization | Taxes and any approved charge policies; no default commission |
| Bilateral reviews | One score/comment per author per completed booking, backend authorized | Aggregated/public review display and moderation |
| SMS notifications | Persistent in-app simulation records; development OTP provider boundary | Live adapter, transactional delivery worker/retries/provider callbacks |
| Offline | Cached searches; per-user local booking drafts; explicit submit/reconciliation | Full offline lifecycle E2E tests, storage quota/malformed cache recovery |
| Multilingual | English/Hindi/Punjabi navigation and discovery text | Most forms, status labels, errors and invoices still English; human language review |
| Manual payment statuses | Three required states; actor/time audit; both parties notified; never independently verified | Dispute-resolution workflow and permission policy review |
| Bills and history | Structured invoice endpoint, printable UI/PDF via browser, audit/history | Legally appropriate tax invoice treatment before commercial pilot |
| Owner/farmer financial summaries | Billed earnings/expenditure, separated from verified receipts | Trends, exports, partial manual payment reports if approved |
| Operator workspace | Assigned jobs appear under My bookings; meter submission; conflict protection | Explicit assignment acceptance/rejection, qualifications, compensation |
| FPO workspace | Manager-scoped organization creation, own fleet association, organization booking view | Membership, invitations, delegated permissions, multi-owner coordination |
| YantraLink | Exact permutation solver, max 8 approved jobs/one machine, fixed start commitments, service/buffer/travel feasibility | Road network, machine/attachment eligibility, breaks, multi-machine/OR-Tools model, approved rescheduling |
| Security | Backend ownership checks, strict cookie policy, origin/custom-header guard, parameterized SQL, OTP replay/attempt checks, audit | Security review, HTTPS deployment, upload protections once uploads exist, retention/cleanup |
| CI/deployment | Native startup helper, migration, synthetic seed, CI test/build config | Run native full stack/CI, approve hosting, configure real production secrets/adapters |
| Marketing/admin/support | Discovery page and basic help text | Public legal/support pages, verified testimonials, admin moderation and dispute screens |

## Deliberate engineering choices

- React/Vite rather than Next.js: the current authenticated app uses a standalone FastAPI backend, and does not yet need server rendering. No external frontend runtime or paid service is required. Revisit SEO/SSR for the public site.
- PostgreSQL remains authoritative. SQLite and static JSON are not substituted for real booking persistence.
- Exact exhaustive route search is auditable at 8 jobs or fewer (at most 40,320 orderings). This is a bounded baseline, not a general fleet optimizer. Fixed commitments usually determine the viable order. Savings compare distance with separate depot trips; the baseline is not asserted to be an equally feasible full-day schedule.
- English forms are explicitly incomplete localization; a language selector alone does not satisfy the full multilingual requirement.
- Authentication uses synthetic numbers locally. Displaying development codes is not proof of mobile-number ownership.
- Cancellation has no implemented financial charge. Liability, refunds outside the platform and commercial cancellation terms have not been approved.

## Next verification gate

Start the native local services, run the database-backed test suite, fix any failures, and perform a two-session owner/farmer walkthrough. Until this gate passes, do not present the booking flow as fully verified or the package as hackathon-ready.

## Public landing and email authentication update

Added a public home page and a session gate that prevents mounting the dashboard before server verification. Added email OTP and Google Identity Services sign-in followed by email OTP, PostgreSQL identity migration 003, optional TLS SMTP delivery, expiry/attempt/replay protection, and email meter-code delivery. Existing phone accounts are preserved. Login no longer changes existing profile roles or names.

Validation for this update: 29 local tests passed; 13 PostgreSQL/PostGIS integration tests skipped because the test database is unavailable. Vite production build and git diff whitespace check passed. Desktop home page and direct `/dashboard` navigation inspected in the browser: unauthenticated navigation displayed sign-in, not the workspace. Backend-unavailable error state was visible. Mobile breakpoints are implemented but not browser-verified. Real SMTP delivery and Google account sign-in require owner configuration and were not tested. Native PostgreSQL installation was blocked by execution environment permissions. See AUTH_SETUP.md for activation and limitations.
