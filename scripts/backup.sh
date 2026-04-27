#!/bin/bash
# Automated backup script for PostgreSQL, MinIO data, and session files
# Run via cron: 0 2 * * * /path/to/backup.sh
# Retention: 30 daily backups, 12 weekly backups

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)
RETENTION_DAYS=30
RETENTION_WEEKS=84  # 12 weeks in days

echo "[$(date)] Starting backup..."

# 1. PostgreSQL backup
echo "  Backing up PostgreSQL..."
mkdir -p "$BACKUP_DIR/postgres/daily"
mkdir -p "$BACKUP_DIR/postgres/weekly"
docker exec $(docker ps -qf "name=postgres" | head -1) \
  pg_dump -U wa_user wa_marketing | gzip > "$BACKUP_DIR/postgres/daily/$DATE.sql.gz"
echo "  PostgreSQL backup complete: $BACKUP_DIR/postgres/daily/$DATE.sql.gz"

# Weekly backup on Sundays
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  cp "$BACKUP_DIR/postgres/daily/$DATE.sql.gz" "$BACKUP_DIR/postgres/weekly/$DATE.sql.gz"
  echo "  Weekly PostgreSQL backup saved"
fi

# 2. MinIO data backup
echo "  Backing up MinIO data..."
mkdir -p "$BACKUP_DIR/minio"
MINIO_VOLUME=$(docker volume inspect wa-marketing_miniodata -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$MINIO_VOLUME" ] && [ -d "$MINIO_VOLUME" ]; then
  tar -czf "$BACKUP_DIR/minio/$DATE.tar.gz" -C "$MINIO_VOLUME" .
  echo "  MinIO backup complete: $BACKUP_DIR/minio/$DATE.tar.gz"
else
  echo "  Warning: MinIO volume not found, skipping"
fi

# 3. Session files backup
echo "  Backing up session files..."
mkdir -p "$BACKUP_DIR/sessions"
SESSIONS_VOLUME=$(docker volume inspect wa-marketing_session_data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$SESSIONS_VOLUME" ] && [ -d "$SESSIONS_VOLUME" ]; then
  tar -czf "$BACKUP_DIR/sessions/$DATE.tar.gz" -C "$SESSIONS_VOLUME" .
  echo "  Sessions backup complete"
else
  echo "  Warning: Session volume not found, skipping"
fi

# 4. Upload to MinIO backup bucket (if mc is available)
if command -v mc &> /dev/null; then
  echo "  Uploading backups to MinIO backup bucket..."
  mc alias set backup "${MINIO_BACKUP_ENDPOINT:-http://minio:9000}" \
    "${MINIO_BACKUP_ACCESS_KEY:-minioadmin}" "${MINIO_BACKUP_SECRET_KEY:-minioadmin}" 2>/dev/null || true
  mc mb --ignore-existing backup/wa-backups 2>/dev/null || true
  mc cp "$BACKUP_DIR/postgres/daily/$DATE.sql.gz" "backup/wa-backups/postgres/$DATE.sql.gz" 2>/dev/null || \
    echo "  Warning: Failed to upload postgres backup to MinIO"
  if [ -f "$BACKUP_DIR/sessions/$DATE.tar.gz" ]; then
    mc cp "$BACKUP_DIR/sessions/$DATE.tar.gz" "backup/wa-backups/sessions/$DATE.sql.gz" 2>/dev/null || \
      echo "  Warning: Failed to upload sessions backup to MinIO"
  fi
else
  echo "  mc (MinIO client) not found — skipping remote upload"
fi

# 5. Cleanup old backups (retention policy)
echo "  Cleaning up old backups..."
find "$BACKUP_DIR/postgres/daily" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR/postgres/weekly" -type f -mtime +$RETENTION_WEEKS -delete 2>/dev/null || true
find "$BACKUP_DIR/minio" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR/sessions" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "[$(date)] Backup complete!"
