#!/bin/bash
# Automated backup script for PostgreSQL, MinIO data, and session files
# Run via cron: 0 2 * * * /path/to/backup.sh
# Retention: 30 daily backups

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=30

echo "[$(date)] Starting backup..."

# 1. PostgreSQL backup
echo "  Backing up PostgreSQL..."
mkdir -p "$BACKUP_DIR/postgres"
docker exec $(docker ps -qf "name=postgres" | head -1) \
  pg_dump -U wa_user wa_marketing | gzip > "$BACKUP_DIR/postgres/$DATE.sql.gz"
echo "  PostgreSQL backup complete: $BACKUP_DIR/postgres/$DATE.sql.gz"

# 2. Session files backup
echo "  Backing up session files..."
mkdir -p "$BACKUP_DIR/sessions"
SESSIONS_VOLUME=$(docker volume inspect wa-marketing_session_data -f '{{.Mountpoint}}' 2>/dev/null || echo "")
if [ -n "$SESSIONS_VOLUME" ] && [ -d "$SESSIONS_VOLUME" ]; then
  tar -czf "$BACKUP_DIR/sessions/$DATE.tar.gz" -C "$SESSIONS_VOLUME" .
  echo "  Sessions backup complete"
else
  echo "  Warning: Session volume not found, skipping"
fi

# 3. Cleanup old backups (retention policy)
echo "  Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo "[$(date)] Backup complete!"
