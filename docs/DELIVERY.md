# CI and delivery design

## Continuous integration

`ci.yml` runs on approved main-branch publication and pull requests:

- Java 21 formatting check, Maven verify, and OSV lookup of resolved runtime Maven dependencies. With Docker, integration tests start
  PostgreSQL 17 through Testcontainers. No H2 substitute or silent skip.
- Node 24 clean install, ESLint, Prettier check, Vitest, TypeScript/Vite build,
  and npm dependency audit.
- Terraform fmt/init/validate with no credentials/backend/apply; shell syntax check.
- Docker Compose build/config validation, startup/readiness, Playwright Chromium
  desktop/mobile workflows, diagnostic evidence, and container shutdown.

Permissions default to contents-read. PRs receive no cloud credentials. Test
passwords are generated at runtime, masked, and stored only in the runner's
temporary environment. Hosted browser failure artifacts contain screenshots only
and expire after one day. Local Playwright traces may contain session cookies
and test passwords and stay outside publication.

Third-party actions are pinned to reviewed commit SHAs. The comments identify
their major versions for future updates.

`security.yml` is manually triggered and runs OWASP Dependency-Check. Configure
an NVD API key through GitHub encrypted secrets for reliable database downloads.
It fails on CVSS >=7. This scan was not claimed as passed locally. No cloud
deployment is attached to CI or the security scan.

## Deployment is an inert template

`infrastructure/workflow-templates/deploy.yml.example` is outside GitHub's active
workflow directory. It cannot be registered or dispatched by GitHub Actions.
The active directory contains only CI and a dependency scanner; neither has AWS
credentials, OIDC permissions, AWS SDK commands, or Terraform apply/destroy steps.
The CLI deployment script is never invoked by either active workflow.

Only after explicit deployment approval may the owner copy the reviewed template
to `.github/workflows/deploy.yml`. The template has **workflow_dispatch only**.
It has no push, schedule, release,
workflow_run, or pull_request trigger. The job additionally requires:

1. Main branch and typed input exactly `DEPLOY OPSATLAS`.
2. `AWS_DEPLOY_ENABLED` repository variable set to `true` explicitly after approval.
3. A configured `aws-production` GitHub environment. Require reviewers and restrict
   deployment branches to main before enabling. Environment approval availability
   depends on the GitHub account/plan; verify it instead of assuming protection.
4. `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `AWS_RELEASE_BUCKET`, and `AWS_INSTANCE_ID`.
   These are nonsecret resource identifiers, not access keys.
5. An approved OIDC role trusting only the intended repository/environment and
   audience `sts.amazonaws.com`.

Without activation and all opt-ins, it does not deploy. Do not activate it as part of merely
publishing a repository. Enabling cloud delivery and paying for resources are
separate explicit approvals.

## Release mechanics

The runner builds five Docker images tagged with the exact commit SHA, saves them
into a compressed bundle with Compose/config/scripts, and uploads the bundle to
one private S3 prefix. It obtains short-lived AWS credentials using OIDC, then
requests an SSM shell command on the one approved instance. That command downloads
the expected object and validates its SHA-256 before extracting it.

On the host, `deploy.sh` validates the SHA, requires an already mounted persistent
volume and privately configured `.env`, loads the images, and runs Compose
`--no-build --wait`. A successful release writes `current-release` only after
health checks pass. Secrets never travel in the release bundle or SSM command.

Deployment can restart containers and has no atomic blue/green switch or automatic
rollback. A failed startup requires diagnosis and an approved previous-image
rollback compatible with the database schema. Current schema migration is forward
only. CI validation and deployment health checks serve different purposes.

Terraform is **never** run by this workflow. IAM/host provisioning, initial .env,
DNS, TLS and backup/restore need an independently approved setup. The IAM deploy
role can send a root shell command to this one host, which is deliberately a
powerful capability; protected-environment review and repository security matter.
