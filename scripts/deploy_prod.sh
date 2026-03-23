#!/bin/bash
set -euo pipefail

: "${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
: "${WEB_IMAGE:?WEB_IMAGE must be set}"

APP_DIR="${PROD_VM_APP_DIR:-/opt/bugboard26}"
ARTIFACT_REGISTRY_REGION="${GCP_ARTIFACT_REGISTRY_REGION:-europe-west8}"
COMPOSE_FILE="docker-compose.prod.yml"

cd "${APP_DIR}"

if [ ! -f "${COMPOSE_FILE}" ] && [ -f "docker-compose.release.yml" ]; then
  COMPOSE_FILE="docker-compose.release.yml"
fi

gcloud auth configure-docker "${ARTIFACT_REGISTRY_REGION}-docker.pkg.dev" --quiet

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f "${COMPOSE_FILE}" pull

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f "${COMPOSE_FILE}" exec -T backend python manage.py migrate --noinput
BACKEND_IMAGE="${BACKEND_IMAGE}" WEB_IMAGE="${WEB_IMAGE}" docker compose -f "${COMPOSE_FILE}" exec -T backend python manage.py collectstatic --noinput

docker image prune -af
