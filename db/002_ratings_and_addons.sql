-- 002_ratings_and_addons.sql: Ratings badges, machine attachments, and fuel add-on selection

-- 1. Ratings enhancements: punctuality, badges, and creation timestamp
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS punctuality int CHECK (punctuality BETWEEN 1 AND 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS badges text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 2. Machine enhancements: attachments catalog and fuel policy
ALTER TABLE machines ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS fuel_included boolean NOT NULL DEFAULT false;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS fuel_rate_extra numeric(12,2) NOT NULL DEFAULT 0 CHECK (fuel_rate_extra >= 0);

-- 3. Booking enhancements: selected attachments and fuel add-on
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS selected_attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_included boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fuel_extra numeric(12,2) NOT NULL DEFAULT 0 CHECK (fuel_extra >= 0);

INSERT INTO schema_versions(version) VALUES (2) ON CONFLICT (version) DO NOTHING;

