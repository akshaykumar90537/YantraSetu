ALTER TABLE machines ADD COLUMN condition text NOT NULL DEFAULT 'Not specified';
ALTER TABLE machines ADD COLUMN horsepower integer CHECK(horsepower BETWEEN 1 AND 1000);
ALTER TABLE machines ADD COLUMN transport_available boolean NOT NULL DEFAULT false;
CREATE TABLE machine_photos (
 id uuid PRIMARY KEY,
 machine_id uuid NOT NULL REFERENCES machines ON DELETE CASCADE,
 image bytea NOT NULL CHECK(octet_length(image)<=300000),
 position integer NOT NULL CHECK(position BETWEEN 0 AND 2),
 UNIQUE(machine_id,position)
);
INSERT INTO schema_versions(version) VALUES(7);
