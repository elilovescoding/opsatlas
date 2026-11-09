# Portfolio description and interview guide

## Project description

OpsAtlas is a full-stack internal operations platform that connects service
registration, measured health checks, release records, incident timelines, and
audit history. A Java 21/Spring Boot API and React/TypeScript client use PostgreSQL
for domain data and secure sessions. The project includes Docker startup,
observability, automated tests, and locally validated AWS Terraform configuration.
It runs locally; an AWS deployment has not been performed.

This project was built with assistant collaboration. The owner should trace the
code, run the walkthrough, modify a feature, and explain the tradeoffs in their
own words before presenting it as portfolio experience. Do not imply prior
employment, real customer traffic, production incidents, or measured business impact.

## Four evidence-based resume bullets

- Built a Java 21/Spring Boot and React/TypeScript operations platform with
  PostgreSQL-backed service registration, deployment tracking, multi-service
  incident timelines, resolution reviews, and transactional audit history.
- Implemented role-based API authorization, BCrypt password hashing,
  database-backed sessions, CSRF protection, session rotation, sensitive-route
  rate limits, and fixed-target HTTP monitoring designed to prevent URL-based SSRF.
- Verified core workflows with PostgreSQL integration tests, backend unit tests,
  frontend component/API tests, and desktop/mobile Playwright journeys; exposed
  health/readiness and Prometheus-compatible JVM, HTTP, and probe metrics.
- Designed and locally validated a cost-conscious AWS Terraform configuration for
  EC2, encrypted persistent EBS, SSM administration, scoped IAM, CloudWatch, and
  private release artifacts; authored Docker and approval-gated CI/CD workflows.

The final bullet says configuration/design, not deployed infrastructure or a
proven production pipeline. Do not add availability, latency-reduction, user-count,
cloud-spend savings or coverage percentages without measuring them.

## Topics to demonstrate

1. **A transaction:** follow `Operations.open` from validated DTO to service locks,
   deployment relationship check, incident/update insert, and audit event. Explain
   what PostgreSQL rolls back if any write fails.
2. **A session:** follow CSRF bootstrap → BCrypt login → rotated cookie ID → JDBC
   session → protected API → logout. Explain why the browser stores no JWT.
3. **An incident:** show an invalid resolution rejected, then provide root cause
   and resolution, reload, and review append-only timeline entries.
4. **A monitoring boundary:** explain why users choose fixed keys instead of URLs,
   why redirects are disabled, and why the worker rechecks configuration after I/O.
5. **A test:** show negative authorization or mismatched deployment/incident
   association tests and the real PostgreSQL FK constraint test.
6. **An infrastructure tradeoff:** explain why one small EC2 host is cheaper and
   more understandable than NAT/ECS/RDS here, and exactly what resilience it loses.
7. **An honest limitation:** no MFA/recovery, single team, in-process/shared proxy
   rate limit, no distributed worker, manual backup/restore, and no cloud runtime
   evidence. Describe how requirements would guide the next change.

## Decisions worth discussing

| Decision | Benefit | Cost / next step |
| --- | --- | --- |
| Modular monolith | Simple transactions and approachable deployment | Separate workers only when scale or reliability requires it |
| JDBC sessions | Revocable, durable auth without Redis/JWT complexity | Database dependence and per-request session work |
| Explicit DTOs | No entity/password leakage; stable API contract | Projection mapping to maintain |
| Pessimistic locks | Serialize lifecycle operations and preserve invariants | Contention; keep network calls outside transactions |
| Fixed monitor targets | Small, testable SSRF surface | No arbitrary external monitoring configuration |
| Flyway + validate | Reviewed schema history, no silent ORM mutation | Forward migrations need rollback/backup planning |
| Single EC2/EBS | Low ongoing cost and understandable Linux operations | One host/AZ failure takes down all application functions |
| Manual OIDC deployment | No long-lived AWS keys or automatic paid provisioning | Initial environment/IAM/DNS setup needs careful review |

Suggested independent extension: add an incident search filter with database
pagination, validation, UI empty/error handling, and a negative integration test.
That is a small feature the owner can implement and explain confidently without
changing the architecture or incurring cloud cost.
