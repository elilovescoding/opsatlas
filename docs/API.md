# REST API contract

Base URL: same origin, `/api`. Content type: JSON. Identifiers: UUID. Times: ISO
8601 UTC. Enum values are uppercase. DTOs reject unknown JSON properties. Errors
use `application/problem+json` with safe `status` and `detail` fields.

## Identity flow

1. `GET /auth/csrf` creates an anonymous session and returns `{token, headerName,
   registrationEnabled}`. Preserve its HTTP-only session cookie.
2. `POST /auth/register` with `{email, displayName, password}` creates a **viewer**.
   It does not log in. Registration can be disabled by environment configuration.
3. `POST /auth/login` with `{email, password}` authenticates and rotates the session
   ID, preserving the CSRF token. No JWT or password is returned.
4. `GET /auth/me` returns `{id, email, displayName, role}` for the current session.
5. `POST /auth/logout` requires CSRF, invalidates the session, and returns 204.

Every POST/PUT/PATCH requires `X-CSRF-TOKEN` plus the session cookie, including
login/registration/logout. No credentials in query strings. Sessions expire after
30 idle minutes. Cookies are SameSite Strict, HttpOnly, and Secure in the cloud
overlay. Each origin gets 20 login/registration attempts and 240 anonymous CSRF
bootstraps per five-minute window. Origins behind the same proxy share a bucket.
Behind the default proxy, callers share a deliberately conservative origin bucket.

## Endpoints

| Method and path | Access | Function |
| --- | --- | --- |
| GET `/public/status` | Public | Minimal projection of explicitly public, active services |
| GET `/services` | Viewer+ | `q`, `environment`, `page`, `size` |
| GET `/services/{id}` | Viewer+ | Includes archived service details |
| POST `/services` | Operator+ | Register service |
| PUT `/services/{id}` | Operator+ | Replace editable service fields |
| POST `/services/{id}/archive` | Operator+ | Archive, 204; blocked by unresolved incidents |
| GET `/services/{id}/health` | Viewer+ | Paginated latest health observations |
| GET `/deployments` | Viewer+ | Optional `serviceId`, plus pagination |
| POST `/deployments` | Operator+ | Record release, 201 |
| PATCH `/deployments/{id}` | Operator+ | `{status}` transition |
| GET `/incidents` | Viewer+ | Optional `status`, `serviceId`, pagination |
| GET `/incidents/{id}` | Viewer+ | Incident and affected service IDs |
| POST `/incidents` | Operator+ | Open incident, 201 |
| PATCH `/incidents/{id}` | Operator+ | Append update and update state/resolution |
| GET `/incidents/{id}/updates` | Viewer+ | Paginated, newest-first timeline |
| GET `/activity` | Viewer+ | Paginated audit events |
| GET `/dashboard` | Viewer+ | Counts, probe aggregates, incident trends/MTTR |
| GET `/admin/users` | Admin | Paginated members, fixed 25 per page |
| PATCH `/admin/users/{id}/role` | Admin | `{role: VIEWER or OPERATOR}`, revokes sessions |

Administrator accounts cannot be demoted or created through the role API. A
bootstrap administrator is the operator-controlled recovery path; self-role
changes are rejected. The bootstrap does not overwrite an existing account.

Collections return `{items, page, size, total, pages}`. Page is zero-based; size is
bounded 1–100. Most defaults are 20; health defaults to 60 and timeline to 50.
The server controls sorting. Archives are excluded from registry lists but their
UUID detail/history endpoints remain readable.

## Example payloads

```json
{
  "name": "Payments API",
  "description": "Local portfolio demonstration service",
  "environment": "STAGING",
  "owner": "Platform",
  "healthTarget": "DEMO_API",
  "publicVisible": false
}
```

There is no `url` field. Targets are `NONE`, `DEMO_API`, `DEMO_QUEUE`, and
`DEMO_STORAGE`. They map to fixed local fixture paths. Unknown keys/targets return
400. The configured host cannot be changed through the API.

Deployment input: `{serviceId, version, environment, status, notes}`. Environment
must match the service. Creation can record any supported historical outcome.
Later transitions are pending → succeeded/failed and succeeded → rolled back.
Terminal failed/rolled-back records are immutable.

Incident creation:

```json
{
  "title": "Elevated probe duration (demo)",
  "severity": "SEV3",
  "serviceIds": ["00000000-0000-4000-8000-000000000001"],
  "assignee": "Platform on-call",
  "deploymentId": null,
  "message": "Investigating a deliberately slow local fixture."
}
```

Replace example IDs with actual records. Select 1–20 services. A linked deployment
must belong to an affected service. Severity: SEV1 critical, SEV2 major, SEV3 minor,
SEV4 low. Responsibility is an explicit team/person string, not a notification or
on-call scheduling integration.

Incident update:

```json
{
  "status": "RESOLVED",
  "severity": "SEV3",
  "assignee": "Platform on-call",
  "message": "The local response exercise is complete.",
  "rootCause": "Intentionally delayed demonstration endpoint.",
  "resolution": "Documented the exercise and concluded incident response."
}
```

States can stay unchanged or move forward through investigating → identified →
monitoring → resolved; intermediate states may be skipped. Resolution requires
both analysis fields. Updates to resolved incidents return 409.

## Errors and operational endpoints

400: invalid DTO, enum, UUID, page bounds, or business relationship. 401: missing
session/bad credentials. 403: insufficient role, CSRF, or disabled registration.
404: missing record. 409: uniqueness or lifecycle conflict. 429: sensitive-route
rate limit, with Retry-After. 500: safe reference ID; investigate server logs.

Actuator uses **port 8081**, not the web origin. `/actuator/health/readiness`
includes database availability. `/actuator/health/liveness` checks process
liveness. `/actuator/prometheus` exposes JVM/process/HTTP/Micrometer metrics and
custom `opsatlas_health_checks_total` / `opsatlas_health_duration_seconds` metrics.
Detailed health/database credentials are never returned. Do not publish this port.

OpenAPI is `/v3/api-docs`, Swagger is `/api/docs`, both authenticated. Swagger
requests use the browser session; mutations also need the CSRF header. The UI's
ordinary forms handle this automatically. `scripts/check-live.mjs` demonstrates
session-preserving programmatic requests without printing session secrets.
