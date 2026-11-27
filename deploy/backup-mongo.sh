#!/usr/bin/env bash
set -euo pipefail

# Sao luu MongoDB hang dem (chay tren VM 1 qua cron) va giu lai 7 ngay gan nhat.
# Vi du crontab (3h00 sang hang ngay gio VN):
#   0 3 * * * /bin/bash /home/<user>/VibeHue/deploy/backup-mongo.sh >> /home/<user>/backups/mongo-backup.log 2>&1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.core"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/mongo}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup-mongo] ERROR: Khong tim thay $ENV_FILE"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(TZ=Asia/Ho_Chi_Minh date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/tago-mongo-$TIMESTAMP.archive.gz"

echo "[backup-mongo] Starting mongodump -> $OUT_FILE"
docker exec tago-mongodb mongodump \
  --username "$MONGO_ROOT_USER" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --archive \
  --gzip > "$OUT_FILE"

if [ ! -s "$OUT_FILE" ]; then
  echo "[backup-mongo] ERROR: Backup file is empty, removing $OUT_FILE"
  rm -f "$OUT_FILE"
  exit 1
fi

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[backup-mongo] OK: Saved $OUT_FILE ($SIZE)"

find "$BACKUP_DIR" -type f -name "tago-mongo-*.archive.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[backup-mongo] Cleaned up backups older than $RETENTION_DAYS days."
