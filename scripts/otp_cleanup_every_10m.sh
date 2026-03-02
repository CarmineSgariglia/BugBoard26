#!/usr/bin/env sh
set -eu

INTERVAL_SECONDS="${OTP_CLEANUP_INTERVAL_SECONDS:-600}"

echo "Starting OTP cleanup loop (interval: ${INTERVAL_SECONDS}s)..."
echo "Press Ctrl+C to stop."

while true; do
  docker compose exec -T backend python manage.py cleanup_otps
  sleep "${INTERVAL_SECONDS}"
done
