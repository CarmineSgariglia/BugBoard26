#!/bin/bash
set -euo pipefail

: "${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
: "${WEB_IMAGE:?WEB_IMAGE must be set}"

APP_DIR="${PROD_VM_APP_DIR:-/opt/bugboard26}"
ARTIFACT_REGISTRY_REGION="${GCP_ARTIFACT_REGISTRY_REGION:-europe-west8}"

cd "${APP_DIR}"

gcloud auth configure-docker "${ARTIFACT_REGISTRY_REGION}-docker.pkg.dev" --quiet

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f docker-compose.release.yml pull

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f docker-compose.release.yml up -d --remove-orphans

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f docker-compose.release.yml exec -T backend python manage.py migrate --noinput
BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f docker-compose.release.yml exec -T backend python manage.py collectstatic --noinput

docker image prune -af
