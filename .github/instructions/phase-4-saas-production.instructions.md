---
description: "Use when building Phase 4 of the WhatsApp Marketing SaaS: subscription plan management, interactive WhatsApp messages, smart send-time optimization, birthday and anniversary automations, REST API with API key authentication, outbound webhook reliability improvements, Docker Swarm production stack, PgBouncer connection pooling, Prometheus metrics, and automated backup strategy. Covers weeks 13–16 of the roadmap and production hardening."
---

# Phase 4 — SaaS Polish, Production Hardening & Premium Features

**Scope:** Weeks 13–16 | Prerequisites: Phases 1–3 complete and passing all DoD criteria.
**Goal:** Production-ready SaaS deployment on Docker Swarm with subscription plan enforcement, interactive messages, smart sending windows, date-based automations, public REST API, zero-downtime deployments, observability, and automated backups.

---

## 1. Subscription Plan Management

### Plan Tiers

```typescript
// config/plans.config.ts

export const PLANS = {
  FREE: {
    maxContacts: 500,
    maxSessions: 1,
    maxCampaignsPerMonth: 5,
    maxMessagesPerDay: 100,
    maxTeamMembers: 1,
    aiGenerationsPerDay: 5,
    canUseWebhooks: false,
    canUseApi: false,
    canUseAutoReply: false,
    canUseDrip: false,
  },
  STARTER: {
    maxContacts: 5_000,
    maxSessions: 2,
    maxCampaignsPerMonth: 30,
    maxMessagesPerDay: 500,
    maxTeamMembers: 3,
    aiGenerationsPerDay: 30,
    canUseWebhooks: true,
    canUseApi: false,
    canUseAutoReply: true,
    canUseDrip: true,
  },
  PRO: {
    maxContacts: 50_000,
    maxSessions: 10,
    maxCampaignsPerMonth: -1,  // unlimited
    maxMessagesPerDay: 2_000,
    maxTeamMembers: 10,
    aiGenerationsPerDay: 200,
    canUseWebhooks: true,
    canUseApi: true,
    canUseAutoReply: true,
    canUseDrip: true,
  },
  AGENCY: {
    maxContacts: -1,     // unlimited
    maxSessions: -1,
    maxCampaignsPerMonth: -1,
    maxMessagesPerDay: -1,
    maxTeamMembers: -1,
    aiGenerationsPerDay: -1,
    canUseWebhooks: true,
    canUseApi: true,
    canUseAutoReply: true,
    canUseDrip: true,
  },
} as const;
```

### Plan Enforcement — Guard, Not Scattered Checks

Do NOT scatter `if (user.plan === 'FREE') throw new ForbiddenException()` throughout services. Centralize enforcement:

```typescript
// common/guards/plan-feature.guard.ts

@Injectable()
export class PlanFeatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.get<keyof PlanConfig>('planFeature', context.getHandler());
    if (!feature) return true;

    const user = context.switchToHttp().getRequest().user;
    const plan = PLANS[user.plan];

    if (typeof plan[feature] === 'boolean') return plan[feature] === true;
    if (typeof plan[feature] === 'number') {
      const usage = context.switchToHttp().getRequest().planUsage?.[feature] ?? 0;
      return plan[feature] === -1 || usage < plan[feature];
    }
    return false;
  }
}

// Usage:
@PlanFeature('canUseDrip')
@Post('/drip-sequences')
createDripSequence() { /* ... */ }
```

### Usage Tracking Schema

### Usage Tracking Entity (TypeORM)

```typescript
// billing/entities/plan-usage.entity.ts
import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity('plan_usages')
export class PlanUsage {
  @PrimaryColumn() userId: string;
  @Column({ default: 0 }) contactCount: number;          // maintained via EventEmitter events
  @Column({ default: 0 }) sessionsCount: number;
  @Column({ default: 0 }) campaignsThisMonth: number;
  @Column({ default: () => 'NOW()' }) lastResetAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @OneToOne(() => User) @JoinColumn({ name: 'userId' }) user: User;
}
```

Use NestJS EventEmitter to update `PlanUsage` when contacts/sessions/campaigns are created or deleted.

---

## 2. Interactive WhatsApp Messages

Baileys natively supports interactive messages. Add this to the Template and Session Manager.

### Message Types to Support

```typescript
// templates/interactive-template.types.ts

// 1. Button Message (up to 3 buttons)
interface ButtonMessage {
  type: 'button';
  body: string;
  footer?: string;
  buttons: Array<{
    id: string;         // returned in reply
    text: string;      // label, max 20 chars
  }>;
}

// 2. List Message (menu-style, up to 10 sections, 10 items each)
interface ListMessage {
  type: 'list';
  body: string;
  buttonText: string;  // text on the button that opens the list
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
}

// 3. Template with Quick Reply (lightweight buttons)
interface QuickReplyMessage {
  type: 'quick_reply';
  body: string;
  buttons: Array<{ text: string }>;
}
```

### Baileys Sending

```typescript
// session-manager/MessageSender.ts

async sendInteractive(jid: string, msg: ButtonMessage | ListMessage): Promise<void> {
  if (msg.type === 'button') {
    await socket.sendMessage(jid, {
      text: msg.body,
      footer: msg.footer,
      buttons: msg.buttons.map(b => ({ buttonId: b.id, buttonText: { displayText: b.text }, type: 1 })),
      headerType: 1,
    });
  } else if (msg.type === 'list') {
    await socket.sendMessage(jid, {
      text: msg.body,
      footer: '',
      title: '',
      buttonText: msg.buttonText,
      sections: msg.sections,
      listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
    });
  }
}
```

### Button Reply Handling in Auto-Reply Engine

When a contact replies to a button message, Baileys delivers a `buttonsResponseMessage`. Handle this in `InboundHandler`:

```typescript
if (msg.buttonsResponseMessage) {
  const selectedId = msg.buttonsResponseMessage.selectedButtonId;
  // Route to Auto-Reply engine to match buttonId against rules
  // This enables menu-driven chatbot flows
}
```

---

## 3. Smart Send-Time Optimization

### Business Hours Configuration

### Business Hours Entity (TypeORM)

```typescript
// settings/entities/user-settings.entity.ts
@Entity('user_settings')
export class UserSettings {
  @PrimaryColumn() userId: string;
  @Column({ default: 'UTC' }) timezone: string;
  @Column({ default: 9 }) sendWindowStart: number;    // hour of day (0–23) in user timezone
  @Column({ default: 18 }) sendWindowEnd: number;     // hour of day (0–23) in user timezone
  @Column('simple-array', { default: '1,2,3,4,5' }) sendDaysOfWeek: number[];  // 1=Mon, 7=Sun
  @Column({ default: false }) smartSendEnabled: boolean;

  @OneToOne(() => User) @JoinColumn({ name: 'userId' }) user: User;
}
```

### Enforcement in BullMQ Processor

```typescript
// queue/rate-limiter.service.ts

async isWithinSendWindow(userId: string): Promise<boolean> {
  const settings = await this.settingsRepo.findByUserId(userId);
  if (!settings.smartSendEnabled) return true;

  const nowInUserTz = toZonedTime(new Date(), settings.timezone);
  const hour = getHours(nowInUserTz);
  const dayOfWeek = getDayOfWeek(nowInUserTz); // 1=Mon, 7=Sun

  return (
    settings.sendDaysOfWeek.includes(dayOfWeek) &&
    hour >= settings.sendWindowStart &&
    hour < settings.sendWindowEnd
  );
}

// If outside window: do NOT fail the job — reschedule it for the next window opening:
// Calculate "next window start" → Bull job delay = ms until that moment
```

---

## 4. Birthday & Anniversary Automations

### Date Automation Entity (TypeORM)

```typescript
// automations/entities/date-automation.entity.ts
@Entity('date_automations') @Index(['userId', 'isActive'])
export class DateAutomation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() sessionId: string;
  @Column() templateId: string;
  @Column() fieldName: string;              // contact customField holding the date (e.g. 'birthday')
  @Column({ default: '09:00' }) sendTime: string;  // HH:mm in user's timezone
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Template) @JoinColumn({ name: 'templateId' }) template: Template;
}
```

### Trigger Mechanism

Use a **daily cron job** (via `@nestjs/schedule`) that runs at midnight UTC:

```typescript
// automations/date-automation.service.ts

@Cron('0 0 * * *', { timeZone: 'UTC' })
async dailyAutomationCheck(): Promise<void> {
  // For each active DateAutomation:
  // 1. Find all contacts where customFields[fieldName] date matches today (MM-DD match, ignore year)
  // 2. Check contact is not opted out
  // 3. Enqueue a message job with delay = ms until sendTime in user's timezone
  // Use TypeORM query builder for efficient date extraction over JSONB field:
  //   .where(
  //     `EXTRACT(MONTH FROM (contact."customFields"->>'${fieldName}')::date) = :month`,
  //     { month: today.getMonth() + 1 }
  //   )
  //   .andWhere(
  //     `EXTRACT(DAY FROM (contact."customFields"->>'${fieldName}')::date) = :day`,
  //     { day: today.getDate() }
  //   )
}
```

> **Edge case:** February 29 birthdays — send on Feb 28 in non-leap years.

---

## 5. Public REST API with API Key Authentication

### API Key Entity (TypeORM)

```typescript
// api-keys/entities/api-key.entity.ts
@Entity('api_keys') @Index(['userId']) @Index(['keyHash'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;                         // e.g. "My CRM Integration"
  @Column({ unique: true }) keyHash: string;      // SHA-256 hash — raw key NEVER stored
  @Column() keyPrefix: string;                    // first 12 chars for UI display: "wam_abc1..."
  @Column({ nullable: true }) lastUsedAt?: Date;
  @Column({ nullable: true }) expiresAt?: Date;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;

  @ManyToOne(() => User, u => u.apiKeys, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
}
```

### API Key Generation

```typescript
// api-keys/api-key.service.ts

async createApiKey(userId: string, name: string): Promise<{ key: string, id: string }> {
  // Generate cryptographically secure key: wam_ + 32 random bytes (base64url)
  const rawKey = `wam_${randomBytes(32).toString('base64url')}`;

  // Store ONLY the SHA-256 hash — never store the plaintext
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 12);

  await this.repo.create({ userId, name, keyHash, keyPrefix });

  // Return the key ONCE — user must copy it now, it cannot be retrieved again
  return { key: rawKey, id };
}

async validateApiKey(rawKey: string): Promise<User | null> {
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const record = await this.repo.findByHash(keyHash);
  if (!record || !record.isActive) return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;
  await this.repo.update(record.id, { lastUsedAt: new Date() });  // async, non-blocking
  return record.user;
}
```

### API Key Guard

```typescript
// common/guards/api-key.guard.ts

// Accept key via Authorization header: "Bearer wam_..."
// OR via X-API-Key header (simpler for CLI/curl usage)
// NEVER accept via query parameter (would leak to server logs)

// The guard checks both JWT (web app users) and API key (API users)
// so the same endpoints work for both
```

### Public API Endpoints (available to API key holders)

```
POST   /api/v1/messages/send              → send a single message
POST   /api/v1/campaigns                 → create and optionally start a campaign
GET    /api/v1/campaigns                 → list campaigns (paginated)
GET    /api/v1/campaigns/:id             → campaign status + stats
POST   /api/v1/contacts                  → create or update a contact
GET    /api/v1/contacts/:phoneOrId       → get contact details
DELETE /api/v1/contacts/:id/unsubscribe  → opt-out a contact
GET    /api/v1/analytics/campaigns/:id   → campaign analytics
```

- Public API requires `canUseApi: true` in plan config (PRO/AGENCY only)
- Rate limit API keys: 60 requests/minute per key, 1000 requests/hour (via `@nestjs/throttler`)
- Return standard error responses: `{ statusCode, message, error }` for all errors
- Always version: `/api/v1/` — never remove or change a v1 endpoint (add v2 instead)

---

## 6. Docker Swarm Production Stack

### Stack Topology

```yaml
# docker-compose.prod.yml  (used as: docker stack deploy -c docker-compose.prod.yml wa-marketing)

version: "3.9"

services:
  backend:
    image: registry.example.com/wa-marketing/backend:${TAG}
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 15s
        order: start-first    # new replica starts before old one stops (zero-downtime)
        failure_action: rollback
      restart_policy:
        condition: on-failure
        max_attempts: 3
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    secrets:
      - db_password
      - jwt_secret
      - minio_secret_key
    environment:
      DATABASE_URL: "postgresql://wa_user:$(cat /run/secrets/db_password)@pgbouncer:5432/wa_marketing"
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    networks:
      - backend_net

  frontend:
    image: registry.example.com/wa-marketing/frontend:${TAG}
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
    networks:
      - frontend_net

  session-manager:
    image: registry.example.com/wa-marketing/session-manager:${TAG}
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]  # pin to one node — sessions stored on local filesystem
    volumes:
      - sessions_data:/app/sessions          # named volume on pinned node
    networks:
      - backend_net

  pgbouncer:
    image: edoburu/pgbouncer
    environment:
      DATABASE_URL: "postgresql://wa_user:@postgres:5432/wa_marketing"
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 200
      DEFAULT_POOL_SIZE: 20
    networks:
      - backend_net

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: wa_marketing
      POSTGRES_USER: wa_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints: [node.labels.db == "true"]
    secrets:
      - db_password
    networks:
      - backend_net

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass-file /run/secrets/redis_password
    volumes:
      - redis_data:/data
    deploy:
      replicas: 1
    secrets:
      - redis_password
    networks:
      - backend_net

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    deploy:
      replicas: 1
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_secret_key
    secrets:
      - minio_secret_key
    networks:
      - backend_net

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot_data:/etc/letsencrypt:ro
    networks:
      - frontend_net
      - backend_net
    deploy:
      replicas: 1

secrets:
  db_password:
    external: true
  jwt_secret:
    external: true
  minio_secret_key:
    external: true
  redis_password:
    external: true

volumes:
  postgres_data:
  redis_data:
  minio_data:
  sessions_data:
  certbot_data:

networks:
  backend_net:
    driver: overlay
    internal: true
  frontend_net:
    driver: overlay
```

### Secrets Setup (one-time, before first deploy)

```bash
# Create secrets in the Swarm (run on manager node):
echo "your_strong_db_password" | docker secret create db_password -
openssl rand -base64 48 | docker secret create jwt_secret -
openssl rand -base64 32 | docker secret create minio_secret_key -
openssl rand -base64 32 | docker secret create redis_password -

# NEVER store these in any file, commit, or env var
# Secrets are stored encrypted in the Swarm Raft log
```

### PgBouncer — Connection Pooling

When `backend` runs 2 replicas each with a NestJS TypeORM `DataSource` holding multiple DB connections, you can easily exhaust PostgreSQL's `max_connections` (default 100).

**Fix:** Route all DB connections through PgBouncer in **transaction mode**:
- PgBouncer maintains a pool of 20 persistent connections to Postgres
- Up to 200 clients can connect to PgBouncer simultaneously
- Clients get a Postgres connection only for the duration of a transaction
- Backend `DATABASE_URL` points to PgBouncer (`pgbouncer:5432`), not Postgres directly

---

## 7. Observability — Metrics & Logging

### Prometheus Metrics

Add `@willsoto/nestjs-prometheus` to expose metrics:

```typescript
// Key custom metrics to track:
// - wa_messages_sent_total (counter, labels: userId, sessionId, status)
// - wa_campaign_duration_seconds (histogram, labels: campaignId)
// - wa_queue_depth (gauge, labels: userId)  → Bull queue pending count
// - wa_session_status (gauge, labels: sessionId, status)
// - wa_api_requests_total (counter, labels: method, route, status_code)
// - wa_ai_generations_total (counter, labels: provider, userId)
```

Add a **Grafana** service to docker-compose for visualization:

```yaml
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    networks:
      - backend_net
    deploy:
      replicas: 1
```

### Structured Logging with Pino

```typescript
// main.ts
// Pino outputs JSON logs in production — parseable by log aggregators (Loki, Datadog, etc.)

app.useLogger(app.get(Logger));

// Every log line must include:
// - requestId (X-Request-ID header, propagated via AsyncLocalStorage)
// - userId (from JWT)
// - service name
// - timestamp (ISO UTC)
// - level
```

### Log Levels
- `error`: unhandled exceptions, critical failures (DB down, session banned)
- `warn`: non-critical issues (rate limit approached, retry attempt)
- `info`: significant business events (campaign started, contact opted out, QR scanned)
- `debug`: verbose flow tracing (disabled in production, enabled per-request via header)

---

## 8. Database Backup Strategy

### Automated PostgreSQL Backup

```bash
# Run as a Docker Swarm service on a cron schedule:
# Every night at 2:00 AM UTC → pg_dump → compress → upload to MinIO (different bucket than media)

pg_dump $DATABASE_URL | gzip | \
  mc pipe minio/wa-backups/postgres/$(date +%Y-%m-%d).sql.gz

# Retention: keep last 30 daily backups, last 12 weekly backups
# Test restore monthly — an untested backup is not a backup
```

### MinIO (Media) Backup

- Enable MinIO bucket versioning for `wa-media` bucket
- Configure MinIO replication to a second storage location (or object storage provider) if budget allows
- At minimum: daily snapshot of MinIO data directory

### Session Files Backup

```bash
# Sessions directory on the pinned Swarm node — backup daily:
tar -czf sessions-$(date +%Y-%m-%d).tar.gz /var/lib/docker/volumes/wa-marketing_sessions_data/
# Upload to MinIO backup bucket
```

---

## 9. CI/CD Pipeline

### Pipeline Stages (GitHub Actions or Gitea)

```yaml
# .github/workflows/deploy.yml

# Stage 1: Test
# - npm run lint
# - npm run test (Jest unit + integration)
# - typeorm migration:show -d dist/database/data-source.js  (verify no pending migrations)

# Stage 2: Build
# - docker build backend → push to registry
# - docker build frontend → push to registry
# - docker build session-manager → push to registry

# Stage 3: Deploy (main branch only)
# - SSH to manager node
# - docker stack deploy --with-registry-auth -c docker-compose.prod.yml wa-marketing
# - Watch rollout: docker service ps wa-marketing_backend
```

### Database Migration in CI/CD

```bash
# Run BEFORE deploying new containers:
# typeorm migration:run -d dist/database/data-source.js  (applies all pending migrations)
# If migration fails → abort deployment — never deploy code without the required schema

# Never run typeorm migration:generate in production — only use migration:run
```

---

## 10. Email Notification System

### Transactional Emails (Phase 4)

Use **Nodemailer** with an SMTP provider (e.g. Brevo free tier: 300 emails/day):

```typescript
// notifications/email.service.ts

// Email types to implement:
// - EMAIL_VERIFICATION       → on registration
// - PASSWORD_RESET           → forgot password flow
// - CAMPAIGN_COMPLETED       → when campaign finishes
// - SESSION_DISCONNECTED     → when a WA session drops
// - TOS_BLOCK_ALERT          → when session enters TOS_BLOCK state
// - WEBHOOK_ABANDONED        → when webhook delivery gives up after 5 retries
// - DAILY_SUMMARY            → optional daily stats digest (user opt-in)
```

Use **React Email** or **MJML** for HTML email templates — avoid writing raw HTML email.

---

## 11. Security Hardening Checklist

Before production launch, verify all of the following:

```
Security:
[ ] All secrets loaded from Docker Swarm Secrets (never in compose files or .env)
[ ] HTTPS enforced via nginx (HTTP redirects to HTTPS)
[ ] HSTS header set (Strict-Transport-Security: max-age=31536000)
[ ] JWT secret >= 32 chars, rotatable without full downtime
[ ] API keys stored as SHA-256 hash only (plaintext never in DB)
[ ] OAuth tokens (Google Sheets) stored AES-256-GCM encrypted
[ ] Rate limiting on all public endpoints (Throttler + per-IP)
[ ] SSRF protection on webhook URL and Google Sheets URL input
[ ] Input validation (whitelist) on all DTOs (class-validator whitelist:true)
[ ] SQL injection impossible (TypeORM query builder parameterizes all queries; no raw string concatenation in queries)
[ ] File upload validates MIME from magic bytes (not extension)
[ ] Prompt injection sanitization on all AI inputs
[ ] CORS configured to allow only the frontend origin
[ ] Security headers: X-Content-Type-Options, X-Frame-Options, CSP
[ ] Dependency audit: npm audit --audit-level=high passes
[ ] No DEBUG logging in production (NODE_ENV=production disables it)

Infrastructure:
[ ] PostgreSQL not exposed on public port (only accessible from backend_net overlay)
[ ] Redis not exposed on public port
[ ] MinIO console (port 9001) not exposed publicly
[ ] Docker socket not mounted in any service container
[ ] All services run as non-root user (user: node in Dockerfile)
[ ] Images built FROM official Node.js Alpine base (minimal attack surface)
[ ] Regular automated backups with tested restore procedure
```

---

## 12. Frontend Pages — Phase 4

```
app/(dashboard)/
├── settings/
│   ├── plan/page.tsx            ← current plan, usage meters, upgrade button
│   ├── api-keys/page.tsx        ← list keys + create key (show once dialog)
│   ├── send-window/page.tsx     ← business hours configuration + timezone picker
│   └── notifications/page.tsx  ← email notification preferences
├── automations/
│   └── date-based/page.tsx     ← birthday/anniversary automation list + builder
└── admin/                       ← ADMIN role only
    ├── users/page.tsx           ← user list, plan management
    └── sessions/page.tsx        ← global session health overview
```

### Plan Usage Page
- Show progress bars for: contacts used / max, sessions connected / max, campaigns this month / max
- Highlight limits approaching (yellow at 80%, red at 95%)
- "Upgrade" CTA button (links to billing page or contact form if no payment gateway)

---

## 13. Unit Test Instructions — Phase 4

### Key Unit Tests

```typescript
// plan-feature.guard.spec.ts
describe('PlanFeatureGuard', () => {
  it('allows action when feature flag is true on user plan')
  it('blocks action when feature flag is false on user plan (e.g. FREE + canUseDrip)')
  it('blocks action when numeric limit reached (e.g. FREE contacts = 500)')
  it('allows unlimited (-1) numeric feature without usage check')
  it('returns true when no @PlanFeature decorator is present on handler')
})

// api-key.service.spec.ts
describe('ApiKeyService', () => {
  it('generates key with wam_ prefix')
  it('stores only SHA-256 hash — raw key not persisted to DB')
  it('validateApiKey returns user for valid unexpired key')
  it('validateApiKey returns null for expired key')
  it('validateApiKey returns null for inactive key (isActive=false)')
  it('validateApiKey returns null for non-existent hash (wrong key)')
  it('updates lastUsedAt on successful validation')
})

// date-automation.service.spec.ts
describe('DateAutomationService', () => {
  it('matches contact birthday by MM-DD regardless of year')
  it('enqueues message job with correct delay to sendTime in user timezone')
  it('sends on Feb 28 when birthday is Feb 29 in a non-leap year')
  it('skips opted-out contacts')
  it('skips contacts with missing or invalid date value in customFields[fieldName]')
})

// rate-limiter send-window spec
describe('SendWindow (SmartSend)', () => {
  it('returns true when smart send is disabled (always allow)')
  it('returns true during configured business hours in user timezone')
  it('returns false outside business hours')
  it('returns false on a weekend day excluded from sendDaysOfWeek')
  it('calculates correct delay (ms) to next window opening')
})

// plan-usage.service.spec.ts
describe('PlanUsage', () => {
  it('increments contactCount on contact.created event')
  it('decrements contactCount on contact.deleted event')
  it('resets campaignsThisMonth when lastResetAt is previous month')
})
```

---

## 14. E2E Test Instructions — Phase 4

### E2E File Structure (add to backend/test/)

```
backend/test/
├── plan-limits.e2e-spec.ts       ← plan enforcement across all feature gates
├── api-keys.e2e-spec.ts          ← key creation, authentication, rate limiting
├── date-automation.e2e-spec.ts   ← birthday fire, Feb 29 edge case
└── send-window.e2e-spec.ts       ← smart send outside hours defers correctly
```

### Key E2E Tests

```typescript
// plan-limits.e2e-spec.ts
describe('Plan Limits', () => {
  it('FREE user: 6th campaign creation returns 403 PLAN_LIMIT_EXCEEDED')
  it('FREE user: creating contact 501 returns 403 PLAN_LIMIT_EXCEEDED')
  it('STARTER user: POST /drip-sequences succeeds (canUseDrip=true)')
  it('FREE user: POST /drip-sequences returns 403 (canUseDrip=false)')
  it('PRO user: POST /api-keys succeeds (canUseApi=true)')
  it('FREE user: POST /api-keys returns 403 (canUseApi=false)')
})

// api-keys.e2e-spec.ts
describe('API Key Auth', () => {
  it('GET /api/v1/contacts with valid API key returns 200')
  it('GET /api/v1/contacts with invalid key returns 401')
  it('GET /api/v1/contacts with expired key returns 401')
  it('61st request in 1 minute window returns 429 (rate limit)')
  it('Key shown only in create response — subsequent GET returns keyPrefix only')
})

// date-automation.e2e-spec.ts
describe('Date Automations', () => {
  it('2 BD contacts with birthday today receive scheduled messages')
  it('Contact with optedOut=true is excluded')
  it('BD contact with birthday Feb 29 receives message on Feb 28 in non-leap year')
})
```

### Load Test (Pre-Production Gate)

```bash
# Use k6 or Artillery for load testing:
# k6 run --vus 500 --duration 60s load-test/campaign-send.js
# Acceptance: p95 response time < 500ms, error rate < 0.1%
# Run against staging stack (Docker Swarm preview) before production deploy
```

---

## 15. Demo Data Seeding — Bangladesh Context

Extend Phase 1–3 seeds with Phase 4 production/plan features:

### Seed File Additions

```
backend/src/database/seeds/
├── 11-plan-usage.seed.ts        ← realistic usage levels per demo user
├── 12-api-keys.seed.ts          ← pre-created API keys per PRO user (hashed)
├── 13-date-automations.seed.ts  ← birthday + Eid automation per user
└── 14-user-settings.seed.ts     ← BD timezone (Asia/Dhaka) + business hours
```

### BD Plan Usage Demo

```typescript
// 11-plan-usage.seed.ts
// Rahim (PRO): contactCount: 2400 / 50000, campaignsThisMonth: 8 / unlimited
// Karim (STARTER): contactCount: 3800 / 5000 (76% — approaching limit, shows yellow)
// Nasrin (FREE): contactCount: 420 / 500 (84% — shows red, upgrade CTA triggers)
```

### BD Date Automation Demo

```typescript
// 13-date-automations.seed.ts
// Rahim:
//   Automation 1: fieldName='birthday', sendTime='09:00', template='শুভ জন্মদিন {{name}}!'
//   Automation 2: fieldName='anniversary', sendTime='10:00', template='Happy Anniversary {{name}}!'
//
// Seed 5 BD contacts (per user) whose birthday is today's MM-DD
// so the automation fires immediately during the demo

// 14-user-settings.seed.ts
// All 3 demo users: timezone='Asia/Dhaka', sendWindowStart=9, sendWindowEnd=21
// (9 AM – 9 PM Dhaka time — wide window for BD business hours)
// sendDaysOfWeek=[0,1,2,3,4,6]  // Fri is weekend in BD (6=Sat also off, 5=Fri off, adjust as needed)
```

---

## 16. Feature Documentation Guide — Phase 4

```
docs/guides/
├── subscription-plans.md        ← plan tiers, usage limits, upgrading, billing
├── api-reference.md             ← API key creation, endpoints, auth, rate limits
├── smart-send-window.md         ← configuring business hours, timezone, smart send
├── birthday-automations.md      ← setting up date fields, automation config, Feb 29
├── interactive-messages.md      ← button/list messages, limitations, chatbot flows
├── production-deployment.md     ← Swarm setup, secrets, rolling deploy, rollback
└── backup-restore.md            ← backup schedule, retention, restore procedure
```

---

## 17. Definition of Done — Phase 4

- [ ] Plan limits enforced via `PlanFeatureGuard` — no scattered checks in services
- [ ] Button and list interactive messages send and receive correctly
- [ ] Smart send window defers messages outside business hours to next open window (verified with test)
- [ ] Birthday automation fires for all contacts with today's MM-DD in the configured field
- [ ] API keys stored as SHA-256 hash only, shown to user only once at creation
- [ ] Public REST API accepts API key auth and enforces plan limits
- [ ] Docker Swarm stack deploys with zero-downtime rolling update (tested)
- [ ] All secrets loaded from Docker Swarm Secrets (no plaintext in compose or code)
- [ ] PgBouncer in front of Postgres — no connection pool exhaustion under load test
- [ ] Prometheus metrics endpoint active; Grafana dashboard shows key metrics
- [ ] Automated nightly Postgres + MinIO backups running; restore tested successfully
- [ ] All security hardening checklist items checked
- [ ] `npm audit --audit-level=high` passes with 0 vulnerabilities
- [ ] Unit test coverage ≥ 80% across all Phase 4 modules
- [ ] All E2E critical path tests pass (plan limits, API key auth, date automation)
- [ ] BD demo seed data shows plan usage meters and date automations
- [ ] `docs/guides/` contains guides for all Phase 4 features and production deployment
- [ ] Load test: 500 concurrent users, 10 active campaigns → system stable, no errors
