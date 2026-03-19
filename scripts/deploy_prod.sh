#!/bin/bash
set -euo pipefail

APP_DIR="${PROD_VM_APP_DIR:-/opt/bugboard26}"
ARTIFACT_REGISTRY_REGION="${GCP_ARTIFACT_REGISTRY_REGION:-europe-west8}"

cd "${APP_DIR}"

gcloud auth configure-docker "${ARTIFACT_REGISTRY_REGION}-docker.pkg.dev" --quiet

docker compose -f docker-compose.release.yml pull

docker compose -f docker-compose.release.yml up -d --remove-orphans

docker compose -f docker-compose.release.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.release.yml exec -T backend python manage.py collectstatic --noinput

docker image prune -af
