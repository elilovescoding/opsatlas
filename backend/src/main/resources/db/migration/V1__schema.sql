CREATE TABLE roles (name varchar(16) PRIMARY KEY CHECK (name IN ('VIEWER','OPERATOR','ADMIN')));
INSERT INTO roles VALUES ('VIEWER'),('OPERATOR'),('ADMIN');
CREATE TABLE users (
 id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
 display_name varchar(80) NOT NULL, password_hash varchar(100) NOT NULL,
 role varchar(16) NOT NULL REFERENCES roles(name), created_at timestamptz NOT NULL
);
CREATE TABLE services (
 id uuid PRIMARY KEY, name varchar(80) NOT NULL, description varchar(1000) NOT NULL,
 environment varchar(16) NOT NULL CHECK (environment IN ('DEVELOPMENT','STAGING','PRODUCTION')),
 owner varchar(80) NOT NULL, archived boolean NOT NULL DEFAULT false,
 public_visible boolean NOT NULL DEFAULT false, demo boolean NOT NULL DEFAULT false,
 health_target varchar(24) NOT NULL CHECK (health_target IN ('NONE','DEMO_API','DEMO_QUEUE','DEMO_STORAGE')),
 health_state varchar(16) NOT NULL CHECK (health_state IN ('UNKNOWN','HEALTHY','DEGRADED','UNAVAILABLE')),
 response_ms bigint CHECK (response_ms >= 0), checked_at timestamptz,
 created_at timestamptz NOT NULL, version bigint NOT NULL DEFAULT 0,
 UNIQUE (name, environment)
);
CREATE INDEX services_active ON services(environment, name) WHERE NOT archived;
CREATE TABLE deployments (
 id uuid PRIMARY KEY, service_id uuid NOT NULL REFERENCES services(id), version varchar(80) NOT NULL,
 environment varchar(16) NOT NULL CHECK (environment IN ('DEVELOPMENT','STAGING','PRODUCTION')),
 status varchar(16) NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED','ROLLED_BACK')),
 notes varchar(2000) NOT NULL, created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL
);
CREATE INDEX deployments_service_time ON deployments(service_id,created_at DESC);
CREATE TABLE incidents (
 id uuid PRIMARY KEY, title varchar(160) NOT NULL, severity varchar(8) NOT NULL CHECK (severity IN ('SEV1','SEV2','SEV3','SEV4')),
 status varchar(16) NOT NULL CHECK (status IN ('INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),
 assignee varchar(80) NOT NULL, deployment_id uuid REFERENCES deployments(id),
 root_cause varchar(4000) NOT NULL DEFAULT '', resolution varchar(4000) NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL,
 resolved_at timestamptz, version bigint NOT NULL DEFAULT 0,
 CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL)),
 CHECK (status <> 'RESOLVED' OR (length(trim(root_cause)) > 0 AND length(trim(resolution)) > 0))
);
CREATE INDEX incidents_status_time ON incidents(status,created_at DESC);
CREATE TABLE incident_services (
 incident_id uuid NOT NULL REFERENCES incidents(id), service_id uuid NOT NULL REFERENCES services(id),
 PRIMARY KEY (incident_id,service_id)
);
CREATE INDEX incident_services_service ON incident_services(service_id);
CREATE TABLE incident_updates (
 id uuid PRIMARY KEY, incident_id uuid NOT NULL REFERENCES incidents(id),
 message varchar(4000) NOT NULL, status varchar(16) NOT NULL,
 author_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL
);
CREATE INDEX incident_updates_timeline ON incident_updates(incident_id,created_at);
CREATE TABLE health_results (
 id uuid PRIMARY KEY, service_id uuid NOT NULL REFERENCES services(id),
 state varchar(16) NOT NULL CHECK (state IN ('HEALTHY','DEGRADED','UNAVAILABLE')),
 response_ms bigint NOT NULL CHECK (response_ms >= 0), http_status integer,
 checked_at timestamptz NOT NULL
);
CREATE INDEX health_results_service_time ON health_results(service_id,checked_at DESC);
CREATE INDEX health_results_retention ON health_results(checked_at);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, actor varchar(254) NOT NULL, action varchar(40) NOT NULL,
 resource_id uuid, detail varchar(300) NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX audit_events_time ON audit_events(created_at DESC);

-- Spring Session JDBC schema, managed by Flyway rather than application startup.
CREATE TABLE spring_session (
 primary_id char(36) PRIMARY KEY, session_id char(36) NOT NULL UNIQUE,
 creation_time bigint NOT NULL, last_access_time bigint NOT NULL,
 max_inactive_interval integer NOT NULL, expiry_time bigint NOT NULL, principal_name varchar(100)
);
CREATE INDEX spring_session_expiry ON spring_session(expiry_time);
CREATE INDEX spring_session_principal ON spring_session(principal_name);
CREATE TABLE spring_session_attributes (
 session_primary_id char(36) NOT NULL REFERENCES spring_session(primary_id) ON DELETE CASCADE,
 attribute_name varchar(200) NOT NULL, attribute_bytes bytea NOT NULL,
 PRIMARY KEY (session_primary_id,attribute_name)
);
