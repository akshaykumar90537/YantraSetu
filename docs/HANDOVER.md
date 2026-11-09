# OTP pickup and return evidence

The owner or assigned operator submits the pickup/return reading while signed in. The renter separately reviews the immutable submission and confirms it using the OTP sent to their registered contact. Submission records the owner/operator identity; OTP confirmation records the renter identity and timestamp. This is not two independently delivered OTPs or an independent inspection.

Each stage supports condition notes and up to three JPEG/PNG/WebP photos (1 MB each). Photos are normalized to JPEG with metadata removed and stored in PostgreSQL. Authenticated booking participants alone can view them. Existing support cases can reference the booking; this increment does not grant new staff access to private photos.

Return submissions can include up to ten positive, itemized one-time additional charges. They are shown before confirmation and saved into the final invoice only when the renter confirms. Rates and quantities retain the existing server calculations; additional charges are not multiplied by rental duration. There is no payment gateway or verified payment collection.

Codes expire after five minutes and lock after five incorrect attempts. A new submission supersedes the previous code for that booking. A delivery failure rolls back the new submission and leaves an existing valid code usable. Used codes cannot be replayed. Confirmed records have no editing endpoint. Unconfirmed and superseded records remain distinguishable in the booking evidence history.

Delivery: registered email is preferred when present, using the existing configured SMTP adapter. Live inbox delivery has not been verified in this task, and previously deferred email-service setup is not resolved by this feature. Phone-only verification is development simulation; production rejects it while live SMS is unconfigured. No development OTP is represented as live SMS.

Migration 011_handover_evidence.sql is required before running this backend; applied locally with python dev.py init. Changes have not been pushed or deployed. Older completed rentals retain their invoices but do not acquire fabricated handover evidence.

Validation: PostgreSQL integration tests cover the complete pickup/return flow, timestamps/identities, private normalized photos, one-time charge totals, replay, replacement, expiry, failed-attempt lockout, delivery rollback, email preference and invalid charges. Email delivery is mocked in these tests. Frontend production build passes; authenticated production lifecycle testing is not performed.
