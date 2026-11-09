CREATE TABLE rental_handover_records (
 id uuid PRIMARY KEY REFERENCES challenges(id),
 booking_id uuid NOT NULL REFERENCES bookings(id),
 submitted_by uuid NOT NULL REFERENCES users(id),
 confirmed_by uuid REFERENCES users(id),
 stage text NOT NULL CHECK(stage IN ('start','end')),
 detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz
);
CREATE UNIQUE INDEX rental_confirmed_stage ON rental_handover_records(booking_id,stage) WHERE confirmed_at IS NOT NULL;
CREATE TABLE rental_evidence_photos (
 id uuid PRIMARY KEY, record_id uuid NOT NULL REFERENCES rental_handover_records(id),
 image bytea NOT NULL
);
ALTER TABLE bookings ADD COLUMN additional_charges jsonb NOT NULL DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN additional_total numeric(12,2) NOT NULL DEFAULT 0 CHECK(additional_total>=0);
INSERT INTO schema_versions(version) VALUES(11);
