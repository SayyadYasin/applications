#!/usr/bin/env bash
# Run on the server: ./deploy.sh <image-tag>
set -euo pipefail
cd "$(dirname "$0")"
export IMAGE_TAG="${1:?usage: deploy.sh <image-tag>}"
[ -f .env.prod ] || { echo ".env.prod missing"; exit 1; }
set -a; . ./.env.prod; set +a
echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --remove-orphans
docker image prune -f
echo "Deployed ${IMAGE_TAG}"
