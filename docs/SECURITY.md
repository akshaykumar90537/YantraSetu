# Development security notes

Implemented controls: parameterized SQL; least-privilege endpoint checks; tenant-manager checks; immutable booking rate snapshots; expiring, bounded-attempt HMAC OTPs; one-time challenge consumption; token digests; cookie sessions; strict-origin/custom-header state changes; notification/audit persistence; explicit development-only guard; loopback-only development servers; no hardcoded production secrets.

Important limitations: no external security audit, no real SMS, no verified identity, no production deployment, no encryption of browser offline drafts, no cleanup worker for expired challenges/sessions, no uploaded evidence, no abuse monitoring beyond basic rate limits, no full browser E2E suite. Rate-limit IP keys currently use the direct client address; configure trusted proxy handling carefully before real deployment. A reverse proxy may make multiple clients share that address.

The development OTP response intentionally exposes its code for local tests. Never publicly deploy that mode or market it as verified phone ownership. Do not enter real personal data into the preview.

No blanket admin endpoint exists. FPO self-registration cannot grant access to another manager's organization. Machine public locations are owner-provided listing locations; exact private farm coordinates are protected with booking-party checks.

Before production: verify integration/concurrency tests, review all authorization paths, replace SMS adapter, handle delivery failures/retries, add retention policy and housekeeping, decide business terms, configure HTTPS and secrets, test backup/restore and migration upgrades, then perform a separate deployment review.
