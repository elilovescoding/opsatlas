# OpsAtlas implementation plan

Build a single-team operations console with Java 21 / Spring Boot 4.1, PostgreSQL
17, React 19 / TypeScript, Flyway, JPA, server-side sessions, CSRF and role checks.
Registration creates viewers; an environment-bootstrap administrator grants access.
Monitoring uses named, fixed demonstration targets; API users cannot submit URLs.

1. Inspect environment and dependency compatibility, establish local tooling.
2. Implement schema, identity, service registry, deployments, incidents/timeline,
   audit, dashboard aggregation, public status, health checks and retention.
3. Implement responsive frontend with real API mutations and loading/error states.
4. Add Docker Compose, deterministic demo targets, development scripts and metrics.
5. Validate Terraform for a small EC2 host, encrypted EBS, SSM and scoped logs.
6. Add CI, test with real PostgreSQL, exercise browser workflows, capture screenshots.
7. Finish security/architecture/runbooks, evidence, resume bullets and handoff.

Acceptance: negative auth/CSRF/RBAC/validation tests; health outcomes; incident
transitions and linked deployments; public data minimization; browser journeys;
build/static checks; Terraform fmt/validate; no secrets or unapproved publication.

Environment: Windows native verification uses Java 21, Node 24, portable Maven,
PostgreSQL 17, and Terraform. The Docker follow-up is recorded in [verification](VERIFICATION.md).
No GitHub operations or paid AWS resources are authorized during local development.
