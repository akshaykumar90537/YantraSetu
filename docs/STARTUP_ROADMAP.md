# YantraSetu startup-readiness work

Requested sequence, 7 November 2026. Items remain open until implementation and validation are complete. No paid services, online payment collection, or automatic settlements are in scope.

- [x] Owner location confirmation: remove default coordinates, clear stale coordinates on village edits, choose lookup results explicitly, confirm coordinates before save. Build and isolated browser form checks passed.
- [ ] Email recovery: paused at the user's request; Render Free SMTP delivery remains unavailable. Requires an approved HTTPS provider and sender setup.
- [x] Actual equipment photos, condition, horsepower and transport details; bounded PostgreSQL storage and image validation.
- [x] Booking progress and clear next actions; travel/arrival status reflects owner or assigned-operator updates.
- [x] Request expiry, cancellation reasons and transactional release of reservations.
- [x] In-app booking reminders, deduplication, read status and reminder preferences. Request-time maintenance plus an optional one-pass CLI.
- [x] Breakdown, delay and billing/safety reporting linked to bookings; private case history.
- [x] Admin moderation, environment-configured staff permissions and case response workflow. Live staff assignment remains a deployment step.
- [x] Native backup tooling, tested isolated-schema restore and safe request-reference error logging.
- [ ] Production recovery drill and unattended backup schedule. Whole-database restore verification needs CREATEDB privileges, unavailable to the local application role.
- [x] Hindi/Punjabi labels and consent text for new forms, labeled controls, and opt-in equipment photo loading.
- [ ] Native-speaker copy review, remaining English dynamic messages and complete mobile cross-role accessibility walkthrough.
- [x] Farmer next-rental view, saved equipment, repeat booking and cost explanations; server rejects altered attachment prices.
- [x] Owner action queue and existing fleet calendar, readiness checklist and completed-rental utilization reporting.
- [x] Unmet equipment demand by village, with aggregated public counts and private farmer notes.
- [x] Consent-based FPO assisted bookings with seven-day grants, revocation and audit records.
- [x] Group rental requests with separate conflict-checked slots and individual cost records; leaving stops sharing the farmer's rentals with that group.
- [x] Staff pilot metrics: acceptance, response time, completion, cancellations, support cases and repeat requests.

The checklist is not a claim of production readiness. Deployment and external-account setup must be verified separately.

Implementation and release instructions: [PILOT_OPERATIONS.md](PILOT_OPERATIONS.md). No production deployment or new external account was activated. Email work remains paused.
