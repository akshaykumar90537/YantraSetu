CREATE TABLE booking_contacts (
    booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    phone text NOT NULL CHECK (phone ~ '^\+91[6-9][0-9]{9}$')
);
INSERT INTO schema_versions(version) VALUES (6);
