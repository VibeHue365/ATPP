#!/usr/bin/env bash
set -euo pipefail

# Khoi tao mot lan duy nhat tren VM 1 (tago-core) truoc khi chay docker-compose.core.yml:
# 1) Tao MongoDB keyFile cho che do --replSet rs0 + --auth (quyen 400, owner 999:999)
# 2) Kiem tra su ton tai cua deploy/.env.core va backend/.env

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRET_DIR="$SCRIPT_DIR/secrets"
KEYFILE="$SECRET_DIR/mongo-keyfile"

mkdir -p "$SECRET_DIR"

if [ ! -f "$KEYFILE" ]; then
  echo "[init-core] Generating MongoDB replica-set keyFile at $KEYFILE..."
  openssl rand -base64 756 > "$KEYFILE"
  chmod 400 "$KEYFILE"
  if [ "$(id -u)" -eq 0 ]; then
    chown 999:999 "$KEYFILE"
  else
    sudo chown 999:999 "$KEYFILE"
    sudo chmod 400 "$KEYFILE"
  fi
  echo "[init-core] KeyFile created and secured (400, uid:gid 999:999)."
else
  echo "[init-core] Existing keyFile found at $KEYFILE (giu nguyen, khong ghi de)."
fi

MISSING=0
if [ ! -f "$SCRIPT_DIR/.env.core" ]; then
  echo "[init-core] THIEU file: $SCRIPT_DIR/.env.core"
  echo "            Chay: cp deploy/.env.core.example deploy/.env.core && nano deploy/.env.core"
  MISSING=1
fi

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  echo "[init-core] THIEU file: $ROOT_DIR/backend/.env"
  echo "            Chay: cp backend/.env.example backend/.env && nano backend/.env"
  MISSING=1
fi

if [ "$MISSING" -ne 0 ]; then
  exit 1
fi

echo "[init-core] San sang khoi chay VM 1:"
echo "  docker compose --env-file deploy/.env.core -f deploy/docker-compose.core.yml up -d --build"
