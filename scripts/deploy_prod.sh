#!/usr/bin/env sh
set -eu

APP_DIR=${APP_DIR:-/opt/bugboard26}
ENV_FILE=${ENV_FILE:-"$APP_DIR/.env"}
IMAGES_FILE=${IMAGES_FILE:-"$APP_DIR/.release-images.env"}
PREVIOUS_IMAGES_FILE=${PREVIOUS_IMAGES_FILE:-"$APP_DIR/.release-images.previous.env"}
COMPOSE_FILE=${COMPOSE_FILE:-"$APP_DIR/docker-compose.release.yml"}

if [ -z "${BACKEND_IMAGE:-}" ] || [ -z "${WEB_IMAGE:-}" ]; then
  echo "[deploy] BACKEND_IMAGE and WEB_IMAGE are required."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "[deploy] Missing runtime env file: $ENV_FILE"
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "[deploy] Missing compose file: $COMPOSE_FILE"
  exit 1
fi

mkdir -p "$APP_DIR"

compose() {
  docker compose \
    --project-directory "$APP_DIR" \
    --env-file "$ENV_FILE" \
    --env-file "$IMAGES_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

write_images_file() {
  target_file="$1"
  cat > "$target_file" <<EOF
BACKEND_IMAGE=$BACKEND_IMAGE
WEB_IMAGE=$WEB_IMAGE
EOF
}

wait_for_service() {
  service_name="$1"
  timeout_seconds="${2:-180}"
  elapsed=0

  while [ "$elapsed" -lt "$timeout_seconds" ]; do
    container_id=$(compose ps -q "$service_name")
    if [ -n "$container_id" ]; then
      status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
      case "$status" in
        healthy|running)
          return 0
          ;;
        unhealthy|exited|dead)
          echo "[deploy] Service $service_name is $status"
          return 1
          ;;
      esac
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done

  echo "[deploy] Timed out waiting for $service_name"
  return 1
}

rollback() {
  if [ ! -f "$PREVIOUS_IMAGES_FILE" ]; then
    echo "[deploy] No previous image manifest available for rollback."
    return 1
  fi

  cp "$PREVIOUS_IMAGES_FILE" "$IMAGES_FILE"
  echo "[deploy] Rolling back to previous images..."
  compose pull backend web
  compose up -d db backend web
  wait_for_service backend 180
  wait_for_service web 180
}

if [ -f "$IMAGES_FILE" ]; then
  cp "$IMAGES_FILE" "$PREVIOUS_IMAGES_FILE"
fi

tmp_images_file=$(mktemp)
write_images_file "$tmp_images_file"
mv "$tmp_images_file" "$IMAGES_FILE"

echo "[deploy] Pulling immutable images..."
compose pull backend web

echo "[deploy] Starting release..."
compose up -d db backend web

if ! wait_for_service backend 180 || ! wait_for_service web 180; then
  echo "[deploy] Healthcheck failed, attempting rollback..."
  rollback
  exit 1
fi

echo "[deploy] Release completed successfully."
