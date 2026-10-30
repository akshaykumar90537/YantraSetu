CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS schema_versions(version int PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (
 id uuid PRIMARY KEY, phone text UNIQUE NOT NULL, name text NOT NULL,
 roles text[] NOT NULL DEFAULT ARRAY['farmer'], language text NOT NULL DEFAULT 'en',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions(token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users, expires_at timestamptz NOT NULL);
CREATE TABLE challenges (
 id uuid PRIMARY KEY, phone text NOT NULL, purpose text NOT NULL, digest text NOT NULL,
 payload jsonb NOT NULL, attempts int NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL,
 consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_phone_time ON challenges(phone,created_at DESC);
CREATE TABLE rate_limits (bucket text PRIMARY KEY, attempts int NOT NULL, started_at timestamptz NOT NULL);
CREATE TABLE organizations(id uuid PRIMARY KEY, manager_id uuid NOT NULL REFERENCES users, name text NOT NULL);
CREATE TABLE machines (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users, organization_id uuid REFERENCES organizations,
 name text NOT NULL, category text NOT NULL, description text NOT NULL DEFAULT '',
 village text NOT NULL, location geography(Point,4326) NOT NULL,
 rate numeric(12,2) NOT NULL CHECK(rate>0), unit text NOT NULL CHECK(unit IN ('hour','acre')),
 mobilization numeric(12,2) NOT NULL DEFAULT 0 CHECK(mobilization>=0),
 buffer_minutes int NOT NULL DEFAULT 15 CHECK(buffer_minutes BETWEEN 0 AND 180),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX machines_location ON machines USING gist(location);
CREATE TABLE bookings (
 id uuid PRIMARY KEY, machine_id uuid NOT NULL REFERENCES machines,
 farmer_id uuid NOT NULL REFERENCES users, operator_id uuid REFERENCES users,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
 reserved_until timestamptz NOT NULL, quantity numeric(12,3) NOT NULL CHECK(quantity>0),
 latitude double precision NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude double precision NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','IN_PROGRESS','COMPLETED','REJECTED','CANCELLED')),
 rate numeric(12,2) NOT NULL CHECK(rate>0), unit text NOT NULL CHECK(unit IN ('hour','acre')),
 mobilization numeric(12,2) NOT NULL, estimate numeric(12,2) NOT NULL,
 meter_start numeric(12,3), meter_end numeric(12,3), actual_quantity numeric(12,3), final_total numeric(12,2),
 payment_status text NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID','PAID_OUTSIDE_PLATFORM','PAYMENT_DISPUTED')),
 payment_reported_by uuid REFERENCES users, payment_reported_at timestamptz,
 idempotency_key uuid NOT NULL, request_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farmer_id,idempotency_key), CHECK(end_at>start_at), CHECK(reserved_until>=end_at),
 EXCLUDE USING gist(machine_id WITH =, tstzrange(start_at,reserved_until,'[)') WITH &&)
 WHERE(status IN ('PENDING','APPROVED','IN_PROGRESS')),
 EXCLUDE USING gist(operator_id WITH =, tstzrange(start_at,reserved_until,'[)') WITH &&)
 WHERE(operator_id IS NOT NULL AND status IN ('PENDING','APPROVED','IN_PROGRESS'))
);
CREATE TABLE maintenance (
 id uuid PRIMARY KEY, machine_id uuid NOT NULL REFERENCES machines,
 start_at timestamptz NOT NULL,end_at timestamptz NOT NULL, reason text NOT NULL,
 CHECK(end_at>start_at)
);
CREATE TABLE ratings (
 booking_id uuid NOT NULL REFERENCES bookings, author_id uuid NOT NULL REFERENCES users,
 target_id uuid NOT NULL REFERENCES users, score int NOT NULL CHECK(score BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '', PRIMARY KEY(booking_id,author_id)
);
CREATE TABLE notifications (
 id bigserial PRIMARY KEY, user_id uuid NOT NULL REFERENCES users,
 message text NOT NULL, delivery text NOT NULL DEFAULT 'SIMULATED_NOT_SENT', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE audit_log (
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES users, booking_id uuid REFERENCES bookings,
 action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_versions(version) VALUES (1);
