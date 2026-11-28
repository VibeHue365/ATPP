#!/usr/bin/env bash
set -euo pipefail

# Script cap nhat code an toan cho mo hinh 1 VPS All-in-One.
# TUYET DOI KHONG xoa volume database/MinIO/Redis/Caddy.
# Cach dung:
#   bash deploy/update-all.sh                # chi rebuild backend (nhanh ~30-45s)
#   bash deploy/update-all.sh all            # rebuild ca backend, ai-service va ocr-service
#   bash deploy/update-all.sh ai-service     # chi rebuild ai-service

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="${1:-backend}"
BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
COMPOSE_CMD=(docker compose --env-file deploy/.env.core -f deploy/docker-compose.all-in-one.yml)

cd "$ROOT_DIR"

if [ ! -f "deploy/.env.core" ] || [ ! -f "backend/.env" ] || [ ! -f "ai-service/.env" ] || [ ! -f "deploy/secrets/mongo-keyfile" ]; then
  echo "[update-all] Thieu file cau hinh (.env.core / backend/.env / ai-service/.env) hoac mongo-keyfile."
  echo "             Chay: bash deploy/init-core.sh"
  exit 1
fi

echo "[update-all] Pulling latest code from origin/$BRANCH..."
git fetch --prune origin
git pull --ff-only origin "$BRANCH"

if [ "$TARGET" = "all" ]; then
  SERVICES=(backend ai-service ocr-service)
else
  SERVICES=("$TARGET")
fi

echo "[update-all] Rebuilding & restarting: ${SERVICES[*]} (zero DB restart)..."
"${COMPOSE_CMD[@]}" up -d --build --no-deps "${SERVICES[@]}"

for svc in "${SERVICES[@]}"; do
  CONTAINER="tago-$svc"
  echo "[update-all] Waiting for $CONTAINER to become healthy..."
  READY=0
  for i in $(seq 1 45); do
    STATUS="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo "missing")"
    if [ "$STATUS" = "healthy" ]; then
      echo "[update-all] OK: $CONTAINER is healthy!"
      READY=1
      break
    fi
    echo "[update-all] $CONTAINER status: $STATUS ($i/45)..."
    sleep 3
  done
  if [ "$READY" -ne 1 ]; then
    echo "[update-all] ERROR: $CONTAINER did not become healthy. Last 40 log lines:"
    docker logs --tail 40 "$CONTAINER" || true
    exit 1
  fi
done

docker image prune -f >/dev/null 2>&1 || true
echo "[update-all] Hoan tat cap nhat an toan!"
