#!/usr/bin/env bash
# Nightly Postgres backup. Cron: 0 2 * * * /opt/townservices/backup-db.sh
set -euo pipefail
cd "$(dirname "$0")"
set -a; . ./.env.prod; set +a
mkdir -p backups
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "backups/$(date +%F).sql.gz"
find backups -name "*.sql.gz" -mtime +14 -delete
