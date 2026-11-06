# Landing page, email and Google authentication

Visitors see the public home page at `/`. `/login` displays sign-in. `/dashboard` and any other direct application URL require a successful server `/api/me` response before the workspace mounts. The server still independently checks its HTTP-only session cookie for private data and actions. Expired-session responses clear the mounted workspace. There is no browser-storage login flag.

## Apply the update

From the project root, using the existing native environment:

```sh
python -m pip install -r backend/requirements.txt
python dev.py init
```

Then run the backend and frontend as described in README.md. Migration 003 preserves existing phone accounts and makes phone optional while adding unique email/Google identities. Back up a real database before migration. PostgreSQL/PostGIS remains required. No Docker or payment service is added.

## Email delivery

Set these values in the ignored project-root `.env` or your deployment's secret manager. Never commit credentials or paste passwords into chat.

```dotenv
EMAIL_PROVIDER=smtp
SMTP_HOST=your-provider-host
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_FROM=your-authorized-sender@example.com
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
```

Use `SMTP_SECURITY=ssl` and port 465 if your provider requires implicit TLS. TLS certificate verification is always enabled. Obtain the host, sender authorization, and SMTP credentials from your chosen email provider. Provider quotas and account eligibility apply; this change does not subscribe to or purchase any email service. No live provider/account was configured during development.

`EMAIL_PROVIDER=disabled` is the safe default. `EMAIL_PROVIDER=development` enables explicit local simulation, returning a visible code without sending mail. Simulation is rejected outside `APP_ENV=development`. SMTP mode never returns the code, including when APP_ENV is development. Delivery errors do not create a usable challenge or user.

## Continue with Google

1. Create a Google Identity Services **Web application** client in your own Google Cloud project.
2. Configure its authorized JavaScript origins to match your frontend origin exactly (for local development, `http://localhost:5173`). Add your actual HTTPS origin when deploying.
3. Set `GOOGLE_CLIENT_ID` in the backend environment. Restart the backend. The frontend reads the public client ID from `/api/auth/config`; no client secret is needed for this flow. Authorize `http://127.0.0.1:5173` as well if using that local address.
4. Click Continue with Google and select your account. Gmail and verified Workspace identities open the dashboard directly. Previously linked identities also sign in directly. First-time linking of other email providers requires an email code to verify current mailbox ownership.

The backend verifies Google's signature, audience, issuer and expiry using google-auth, checks verified email and a cookie-bound nonce, and persists nonce replay protection. Existing email profiles retain their names and roles. Google accounts are matched by their stable subject first, then linked to the same normalized email after ownership verification. Existing phone-only accounts remain separate; automatic phone/email merging is unsupported.

## Email and password (6 November 2026)

Apply migration 005 with `python dev.py init`. New email users choose Create account, verify their email code, and set a password of 12–128 characters. Returning users enter email and password. Existing OTP-only users choose Set or reset password once; verified recovery updates the same account and preserves its name, roles, bookings and equipment. Password changes revoke older sessions. Repeated registration with an existing email also reuses that profile after mailbox verification.

Passwords use salted PBKDF2-SHA256 hashes with 600,000 iterations in a separate credential table, never returned in user responses. Password attempts are rate-limited by email and IP. Recovery codes expire after five minutes and are single-use. The existing email OTP API remains compatible.

Local verification: 61 backend tests passed against PostgreSQL, including password login/recovery, account reuse, preserved owner roles, Google direct sessions and nonce replay rejection. Frontend production build passed. Google token responses and email delivery are test doubles in these tests; an actual Google account login has not been performed for this update.

Official setup and token validation references:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

## Persistence and security

Codes expire after five minutes, allow five failed attempts, and cannot be reused. Only keyed digests are stored. Requests are rate-limited by destination and client IP in PostgreSQL. Sessions last 24 hours; cookies are HTTP-only, SameSite Strict, and Secure outside development. Same-origin frontend/API deployment is required. Configure `FRONTEND_ORIGIN` exactly and use a strong private `OTP_SECRET`. Configure trusted proxy handling if deploying behind a proxy so rate limits use trustworthy client addresses.

Email-only renters receive meter-confirmation codes through email; existing phone accounts retain their previous phone workflow. Phone delivery remains a development simulation and is unavailable in production. Operator assignment by phone still requires a phone-based operator account. In-app booking notifications remain simulated and are not converted into live email notifications by this change.

## Verification

Run `python dev.py test` and `npm ci && npm run build` in frontend. Set `TEST_DATABASE_URL` to a disposable PostgreSQL/PostGIS database for database tests. Tests isolate their schemas and do not truncate public data. Test doubles cover delivery and Google responses; these are not evidence of a real email arriving or a real Google account logging in.

Before live use, configure your accounts privately and verify real inbox delivery, Google sign-in, logout, expired sessions, and an email-user booking/meter lifecycle on your chosen environment. No production deployment or live provider test was performed in this change.
