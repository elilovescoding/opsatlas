#!/usr/bin/env bash
# Runs only on an explicitly provisioned host after manual deployment approval.
set -euo pipefail
release=${1:?Commit SHA required}
[[ "$release" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release identifier' >&2; exit 1; }
test -f /opt/opsatlas/.env || { echo 'Configure /opt/opsatlas/.env through SSM first.' >&2; exit 1; }
mountpoint -q /srv/opsatlas-data || { echo 'Persistent data volume is not mounted.' >&2; exit 1; }
test -d /srv/opsatlas-data/postgres
chmod 600 /opt/opsatlas/.env
export IMAGE_TAG="$release"
gzip -dc images.tar.gz | docker load
docker compose --env-file /opt/opsatlas/.env -f docker-compose.yml -f docker-compose.cloud.yml config --quiet
docker compose --env-file /opt/opsatlas/.env -f docker-compose.yml -f docker-compose.cloud.yml up -d --no-build --wait --wait-timeout 180
printf '%s\n' "$release" > /opt/opsatlas/current-release
echo 'Release is healthy. Previous release bundles remain available for manual rollback.'
