# YantraSetu engineering instructions

Current scope is a zero-paid-service hackathon development build. This file takes precedence over historical product documents for payment/subscription scope.

- No payment gateways (including sandbox), merchant credentials, online collection, wallets, automatic settlements, subscriptions or paywalls.
- Preserve rental rates, accurate hourly/acre billing, meter verification, invoices, audit history and manually reported outside-platform payment states.
- Never label a manual report as independently verified payment or a simulated OTP as real SMS delivery.
- Prefer free/open-source local tools. Ask the project owner before any account-dependent or paid integration; present current costs/limits and a free alternative. Never request secrets in chat.
- Keep PostgreSQL/PostGIS as authoritative booking storage; do not silently substitute SQLite/static data to bypass test limitations.
- Use both database-level machine/operator exclusions and transactional API checks. Persist idempotency/replay protection.
- Run available tests, record skipped integration checks honestly, and never claim a feature is verified just because code exists.
- Current source is a development increment, not completion of every requirement. Read docs/STATUS.md and docs/EXTERNAL_SERVICES.md before extending it.
- Docker and container-based development are excluded from the current scope. Use native Python, Node.js and PostgreSQL/PostGIS. Local servers must bind to loopback. Do not deploy publicly with the development OTP adapter. Ask the owner for the deployment environment and authorization before production deployment.
- Ordinary reversible engineering decisions do not need owner approval. Continue independent work when external services are blocked.
