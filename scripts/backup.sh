#!/usr/bin/env bash
set -euo pipefail
# Local Compose backup. Supply cloud compose files via COMPOSE_FILE when required.
mkdir -p .runtime/backups
chmod 700 .runtime/backups
backup=".runtime/backups/opsatlas-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
umask 077
docker compose exec -T database pg_dump -U opsatlas -d opsatlas --no-owner --no-acl | gzip > "$backup"
gzip -t "$backup"
echo "Backup written to $backup. Copy to encrypted off-host storage and test restoration."
