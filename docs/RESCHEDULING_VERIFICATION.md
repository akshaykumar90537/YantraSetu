# Dashboard, rescheduling and transparent pricing — 9 November 2026

Implemented locally, not deployed by this task.

- Farmer next-rental card uses saved booking status, estimate and authorized owner contact. Owner cards use pending requests, current rentals and upcoming returns.
- Either booking participant may propose new dates for an approved, unstarted rental. Only the other participant accepts/rejects; the proposer can withdraw. Existing dates remain reserved until acceptance. Proposed dates are not reserved. Acceptance checks machine/operator overlap and maintenance again, under locks and database exclusions.
- Prices use booking snapshots, not subsequently edited listing rates. Hourly estimates change with duration; per-acre quantity remains the booked acreage. Operator charges are owner-entered: null means unspecified, zero means included. Fuel and attachment prices are entered by the owner. Final meter billing and invoices include the agreed operator charge.
- Reviews are fetched from completed bookings; no fake five-star fallback. Review counts and author feedback come from database records.

Validation: 74 backend tests passed against PostgreSQL, including proposal authorization, competing reservations, maintenance, operator conflicts, saved pricing, meter completion and final invoice totals. Frontend production build and four village-search tests passed. Browser component checks with explicitly synthetic responses confirmed proposal acceptance rendering, review details and zero meter display; these checks were not production end-to-end tests. Temporary browser fixtures were removed.

Migration: db/010_rescheduling.sql applied to local development database. Apply migrations with python dev.py init before serving the updated backend on another environment. No public deployment or real outbound email delivery was tested here.
