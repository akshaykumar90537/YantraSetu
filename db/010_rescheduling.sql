ALTER TABLE machines ADD COLUMN operator_rate_extra numeric(12,2) CHECK(operator_rate_extra>=0);
ALTER TABLE bookings ADD COLUMN operator_extra numeric(12,2) NOT NULL DEFAULT 0 CHECK(operator_extra>=0);
ALTER TABLE bookings ADD COLUMN operator_included boolean NOT NULL DEFAULT false;
CREATE TABLE booking_reschedules (
 id uuid PRIMARY KEY, booking_id uuid NOT NULL REFERENCES bookings,
 proposer_id uuid NOT NULL REFERENCES users,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL,
 original_start_at timestamptz NOT NULL,original_end_at timestamptz NOT NULL,
 quantity numeric(12,3) NOT NULL,estimate numeric(12,2) NOT NULL,
 reason text NOT NULL,status text NOT NULL DEFAULT 'PENDING'
 CHECK(status IN ('PENDING','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),responded_at timestamptz,
 CHECK(end_at>start_at)
);
CREATE UNIQUE INDEX booking_one_pending_reschedule ON booking_reschedules(booking_id) WHERE status='PENDING';
INSERT INTO schema_versions(version) VALUES(10);
