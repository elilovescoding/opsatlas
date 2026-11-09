# Developer and operator runbook

## Startup and shutdown

Docker: copy `config/environment.example`, privately fill required values, then run
`docker compose up --build --wait --wait-timeout 180`. Web: localhost:8088.
`docker compose down` stops containers and preserves data; never add `-v` unless
you intentionally want to delete the local database.

Windows native: `scripts/dev.ps1` starts the dedicated loopback PostgreSQL cluster,
builds the API, copies its JAR into `.runtime`, and starts fixtures/API/Vite in
hidden processes. Web: 127.0.0.1:5173. Use `scripts/stop.ps1` before restarting
changed backend code. Logs and PIDs are in `.runtime`. `.env` is private and
contains generated random credentials. Do not attach it to issues or screenshots.

Run native scripts from the project root. Personal installation paths belong in
your shell environment, never in committed source or documentation.

## Troubleshooting

| Symptom | Inspect / action |
| --- | --- |
| Compose exits before startup | Check blank required `.env` values, Docker daemon, Compose 2.24.6+, port/subnet conflicts |
| PostgreSQL unhealthy | `docker compose logs database`; check storage capacity and initialized password consistency |
| API cannot migrate | Read backend logs; verify database URL/user/password and PostgreSQL version; do not delete migration history |
| Native build cannot rename JAR | Stop an older API launched directly from `backend/target`; current launcher uses `.runtime/opsatlas.jar` |
| Native scripts wait on pg_ctl | Use current scripts; they wait for the control process, not the PostgreSQL process tree |
| Fixture service is Unknown | Wait for the first schedule; verify target selection and `demo-targets` health |
| All targets unavailable | Check `targets` process, host 127.0.0.1/native or 172.30.0.10/Compose, and port 9090 |
| Storage always unavailable | Expected: the local storage fixture deliberately returns HTTP 503 |
| Queue always degraded | Expected: the queue fixture deliberately delays about 750 ms |
| 403 on a mutation | Confirm role and CSRF session; refresh/sign in again if token expired |
| Login/register returns 429 | Wait five minutes; the conservative proxy-origin limiter is shared |
| Bootstrap login fails | Environment bootstrap does not reset existing users; verify original credential or use a fresh administrator email |
| Prometheus inaccessible from browser | Management is intentionally private; enable the loopback Prometheus profile or inspect native 8081 |
| Public status omits a service | Check public visibility and archive flag; stale/disabled checks become Unknown |
| Frontend appears empty | Check `/api/auth/me`, browser network panel, backend readiness, and frontend proxy logs |
| Terraform destroy is blocked | Data-volume deletion guard and/or nonempty release bucket; review backups and approval before removing guards |

Never fix a database issue by deleting volumes or migration history without
explicit approval and a verified backup. Changing PostgreSQL image major version
requires a planned migration; the project intentionally stays on major 17.

## Logs and metrics

Application logs are structured ECS JSON. Log events identify startup, probe
failures and safe unexpected-error references; no request/password bodies are
logged. Audit history records actor/action/resource/time in the database. Docker
cloud logging sends streams to the configured CloudWatch group.

Readiness includes the database; liveness does not depend on an individual demo
target. The backend remains ready when the deliberately failed storage target is
unavailable. Native readiness: `http://127.0.0.1:8081/actuator/health/readiness`.
Private Prometheus metrics expose HTTP durations, JVM memory, process/system CPU,
and fixed-cardinality target/state health counts and durations. Do not expose
management ports or treat the frontend's probe chart as host/cloud telemetry.

Useful PromQL examples:

```promql
sum(rate(opsatlas_health_checks_total[5m])) by (state)
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
jvm_memory_used_bytes{area="heap"}
rate(opsatlas_health_duration_seconds_sum[5m]) / rate(opsatlas_health_duration_seconds_count[5m])
```

## Backup and recovery

`bash scripts/backup.sh` exports a compressed PostgreSQL dump to ignored
`.runtime/backups`, with restrictive file permissions. Test decompression and copy
to encrypted off-host storage. For cloud, run from the current release directory
with `COMPOSE_FILE=docker-compose.yml:docker-compose.cloud.yml` and the intended
environment file. The Docker verification covered persistence across container
recreation. Backup export and cloud restore remain unverified.

Restore into a **separate empty database** first and verify row counts, foreign
keys, sign-in, service history and incidents. Replacing the active database is a
destructive operation requiring separate approval. Dumps contain session rows and
password hashes: protect them, and invalidate restored sessions if appropriate.
EBS encryption and persistent local volumes are not backups.

## Password changes and updates

Database password rotation must change the PostgreSQL role and matching app secret
together; changing `POSTGRES_PASSWORD` alone does not reinitialize a populated
volume. Bootstrap environment variables create an absent administrator only.
Existing-user password resets require a reviewed BCrypt/session revocation
procedure; no reset feature is advertised. Do not put generated hashes/secrets
into migration files.

Before an application update, run tests, inspect migration compatibility, create
a backup, verify free disk space, and review the image tag. Manual cloud releases
use commit-SHA tags and health-gated Compose startup. To roll back application
images, invoke the deployment script from a preserved previous bundle with its
SHA after reviewing schema compatibility. There is no automatic schema downgrade.
Release changes restart containers and may cause brief downtime.
