CREATE TABLE user_passwords (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash text NOT NULL
);
INSERT INTO schema_versions(version) VALUES (5);
