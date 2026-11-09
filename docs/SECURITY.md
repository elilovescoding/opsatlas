# Security design and limits

## Threat model

Protect passwords/sessions, workspace integrity, private service metadata, the
database, and the monitoring host. Unauthenticated Internet users and malicious
low-privilege members are untrusted. The host administrator and environment
configuration are trusted. Operators intentionally share one team's operational
data; this is not tenant isolation or a safe public multi-organization SaaS.

| Threat | Implemented control | Remaining boundary |
| --- | --- | --- |
| Password theft | BCrypt cost 12, 12-character registration minimum, 72-byte UTF-8 cap, no hash projections | No MFA, recovery, breached-password service or verified email |
| Session theft/fixation | Spring Session JDBC, ID rotation on login, HttpOnly/SameSite Strict cookies, 30m idle expiry, logout invalidation | TLS mandatory outside loopback; no active-session UI |
| Cross-site request forgery | Session CSRF token on all mutations, including auth routes; no CORS permission | Token expires with the session; refresh and retry after expiry |
| Broken access control | Server-side operator method checks, admin URL checks, viewer-only signups | One shared workspace; operators are trusted editors |
| Stale privileges | Role changes revoke member sessions. Each authenticated request checks its session role against the database. Bootstrap admins are immutable through the role API. | Requests authorized before revocation may finish. No user deactivation workflow. |
| SQL injection | Bound JPA/JdbcTemplate parameters and fixed server-side SQL/sort | Database administrator remains privileged |
| XSS | React text escaping, no raw HTML, same-origin assets, Nginx CSP/security headers | Inline CSS permitted for chart sizing; dependencies still need review |
| SSRF | Enum keys, fixed literal-IP host/path mapping, no DNS/redirects/user headers, 2s connect/4s request timeout, discarded bodies | Local demo targets only; no general URL monitor |
| Auth abuse | Bounded 4096-bucket map, 20 login/registration attempts and 240 anonymous CSRF bootstraps per address per five minutes | In-process limiter resets on restart. Proxy callers share buckets. |
| Sensitive error leakage | Safe problem responses, no payload/password logging | Operators need server-side diagnostics; audit actors include member emails |
| Data corruption | DTO validation, FKs/checks/uniqueness, transaction/audit atomicity, locks | Single PostgreSQL host; backups are essential |
| Secret leakage | Ignored `.env`/runtime/state, blank examples, no secret Terraform variables, generated local passwords | Host root and database superuser can read secrets/session rows |

## Monitoring isolation

API callers cannot submit URLs, ports, paths, schemes, DNS names, or credentials.
Only the approved addresses 127.0.0.1 and 172.30.0.10 are accepted by startup and
target construction. This is stronger and simpler than denylisting private IP
ranges while still allowing arbitrary DNS. It intentionally limits functionality.
New production targets require an operator-reviewed code/configuration extension,
an egress policy, DNS pinning/validation if DNS is introduced, redirect review,
and tests before exposing URL-based configuration.

The AWS host requires IMDSv2, hop limit 1, no metadata tags, and a persisted
DOCKER-USER link-local block. The application has no AWS SDK credentials. The
host role can open SSM channels, write one log group, and read one release prefix;
it cannot read unrelated secrets or modify infrastructure.

## Deployment assumptions

Local native servers bind loopback. Compose exposes only the frontend on loopback;
PostgreSQL has no published host port. The cloud overlay exposes Caddy 80/443,
enforces secure cookies and HSTS, and removes the frontend host binding. Actuator
stays inside the container network. The host has no SSH ingress or SSH key pair.

Docker containers have memory limits and no-new-privileges; the app/demo/frontend
drop capabilities and use read-only filesystems with controlled tmpfs where
needed. Database and TLS containers need writable data. CloudWatch log retention
is 14 days; health retention is 30 days. Audit/session tables contain member
identity and should be treated as private data. Database backups contain sensitive
hashes and sessions even if the UI does not reveal them.

Do not expose native development servers to the Internet. Nginx bounds request
bodies to 64 KiB; native development does not have an equivalent byte-level JSON
body cap. The database account owns the schema for understandable local Flyway
migrations; splitting migration/runtime roles is a production hardening step.

## Recovery and bootstrap

Bootstrap creates an absent administrator from environment variables; it never
changes an existing account's password or role. Do not pre-register the intended
bootstrap email as a viewer. In that case, choose a fresh operator-controlled
bootstrap email and restart; it will create that administrator. Password rotation
for an existing account currently requires a reviewed administrative database
procedure with a correctly generated BCrypt hash and session revocation. There
is no UI reset feature, and changing `.env` does not reset a password.

## Security verification

Automated tests cover anonymous/viewer denial, CSRF omission, invalid credentials,
hashed viewer registration, role injection, database constraints, unsafe monitoring
hosts, invalid incident links/transitions, error shapes, and frontend failure
handling. Browser workflows exercise session-backed registration/login/logout and
viewer rejection. Live checks verify ID rotation, all three probe outcomes,
readiness and metrics. See the exact execution evidence in `VERIFICATION.md`.

`npm audit` and an OSV lookup of 124 resolved runtime Maven coordinates were run locally. The final dependency graph returned no advisory matches in those checks. An explicit development-only minimatch override fixes
an advisory in lint dependencies and is documented in `DEPENDENCIES.md`. The
optional OWASP backend scan requires downloading NVD data and has a separate
manual workflow. A passing test/audit run is not a penetration test or a claim
that no vulnerabilities exist.
