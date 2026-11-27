#!/usr/bin/env bash
set -euo pipefail

# Script cap nhat code an toan cho VM 2 (tago-ai: ai-service & ocr-service).
# Cach dung:
#   bash deploy/update-ai.sh                 # cap nhat ca ai-service va ocr-service
#   bash deploy/update-ai.sh ai-service      # chi rebuild ai-service
#   bash deploy/update-ai.sh ocr-service     # chi rebuild ocr-service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_SERVICE="${1:-}"
BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"

cd "$ROOT_DIR"

if [ ! -f "ai-service/.env" ]; then
  echo "[update-ai] THIEU file ai-service/.env. Hay tao tu ai-service/.env.example truoc."
  exit 1
fi

echo "[update-ai] Pulling latest code from origin/$BRANCH..."
git fetch --prune origin
git pull --ff-only origin "$BRANCH"

if [ -n "$TARGET_SERVICE" ]; then
  echo "[update-ai] Rebuilding & restarting $TARGET_SERVICE..."
  docker compose -f deploy/docker-compose.ai.yml up -d --build --no-deps "$TARGET_SERVICE"
  SERVICES=("$TARGET_SERVICE")
else
  echo "[update-ai] Rebuilding & restarting ai-service & ocr-service..."
  docker compose -f deploy/docker-compose.ai.yml up -d --build ai-service ocr-service
  SERVICES=("ai-service" "ocr-service")
fi

for svc in "${SERVICES[@]}"; do
  CONTAINER="tago-$svc"
  echo "[update-ai] Waiting for $CONTAINER to become healthy (co the mat 30-90s de nap CLIP/E5)..."
  READY=0
  for i in $(seq 1 45); do
    STATUS="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo "missing")"
    if [ "$STATUS" = "healthy" ]; then
      echo "[update-ai] OK: $CONTAINER is healthy!"
      READY=1
      break
    fi
    echo "[update-ai] $CONTAINER status: $STATUS ($i/45)..."
    sleep 3
  done
  if [ "$READY" -ne 1 ]; then
    echo "[update-ai] ERROR: $CONTAINER did not become healthy. Last 40 log lines:"
    docker logs --tail 40 "$CONTAINER" || true
    exit 1
  fi
done

docker image prune -f >/dev/null 2>&1 || true
echo "[update-ai] Hoan tat cap nhat VM 2."
