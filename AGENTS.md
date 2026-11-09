# OpsAtlas contributor instructions

- Develop, build, test, and document locally. Do not publish, push, create a remote
  repository/branch/PR, deploy, or run `terraform apply` without the owner's
  explicit approval for the completed, reviewed action.
- Intended portfolio owner is `elilovescoding`. Check `gh auth status` and account
  ownership before GitHub operations. Before commits, inspect and explicitly
  confirm the owner's author/committer name and GitHub-associated email. Never
  invent identity or add optional assistant coauthors.
- Follow the owner's global portfolio instructions. Never upload unfinished work,
  secrets, runtime files, database data, Terraform state, or browser traces.
- Preserve Flyway history and operational records; archive services instead of
  deleting data. Do not erase a database to make tests pass.
- Run backend tests with PostgreSQL (Testcontainers or the dedicated native
  `opsatlas_test` database), frontend checks, and browser journeys after related
  changes. Do not claim Docker, CI, or AWS execution without observed evidence.
- See `docs/VERIFICATION.md` for current release gates and `docs/RUNBOOK.md` for
  the native launcher. Use the project root. `.tools` and `.runtime` are ignored local tooling/data.
