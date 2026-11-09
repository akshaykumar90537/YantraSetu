# Community and support feature coverage

## Implemented

- Safety and rental guides explain booking approval, pickup/return OTP review, meter readings, optional condition evidence, charges, rescheduling, incident reporting and listing reports. These are editorial instructions, not simulated records or machinery-specific training.
- Booking-linked help existed in My bookings. Community & support now also lets participants choose from their actual bookings and submit a private case.
- Support tracking shows the booking equipment, case ID, creation/update times, current status and latest resolution. Reporter/staff replies and staff status changes are retained in support_messages. Only the reporter and authorized staff can read the conversation; another participant in the same booking cannot read it automatically. Resolved conversations are read-only until staff reopen the case.
- Listing reports are available on equipment cards and in Community & support. Reports support scam, misleading, unsafe, abusive and other reasons. Only the reporter and configured staff can access them. Staff can record a review outcome and use the existing moderation controls when restriction is appropriate. Reporting alone never removes a listing. General community posts do not exist, so reporting currently targets equipment listings.
- Unavailable-equipment requests already persisted village, category, needed date and private notes. They remain connected to the real database, with owner-visible aggregate totals and farmer-owned closure. An unauthorized closure now returns an error instead of misleading success. Direct offers/chat are not implemented; requests are not reservations.

## Deployment and verification

Apply migration 012_support_reports.sql before the updated backend. It is applied locally. Configure authorized staff through ADMIN_USER_IDS; without a staff operator no real person is guaranteed to answer cases. Notifications are in-app, not promised SMS/email delivery.

Targeted PostgreSQL tests passed for private support conversations, retained status history, staff authorization, report duplicates, invalid report input, request ownership, future dates and privacy. Frontend production build passed. Public production workflows have not been tested in this increment. The separate localhost:5174 QA fixture is not the database-backed app and must not be used as evidence of production persistence.

No sample tickets, demand requests, reviews or staff replies are inserted into production. Static guide text, categories and status enumerations are intentional product definitions.
