-- 004_delist_and_constraints.sql: Equipment delisting/reactivation, model attribute, and mandatory field constraints

-- 1. Add is_active column if not present, sync with active
ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE machines SET is_active = active WHERE is_active IS NOT NULL;

-- 2. Add machine model column
ALTER TABLE machines ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'Standard';

-- 3. Check constraints for numeric bounds
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_rate_positive') THEN
        ALTER TABLE machines ADD CONSTRAINT machines_rate_positive CHECK (rate > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_buffer_nonnegative') THEN
        ALTER TABLE machines ADD CONSTRAINT machines_buffer_nonnegative CHECK (buffer_minutes >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_mobilization_nonnegative') THEN
        ALTER TABLE machines ADD CONSTRAINT machines_mobilization_nonnegative CHECK (mobilization >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'machines_fuel_rate_nonnegative') THEN
        ALTER TABLE machines ADD CONSTRAINT machines_fuel_rate_nonnegative CHECK (fuel_rate_extra >= 0);
    END IF;
END $$;

INSERT INTO schema_versions(version) VALUES (4) ON CONFLICT (version) DO NOTHING;
