# Public portfolio release review

Review date **November 9, 2026**. Scope covers the application, PostgreSQL schema,
local runtime, source confidentiality, and repository automation. The AWS design
was reviewed and validated locally at the configuration level.

## Checks

| Check | Observed result |
| --- | --- |
| Backend | 18 tests passed with Testcontainers and 18 passed with native PostgreSQL 17.11. Maven build, Spotless, Flyway and Hibernate validation passed. |
| Frontend | 12 tests passed. ESLint, Prettier, TypeScript and Vite build passed. |
| Browser workflows | 6 Playwright tests passed on Compose and 6 on native, covering desktop Chromium and an emulated phone. |
| Live runtime | Four configured Compose health checks passed. Prometheus readiness, probe and JVM metrics, and live API smoke checks passed. |
| Persistence | The previous Docker database upgraded from V1 to V2. Existing records survived, and the 254-character session principal column accepted sign-in with a long email. Verification volumes were retained. |
| Dependencies | npm audits found zero vulnerabilities in the frontend and local tooling. OSV returned zero advisory matches across 124 runtime Maven coordinates. |
| Infrastructure | Terraform format, locked provider initialization and validation passed. Compose cloud configuration and Caddy validation passed locally. |
| Workflow safety | Active CI and dependency-scan workflows are read-only and passed actionlint. The AWS deployment template remains outside the active workflow directory. |
| Source confidentiality | Gitleaks and the source guard found no secrets. Staged paths, ignore rules, screenshots and PNG metadata passed review. |

See [runtime evidence](VERIFICATION.md), [the threat model](SECURITY.md), and
[hosted workflow runs](https://github.com/elilovescoding/opsatlas/actions/workflows/ci.yml).

## Security changes

- Check the current database role on authenticated requests. Reject and invalidate
  stale sessions that could have been saved concurrently with operator revocation.
- Widen the JDBC session principal column through Flyway V2. Reject overlength
  BCrypt inputs during login before authentication, using the standard 401 response.
- Rate-limit new anonymous CSRF sessions independently from login and registration.
- Patch operating-system packages in the container builds. Use a maintained Temurin
  runtime and a smaller Nginx image. Remove unused package managers from the demo
  runtime and use Alpine's `su-exec` for PostgreSQL entrypoint privilege dropping.
- Pin third-party Actions to commit SHAs, disable checkout credential persistence
  and restrict hosted browser artifacts to screenshots of synthetic test runs.
- Keep secrets, environment files, database artifacts, Git metadata and generated
  outputs outside the source export. The five application screenshots show local
  fixtures and synthetic QA records. Repository source uses the approved MIT license.

## Image scan triage

Docker Scout scanned the final Linux/amd64 runtime images for critical and high
severity findings. It reported no critical findings in the running filesystem of
any reviewed image. The backend and demo images reported zero critical or high
findings. The PostgreSQL layered scan still inventories the upstream Go helper in
its base layer. In the merged filesystem that path resolves to `su-exec`, and a
separate scan of the exported filesystem reported zero critical findings.

Scout reported CVE-2026-107891 against Alpine's `musl` 1.2.6-r3. Alpine's
[v3.24 security database](https://secdb.alpinelinux.org/v3.24/main.json) marks
that exact stable revision fixed. The PostgreSQL image still reports an upstream
high-severity libxml2 finding. The application sends no XML to PostgreSQL, and
the database stays on an internal network without a published port.

Prometheus was updated to 3.16.0. Its remote-read advisory is fixed in a prior
release according to the [maintainer advisory](https://github.com/prometheus/prometheus/security/advisories/GHSA-8rm2-7qqf-34qm).
The optional loopback-bound service still reports a high Go HTML-parser dependency
finding. The Caddy overlay image has high-severity upstream Go dependency findings.
Reassess those packages before exposing a deployment beyond local verification.

## Scope limits

OpsAtlas serves a single trusted team. Rate limiting is process-local and
proxy callers share a bucket. Requests authorized before a role revocation
may complete. MFA, account recovery, multi-team isolation, and general-purpose
URL monitoring are outside the implementation.

AWS provisioning, hosted TLS/DNS, SSM, live cloud logs and off-host recovery were
outside this review. No AWS resources were provisioned. The optional OWASP/NVD
workflow, native JDK vulnerability scan, penetration testing and load testing were
outside the executed checks.

## Source-only review export

Run `./scripts/create-review-zip.ps1` from the checkout to write an ignored ZIP
and SHA-256 manifest under `.review/`. The export uses the intended source
inventory and verifies each archived file against its source hash.
