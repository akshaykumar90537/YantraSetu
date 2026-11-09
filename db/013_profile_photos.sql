ALTER TABLE users ADD COLUMN profile_photo_version uuid;
CREATE TABLE profile_photos (
 user_id uuid PRIMARY KEY REFERENCES users(id),
 image bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_versions(version) VALUES(13);
