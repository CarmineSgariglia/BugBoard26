#!/bin/bash
set -e

cd /opt/bugboard26

gcloud auth configure-docker europe-west8-docker.pkg.dev --quiet

docker compose -f docker-compose.release.yml pull

docker compose -f docker-compose.release.yml up -d --remove-orphans

docker compose -f docker-compose.release.yml exec -T backend python manage.py migrate --noinput
docker compose -f docker-compose.release.yml exec -T backend python manage.py collectstatic --noinput

docker image prune -af
