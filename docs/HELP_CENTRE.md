# Help Centre — November 13, 2026

Help & Support uses HelpCentre.jsx with local editorial content in helpContent.js, translated in English, Hindi and Punjabi. Search covers FAQ questions/answers and guide titles/instructions. Request data comes from authenticated PostgreSQL APIs; there are no sample tickets.

Migration 014 extends existing support_cases and content_reports tables. It adds optional booking/listing links, ticket subjects, retry keys, five staff-controlled statuses, and private normalized JPEG evidence. Up to three input photos per request, 1 MB each, JPEG/PNG/WebP only; existing image normalization removes metadata and limits pixels/output. Run `python dev.py init` before deploying this backend. Applied locally; not deployed remotely.

Support and report creation retain per-user throttles. Request keys make network retries return the original record. Reporters see only their own data; authorized staff are selected by the existing ADMIN_USER_IDS environment variable. Staff can review evidence, reply to support tickets and change statuses. No automatic resolution or response-time guarantee. Closed/resolved tickets require staff reopening for replies. Histories paginate in groups of ten.

The Help Centre no longer displays saved equipment, demand requests, FPO assistance, rental groups, photo preferences, account ID, reminders or fleet statistics. Existing APIs/tables/components are retained. Saved Equipment remains accessible through its current dashboard shortcut/navigation. No new settings/community pages were created.

Validation: 11 existing support/operations integration tests and 2 new Help Centre integration tests passed on isolated PostgreSQL schemas. They exercise general requests, real persistence/history, idempotency, private image access, invalid uploads/subjects, staff status changes and pagination. Browser checked FAQ search/highlighting, accordion expansion, Hindi/Punjabi switching, request form, and mobile overflow. Tests create tickets in disposable schemas rather than the signed-in user's history. Frontend production build passed.

Payments remain manual/off-platform. No payment processing or automatic refunds were added.
