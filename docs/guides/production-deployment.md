# Production Deployment Guide

## Architecture

```
┌─────────┐    ┌──────────┐    ┌──────────┐
│  Nginx   │───│ Frontend  │    │ Grafana  │
│ (Proxy)  │   │ (Next.js) │    │          │
└────┬─────┘   └──────────┘    └────┬─────┘
     │                               │
     ├───────────────────────────────┤
     │         backend_net           │
     │                               │
┌────┴─────┐  ┌──────────┐  ┌──────┴──────┐
│ Backend  │──│ PgBouncer│──│ PostgreSQL  │
│ (NestJS) │  │ (Pool)   │  │ (Data)      │
│ x2       │  └──────────┘  └─────────────┘
└────┬─────┘
     ├──────────────┬──────────────┐
┌────┴─────┐  ┌────┴─────┐  ┌────┴──────┐
│  Redis   │  │  MinIO   │  │ Session   │
│ (Queue)  │  │ (Media)  │  │ Manager   │
└──────────┘  └──────────┘  └───────────┘
                              ┌───────────┐
                              │Prometheus │
                              │ (Metrics) │
                              └───────────┘
```

## Prerequisites

- Docker Engine 24.0+ with Docker Compose v2
- At least 4GB RAM, 2 CPU cores
- Domain name with DNS configured

## Initial Setup

### 1. Clone and configure

```bash
git clone <repo-url>
cd wa-marketing
cp .env.example .env.production
# Edit .env.production with production values
```

### 2. Set strong secrets

```bash
# Generate secure passwords
openssl rand -base64 48  # For JWT_SECRET
openssl rand -base64 32  # For POSTGRES_PASSWORD
openssl rand -base64 32  # For MINIO password
```

### 3. Deploy

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 4. Verify

```bash
# Check all services are healthy
docker compose -f docker-compose.prod.yml ps

# Check backend health
curl http://localhost/api/v1/health

# Check metrics endpoint
curl http://localhost:3001/metrics
```

## PgBouncer Connection Pooling

PgBouncer sits between the backend and PostgreSQL:
- **Mode:** Transaction pooling — connections returned to pool after each transaction
- **Max clients:** 200 (backend replicas share this pool)
- **Pool size:** 20 persistent connections to PostgreSQL
- Backend `DATABASE_URL` points to PgBouncer, not PostgreSQL directly

## Zero-Downtime Deployments

The production stack uses rolling updates:
- `order: start-first` — new container starts before old one stops
- `parallelism: 1` — one container at a time
- `delay: 15s` — wait between container updates
- `failure_action: rollback` — automatic rollback on failure

## Monitoring

### Prometheus
- Scrapes backend metrics every 10 seconds
- Available at port 9090 (internal network)
- 30-day retention

### Grafana
- Dashboard visualization for metrics
- Default admin password set via `GRAFANA_PASSWORD` env var
- Available at port 3000 (internal network, access via nginx)

### Key Metrics
- `wa_messages_sent_total` — Total messages by status
- `wa_campaign_duration_seconds` — Campaign completion times
- `wa_queue_depth` — BullMQ queue size
- `wa_session_status` — WhatsApp session health
- `wa_api_requests_total` — API request counts

## Backup Strategy

Automated backups run daily at 2:00 AM UTC via `scripts/backup.sh`:

1. **PostgreSQL:** `pg_dump` → gzip → `/backups/postgres/`
2. **Session files:** tar → gzip → `/backups/sessions/`
3. **Retention:** 30 days for daily backups

### Manual backup

```bash
./scripts/backup.sh
```

### Restore from backup

```bash
gunzip < /backups/postgres/2026-04-28.sql.gz | docker exec -i <postgres-container> psql -U wa_user wa_marketing
```

## Security Checklist

- [ ] All secrets in `.env.production` are strong random values
- [ ] HTTPS configured in nginx
- [ ] PostgreSQL not exposed on public port
- [ ] Redis not exposed on public port
- [ ] MinIO console not publicly accessible
- [ ] CORS restricted to frontend origin only
- [ ] `npm audit --audit-level=high` passes
