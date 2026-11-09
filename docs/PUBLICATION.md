# Publication checklist

Intended GitHub owner **elilovescoding**.

Before publication, complete every release gate in `VERIFICATION.md`, personally
run the demo and review screenshots/docs/security limits. The owner has explicitly
selected MIT; the license is now in `LICENSE`. Do not upload `.env`, `.runtime`, tool
downloads, database files, Terraform state, build output or browser traces.

## Commands for a later approved publication

Use GitHub CLI with the verified owner account. Use its official secure login
flow if needed. Keep credentials in the system credential store.

```powershell
Set-Location path/to/opsatlas
gh auth status
gh api user --jq .login
# Must be elilovescoding before any remote repository operation.
git config user.name
git config user.email
# Compare the values with the identity confirmed privately by the owner.
# Recheck author/committer overrides with git var GIT_AUTHOR_IDENT and
# git var GIT_COMMITTER_IDENT. Never invent or silently change these values.

git status --short
git diff --check
# Run all documented checks and a secret scan; inspect every intended source file.
git add .
git diff --cached --stat
git diff --cached
# Stop if secrets, runtime artifacts, failing checks or an unverified identity appear.
git commit -m "Build OpsAtlas operations platform"

# Obtain explicit approval immediately before creating a remote or pushing.
gh auth status
gh api user --jq .login
gh repo create elilovescoding/opsatlas --private --source . --remote origin
git remote -v
# If creating the repository and pushing are separate actions, confirm the owner
# approved this push of the completed, reviewed commit as well.
git push -u origin main
gh auth status
gh repo view elilovescoding/opsatlas --json nameWithOwner,url,visibility
git log -1 --format=fuller
```

Verify remote contents and author/committer attribution before reporting a URL.
New repositories remain **private** unless the owner gives separate explicit
approval to make them public. No force pushes, history rewrites, deletion,
archival, or visibility changes are implied by publication approval.

Workflow definitions will start CI on the first main push. Confirm Actions usage
and artifact visibility/retention before publishing. Cloud deployment remains
an inert template outside GitHub's workflow directory after publication. Activating
it or provisioning AWS resources requires separate explicit approval.
