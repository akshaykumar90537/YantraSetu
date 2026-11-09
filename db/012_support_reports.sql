CREATE TABLE support_messages (
 id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES support_cases(id),
 author_id uuid NOT NULL REFERENCES users(id),is_staff boolean NOT NULL,
 body text NOT NULL CHECK(length(body) BETWEEN 3 AND 2000),
 status text,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_case ON support_messages(case_id,created_at);
CREATE TABLE content_reports (
 id uuid PRIMARY KEY,reporter_id uuid NOT NULL REFERENCES users(id),
 machine_id uuid NOT NULL REFERENCES machines(id),
 reason text NOT NULL CHECK(reason IN ('SCAM','MISLEADING','UNSAFE','ABUSIVE','OTHER')),
 description text NOT NULL CHECK(length(description) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_REVIEW','RESOLVED')),
 resolution text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX content_reports_open ON content_reports(reporter_id,machine_id) WHERE status!='RESOLVED';
INSERT INTO schema_versions(version) VALUES(12);
