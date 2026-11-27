#!/usr/bin/env bash
set -euo pipefail

# Script cap nhat code an toan cho VM 1 (tago-core).
# Chi rebuild & restart container backend; TUYET DOI KHONG xoa volume database/MinIO/Redis.
# Cach dung:
#   bash deploy/update-core.sh            # pull nhanh hien tai va rebuild backend
#   bash deploy/update-core.sh main       # pull nhanh chi dinh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BRANCH="${1:-$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)}"

cd "$ROOT_DIR"

if [ ! -f "deploy/.env.core" ] || [ ! -f "backend/.env" ] || [ ! -f "deploy/secrets/mongo-keyfile" ]; then
  echo "[update-core] Thieu file cau hinh hoac mongo-keyfile. Hay chay: bash deploy/init-core.sh"
  exit 1
fi

echo "[update-core] Pulling latest code from origin/$BRANCH..."
git fetch --prune origin
git pull --ff-only origin "$BRANCH"

echo "[update-core] Rebuilding & restarting backend container (zero DB restart)..."
docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml up -d --build --no-deps backend

echo "[update-core] Waiting for tago-backend to become healthy..."
for i in $(seq 1 30); do
  STATUS="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' tago-backend 2>/dev/null || echo "missing")"
  if [ "$STATUS" = "healthy" ]; then
    echo "[update-core] OK: tago-backend is healthy!"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  echo "[update-core] Status: $STATUS ($i/30)..."
  sleep 2
done

echo "[update-core] ERROR: tago-backend did not become healthy in time. Last 40 log lines:"
docker logs --tail 40 tago-backend || true
exit 1
