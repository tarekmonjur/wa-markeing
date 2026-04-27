# Backup & Restore Guide

## Automated Backups

The `scripts/backup.sh` script runs nightly and backs up:

1. **PostgreSQL database** — Full `pg_dump` compressed with gzip
2. **Session files** — Baileys session credentials (tar + gzip)

### Setting up automated backups

Add to crontab on the host machine:

```bash
# Run backup daily at 2:00 AM UTC
0 2 * * * /path/to/wa-marketing/scripts/backup.sh >> /var/log/wa-backup.log 2>&1
```

### Backup location

Default: `/backups/` (configurable via `BACKUP_DIR` environment variable)

```
/backups/
├── postgres/
│   ├── 2026-04-28.sql.gz
│   ├── 2026-04-27.sql.gz
│   └── ...
└── sessions/
    ├── 2026-04-28.tar.gz
    └── ...
```

### Retention

- 30 daily backups retained automatically
- Older backups are deleted by the script

## Manual Backup

```bash
# Full backup
./scripts/backup.sh

# PostgreSQL only
docker exec $(docker ps -qf "name=postgres" | head -1) \
  pg_dump -U wa_user wa_marketing | gzip > backup-$(date +%Y-%m-%d).sql.gz
```

## Restore Procedures

### PostgreSQL Restore

```bash
# Stop the backend to prevent writes during restore
docker compose -f docker-compose.prod.yml stop backend

# Restore from backup
gunzip < /backups/postgres/2026-04-28.sql.gz | \
  docker exec -i $(docker ps -qf "name=postgres" | head -1) \
  psql -U wa_user wa_marketing

# Restart backend
docker compose -f docker-compose.prod.yml start backend
```

### Session Files Restore

```bash
# Stop session manager
docker compose -f docker-compose.prod.yml stop session-manager

# Find the volume path
VOLUME_PATH=$(docker volume inspect wa-marketing_session_data -f '{{.Mountpoint}}')

# Restore
tar -xzf /backups/sessions/2026-04-28.tar.gz -C "$VOLUME_PATH"

# Restart session manager
docker compose -f docker-compose.prod.yml start session-manager
```

## Testing Restores

**Important:** An untested backup is not a backup. Test restore monthly:

1. Spin up a separate test PostgreSQL instance
2. Restore the latest backup into it
3. Verify data integrity by running queries
4. Document the restore time for SLA planning
