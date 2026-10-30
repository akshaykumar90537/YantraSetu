ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ADD COLUMN email text;
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN google_sub text UNIQUE;
CREATE UNIQUE INDEX users_email_unique ON users(lower(email)) WHERE email IS NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_identity_required CHECK(phone IS NOT NULL OR email IS NOT NULL);
ALTER TABLE users ADD CONSTRAINT users_email_normalized CHECK(email IS NULL OR email=lower(email));
INSERT INTO schema_versions(version) VALUES (3);
