# Engineering handoff and verification evidence

Docker, native, and release verification ran on **November 9, 2026**. See the
[release review](RELEASE_READINESS.md) for security changes and image scan findings.

## Implemented locally

Java 21 / Spring Boot 4.1.2 API, PostgreSQL/Flyway schema, BCrypt login/viewer
registration, JDBC sessions/CSRF/RBAC/rate limiting, registry/edit/archive,
scheduled fixed-target health observations/history, deployment lifecycle,
multi-service incidents with linked releases/timeline/resolution review, audit,
dashboard aggregates, public status projection, Actuator/Micrometer/JSON logging,
responsive dark/light React UI, Docker/Compose files, Terraform and an inert AWS delivery
workflow template, runbooks/security/API/schema documentation, and actual screenshots.

The native stack was launched at `http://127.0.0.1:5173`. Verification used
PostgreSQL 17.11 on loopback port 55432, Java 21.0.4, Node 24.22.1, Maven 3.9.11,
and installed Chrome through Playwright. Use a current Java 21 security patch for maintained use; native JDK
vulnerability scanning was not performed.

## Observed checks

| Check | Execution and result |
| --- | --- |
| Backend | Maven `spotless:check verify` passed with Testcontainers. `scripts/test-backend.ps1` passed against native PostgreSQL. Both final runs reported **18 tests, zero failures, errors, or skips**. |
| PostgreSQL | Real 17.11 database, Flyway validation/migration and Hibernate schema validation; separate `opsatlas_test` database; no H2 substitution |
| Backend coverage | 13 MockMvc/database integration tests, 2 health policy unit tests, 3 rate-limiter unit tests |
| Frontend | ESLint zero warnings, TypeScript/Vite production build, Prettier check |
| Frontend tests | **12 passing** Vitest/Testing Library component/API-client tests, including failure handling, duplicate submission, accessible labels and concurrent CSRF bootstrap |
| Browser | **6 passing** Playwright tests against Compose and **6 passing** against the native stack. Both runs covered desktop Chromium and emulated Pixel 7. |
| Live HTTP | Both stacks passed session rotation, authenticated requests, all three probe states, dashboard data, OpenAPI, Swagger redirect, Actuator metrics and readiness, and logout invalidation. |
| Frontend audit | November 9 npm audit reported **zero vulnerabilities**. |
| Backend audit | November 9 public OSV lookup reported **zero matches** across 124 resolved runtime Maven coordinates. |
| Terraform | fmt check, provider initialization (signed AWS 6.72.0), validate: **configuration valid** |
| Config/scripts | YAML syntax parsed for both Compose files, application/Prometheus config, and all workflows; Bash syntax checked for deploy/backup/user-data scripts |
| Source guard | `scripts/check-secrets.mjs`: no credential signatures or prohibited runtime/state artifacts in intended source; ignore checks pass |

The complete browser journey registers a service, records a release, links an
incident to it, resolves it with analysis fields, reloads to verify persistence,
archives the service, and reviews audit history. A second journey registers a
viewer, verifies hidden write controls and API 403, then signs out. A third checks
public read-only status and viewport fit. The desktop and phone variants both ran.

The local fixture service produces real ~750 ms responses and real HTTP 503s.
No simulated production CPU, traffic, users, uptime percentage, or cloud metrics
are invented. Health results are observed; incident/deployment examples are
explicitly labeled local exercises. Failed early test exercises were concluded
and archived through the actual API; their history was retained rather than erased.

## Docker Compose verification

The isolated project `opsatlas-verify-20261109` ran on Docker Desktop's Linux
engine 29.9.2 with Compose v5.6.1. It used generated test credentials and dedicated
named volumes. The host shell needed the per-user Docker bin directory on its
process PATH so Compose could find the Docker credential helper.

- `docker compose config --quiet` and `up --build --wait` passed with the
  observability profile. PostgreSQL, demo targets, Spring Boot and Nginx passed
  their Docker health checks. Prometheus returned HTTP 200 from `/-/ready`.
  All five containers reported zero unexpected restarts and no OOM kills.
- PostgreSQL 17.11 accepted an authenticated TCP connection with SCRAM-SHA-256
  host authentication. Flyway applied migration `V1` on the empty volume and
  recorded success in `flyway_schema_history`.
- Browser tests at `http://127.0.0.1:8088` exercised the built frontend through
  Nginx. They covered registration, login, viewer denial, service creation and
  archival, deployment recording, incident resolution, history, and public
  status. Additional API checks covered operator grants and revocations, session
  invalidation, and exclusion of private services from public status.
- The scheduled probe produced healthy, degraded, and unavailable fixture states.
  The dashboard returned measured latency and health observations. Prometheus
  reported `up{job="opsatlas"} = 1` and returned probe and JVM samples.
- A volume-preserving `down` followed by `up -d --no-build --wait` kept the
  migration version, service IDs and record counts. The snapshot included six
  services, two deployments, two linked resolved incidents, four incident
  updates and 31 audit events. Flyway validated the existing schema.
- Review of startup, workflow and recreation logs found no runtime errors.
  SpringDoc printed its enabled-endpoint notices. Alpine PostgreSQL reported
  unavailable system locales and local-socket trust during initialization.
  Network access used SCRAM-SHA-256, and the database port stayed internal.
- Final `docker compose down --timeout 30` removed the verification containers
  and networks. The PostgreSQL and Prometheus named volumes were confirmed present.
- The release build reapplied the browser journeys after rebuilding all four app
  and support images. Flyway applied `V2` to the preserved database, and Playwright
  signed in with an email longer than 100 characters.

## Screenshots and visual review

`frontend/e2e/capture.mjs` captures actual running software into:

- `screenshots/dashboard-desktop.png`
- `screenshots/dashboard-mobile.png`
- `screenshots/service-detail.png`
- `screenshots/incident-timeline.png`
- `screenshots/status-mobile.png`

Desktop, narrow viewport, dialog interaction, sidebar access, table containment,
and incident timeline were inspected. Tables scroll within their own panels on
small screens. Hidden accessible table text is positioned within its scrolling
container to prevent document-level overflow. Screenshots include the same real
database records exercised by the application, not a separate mock data renderer.
No exhaustive accessibility audit or cross-browser/device certification is claimed.

## Verification boundaries

- [Hosted CI runs](https://github.com/elilovescoding/opsatlas/actions/workflows/ci.yml)
  show the check results for each published commit.
- Terraform and Caddy passed local configuration checks. AWS provisioning, IAM,
  SSM, live TLS/DNS, cloud logs, and backup restoration remain unverified.
- The optional OWASP/NVD scan, native JDK vulnerability scan, penetration test,
  and load test were outside the completed checks.

## Scope limits

Single shared team; in-process auth rate limiter/shared proxy bucket; no verified
email, MFA, password recovery, deactivation UI, general URL monitoring, external
alert delivery, AWS inventory API, host-metric UI, distributed health scheduler,
high availability, or automated cloud restore. These are disclosed limitations
and future improvements, not placeholders represented as working features.

## Continue locally

Read `README.md`, `RUNBOOK.md`, `SECURITY.md` and `AWS.md`. Native start/stop works
with the local tools and ignored `.env`; open that file privately for generated
credentials. Test evidence/logs remain in ignored `.tools`, `.runtime`, and build
test-result directories. Browser traces can contain sessions/test passwords and
must not be published.
