---
description: "Use when building Phase 1 of the WhatsApp Marketing SaaS: project scaffolding, NestJS monorepo setup, database schema, authentication, Baileys session manager, contact management, message templates, bulk sender engine, rate limiter, and basic campaign dashboard. Covers weeks 1–4 of the roadmap."
---

# Phase 1 — Foundation & Core MVP

**Scope:** Weeks 1–4 | Goal: Users can register, link their WhatsApp number via QR, import contacts, create templates, and launch a bulk text/media campaign with delivery tracking.

---

## 1. Monorepo Structure

Scaffold the project as a monorepo with three top-level apps:

```
/
├── backend/          ← NestJS API
├── frontend/         ← Next.js App Router
├── session-manager/  ← Standalone Node.js service (Baileys pool)
├── docs/             ← Proposal and architecture docs
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example
```

- Use **npm workspaces** or **Turborepo** for monorepo tooling.
- Each app has its own `package.json`, `tsconfig.json`, and `Dockerfile`.
- Share TypeScript interfaces via a `packages/types` workspace package (DTOs reused between backend and frontend).

---

## 2. Backend — NestJS Project Setup

### 2.1 Bootstrap

```bash
nest new backend --strict
cd backend
npm install @nestjs/config @nestjs/jwt @nestjs/passport @nestjs/swagger
npm install passport passport-jwt passport-local
npm install @nestjs/terminus             # health checks
npm install @nestjs/bullmq bullmq        # queues (use BullMQ, NOT legacy Bull)
npm install class-validator class-transformer
npm install @nestjs/typeorm typeorm pg   # TypeORM ORM with PostgreSQL driver
npm install typeorm-extension            # database seeding support
npm install pino pino-http nestjs-pino   # structured JSON logging
npm install libphonenumber-js            # phone normalization
npm install bcrypt @types/bcrypt
npm install multer @types/multer         # file upload
npm install jwt-decode                   # client-side JWT helper
```

> **Why TypeORM with NestJS?**
> TypeORM integrates natively via `@nestjs/typeorm`, uses decorator-based entity classes (colocating schema with domain code), and has built-in migration tooling (`typeorm migration:generate`). Always set `synchronize: false` in all environments — use explicit migrations only. Its `DataSource` API pairs cleanly with `ConfigModule` for environment-driven configuration.

### 2.2 Environment Configuration

Use `@nestjs/config` with **Joi schema validation** — fail fast on missing env vars at startup:

```typescript
// config/env.validation.ts
import * as Joi from 'joi';
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().optional(),
  SESSION_FILES_PATH: Joi.string().default('./sessions'),
});
```

**NEVER** use `process.env.X` directly in services — always inject via `ConfigService`.

### 2.3 API Versioning

Enable URI versioning from day one — changing this later is a breaking change:

```typescript
// main.ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
// All routes are now /api/v1/...
app.setGlobalPrefix('api');
```

### 2.4 Global Middleware & Pipes

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,          // strip unknown properties
  forbidNonWhitelisted: true,
  transform: true,          // auto-transform primitives (string→number etc.)
  transformOptions: { enableImplicitConversion: true },
}));
app.useGlobalFilters(new GlobalExceptionFilter());
app.useGlobalInterceptors(new ResponseTransformInterceptor());
```

### 2.5 Swagger / OpenAPI

Auto-generate API docs — required for frontend alignment and testing:

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('WA Marketing API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

## 3. Database Schema (TypeORM)

### 3.1 TypeORM Setup in AppModule

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    url: config.get('DATABASE_URL'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
    synchronize: false,      // NEVER true in any environment
    migrationsRun: false,    // run via CLI command, NOT on startup
    logging: config.get('NODE_ENV') === 'development',
  }),
}),

// database/data-source.ts  (used by TypeORM CLI only — not injected into NestJS)
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});
```

### 3.2 Enums

```typescript
// database/enums.ts
export enum Plan           { FREE = 'FREE', STARTER = 'STARTER', PRO = 'PRO', AGENCY = 'AGENCY' }
export enum SessionStatus  { DISCONNECTED = 'DISCONNECTED', CONNECTING = 'CONNECTING', QR_READY = 'QR_READY', CONNECTED = 'CONNECTED', TOS_BLOCK = 'TOS_BLOCK', BANNED = 'BANNED' }
export enum CampaignStatus { DRAFT = 'DRAFT', SCHEDULED = 'SCHEDULED', RUNNING = 'RUNNING', PAUSED = 'PAUSED', COMPLETED = 'COMPLETED', FAILED = 'FAILED' }
export enum MessageStatus  { PENDING = 'PENDING', SENT = 'SENT', DELIVERED = 'DELIVERED', READ = 'READ', FAILED = 'FAILED' }
export enum MediaType      { IMAGE = 'IMAGE', VIDEO = 'VIDEO', AUDIO = 'AUDIO', DOCUMENT = 'DOCUMENT' }
export enum Direction      { INBOUND = 'INBOUND', OUTBOUND = 'OUTBOUND' }
```

### 3.3 Entities

```typescript
// users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany, Index } from 'typeorm';

@Entity('users')
@Index(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column() passwordHash: string;
  @Column() name: string;
  @Column({ default: false }) isEmailVerified: boolean;
  @Column({ type: 'enum', enum: Plan, default: Plan.FREE }) plan: Plan;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt?: Date;   // soft delete — never hard-delete

  @OneToMany(() => WaSession, s => s.user) waSessions: WaSession[];
  @OneToMany(() => Contact, c => c.user) contacts: Contact[];
  @OneToMany(() => ContactGroup, g => g.user) contactGroups: ContactGroup[];
  @OneToMany(() => Template, t => t.user) templates: Template[];
  @OneToMany(() => Campaign, c => c.user) campaigns: Campaign[];
  @OneToMany(() => MessageLog, l => l.user) messageLogs: MessageLog[];
  @OneToMany(() => ApiKey, k => k.user) apiKeys: ApiKey[];
}

// whatsapp/entities/wa-session.entity.ts
@Entity('wa_sessions') @Index(['userId']) @Index(['status'])
export class WaSession {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ nullable: true }) phoneNumber?: string;   // set after QR scan
  @Column({ nullable: true }) displayName?: string;
  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.DISCONNECTED }) status: SessionStatus;
  @Column({ type: 'jsonb', nullable: true }) sessionData?: Record<string, unknown>;
  @Column({ nullable: true }) lastSeenAt?: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, u => u.waSessions) @JoinColumn({ name: 'userId' }) user: User;
  @OneToMany(() => Campaign, c => c.session) campaigns: Campaign[];
}

// contacts/entities/contact.entity.ts
@Entity('contacts')
@Unique(['userId', 'phone'])
@Index(['userId']) @Index(['phone']) @Index(['userId', 'optedOut'])
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() phone: string;        // E.164 format: +8801712345678
  @Column({ nullable: true }) name?: string;
  @Column({ nullable: true }) email?: string;
  @Column({ type: 'jsonb', default: {} }) customFields: Record<string, unknown>;
  @Column({ default: false }) optedOut: boolean;
  @Column({ nullable: true }) optedOutAt?: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt?: Date;

  @ManyToOne(() => User, u => u.contacts) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToMany(() => ContactGroup, g => g.contacts)
  @JoinTable({ name: 'contact_group_members', joinColumn: { name: 'contactId' }, inverseJoinColumn: { name: 'groupId' } })
  groups: ContactGroup[];
  @OneToMany(() => MessageLog, l => l.contact) messageLogs: MessageLog[];
}

// contacts/entities/contact-group.entity.ts
@Entity('contact_groups') @Index(['userId'])
export class ContactGroup {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, u => u.contactGroups) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToMany(() => Contact, c => c.groups) contacts: Contact[];
  @OneToMany(() => Campaign, c => c.group) campaigns: Campaign[];
}

// templates/entities/template.entity.ts
@Entity('templates') @Index(['userId'])
export class Template {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;
  @Column('text') body: string;   // supports {{name}}, {{phone}}, {{custom.*}}
  @Column({ nullable: true }) mediaUrl?: string;
  @Column({ type: 'enum', enum: MediaType, nullable: true }) mediaType?: MediaType;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt?: Date;

  @ManyToOne(() => User, u => u.templates) @JoinColumn({ name: 'userId' }) user: User;
  @OneToMany(() => Campaign, c => c.template) campaigns: Campaign[];
}

// campaigns/entities/campaign.entity.ts
@Entity('campaigns') @Index(['userId']) @Index(['status']) @Index(['scheduledAt'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() sessionId: string;
  @Column({ nullable: true }) templateId?: string;
  @Column({ nullable: true }) groupId?: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT }) status: CampaignStatus;
  @Column({ nullable: true }) scheduledAt?: Date;
  @Column({ nullable: true }) startedAt?: Date;
  @Column({ nullable: true }) completedAt?: Date;
  @Column({ default: 0 }) totalContacts: number;
  @Column({ default: 0 }) sentCount: number;
  @Column({ default: 0 }) deliveredCount: number;
  @Column({ default: 0 }) failedCount: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, u => u.campaigns) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => WaSession, s => s.campaigns) @JoinColumn({ name: 'sessionId' }) session: WaSession;
  @ManyToOne(() => Template, t => t.campaigns, { nullable: true }) @JoinColumn({ name: 'templateId' }) template?: Template;
  @ManyToOne(() => ContactGroup, g => g.campaigns, { nullable: true }) @JoinColumn({ name: 'groupId' }) group?: ContactGroup;
  @OneToMany(() => MessageLog, l => l.campaign) messageLogs: MessageLog[];
}

// analytics/entities/message-log.entity.ts
@Entity('message_logs')
@Index(['userId']) @Index(['campaignId']) @Index(['contactId']) @Index(['status']) @Index(['waMessageId'])
export class MessageLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ nullable: true }) campaignId?: string;
  @Column() contactId: string;
  @Column({ nullable: true }) waMessageId?: string;
  @Column({ type: 'enum', enum: Direction, default: Direction.OUTBOUND }) direction: Direction;
  @Column({ type: 'text', nullable: true }) body?: string;
  @Column({ nullable: true }) mediaUrl?: string;
  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.PENDING }) status: MessageStatus;
  @Column({ nullable: true }) sentAt?: Date;
  @Column({ nullable: true }) deliveredAt?: Date;
  @Column({ nullable: true }) readAt?: Date;
  @Column({ nullable: true }) failReason?: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, u => u.messageLogs) @JoinColumn({ name: 'userId' }) user: User;
  @ManyToOne(() => Campaign, c => c.messageLogs, { nullable: true, onDelete: 'SET NULL' }) @JoinColumn({ name: 'campaignId' }) campaign?: Campaign;
  @ManyToOne(() => Contact, c => c.messageLogs) @JoinColumn({ name: 'contactId' }) contact: Contact;
}
```

### 3.4 Migration Rules (Enforced)
- **NEVER** set `synchronize: true` in any environment — use migrations exclusively
- Generate: `typeorm migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts`
- Run in development: `typeorm migration:run -d src/database/data-source.ts`
- Run in CI/CD: `typeorm migration:run -d dist/database/data-source.js` (before deploying new containers)
- Every migration must have a working `down()` rollback method
- Document destructive migrations (column drops, renames) in `docs/migrations/`
- All entities with user-owned data use `@DeleteDateColumn()` for soft deletes — never hard-delete
- All timestamps stored as UTC (`timestamptz` in PostgreSQL)

---

## 4. Auth Module

### Responsibilities
- User registration with email verification
- Login (email + password) → JWT access token + refresh token
- Refresh token rotation (one-time use, stored hashed in DB)
- `JwtAuthGuard` as global guard (most endpoints require auth)
- `@Public()` decorator to opt-out specific endpoints (login, register, health)

### Key Implementation Points

```typescript
// auth/strategies/jwt.strategy.ts
// Validate: check user exists + not deleted + email verified
// Attach full user object to request (not just sub)

// auth/guards/jwt-auth.guard.ts
// Check for @Public() decorator first, skip validation if present

// Password rules (enforced via class-validator):
// - min 8 chars, at least 1 uppercase, 1 number, 1 special char
```

### Security Hardening
- Store only **hashed** refresh tokens (SHA256) — if DB is compromised, tokens are useless
- JWT secret minimum 32 characters (enforced via Joi) loaded from Docker Swarm Secret (not env file)
- Access token TTL: 15 minutes; Refresh token TTL: 7 days
- Rate limit auth endpoints: 5 attempts per IP per 15 minutes (`@nestjs/throttler`)
- Add `X-Request-ID` header tracing via interceptor for log correlation

---

## 5. Session Manager Service

This is a **standalone Node.js service** (not part of NestJS), because Baileys instances are long-lived processes that must survive NestJS restarts.

### Architecture

```
session-manager/
├── src/
│   ├── SessionPool.ts       ← Map<userId, BaileysInstance>
│   ├── BaileysInstance.ts   ← wraps one Baileys connection
│   ├── SessionStore.ts      ← persist/load session creds from filesystem
│   ├── QRServer.ts          ← SSE endpoint: streams QR code to frontend
│   ├── MessageSender.ts     ← receives jobs from BullMQ, calls Baileys send
│   ├── InboundHandler.ts    ← listens to Baileys messages.upsert event
│   └── HealthServer.ts      ← /health endpoint for Docker probe
├── sessions/                ← mounted Docker volume, one folder per userId
└── index.ts
```

### BaileysInstance State Machine

```
DISCONNECTED
    │ connect()
    ▼
CONNECTING
    │ QR generated
    ▼
QR_READY ──── timeout 60s ──→ DISCONNECTED
    │ user scans QR
    ▼
CONNECTED
    │ TOS violation detected
    ▼
TOS_BLOCK ──── alert user ──→ DISCONNECTED
    │ ban detected
    ▼
BANNED
```

### Reconnection — Exponential Backoff with Circuit Breaker

```typescript
// Never retry immediately on disconnect — use exponential backoff:
// Attempt 1: wait 2s
// Attempt 2: wait 4s
// Attempt 3: wait 8s
// After 5 failures: open circuit, alert admin, stop retrying
// Half-open after 5 minutes: try one reconnect
```

### Critical Baileys Configuration

```typescript
const socket = makeWASocket({
  auth: state,
  browser: Browsers.macOS('Chrome'),   // spoof native browser UA
  printQRInTerminal: false,
  syncFullHistory: false,              // reduce startup time
  markOnlineOnConnect: false,          // reduce suspicious activity signals
  generateHighQualityLinkPreview: false,
  getMessage: async (key) => { /* load from local store */ },
});

// ALWAYS listen for creds.update and save immediately:
socket.ev.on('creds.update', saveCreds);
```

### Anti-Ban Safeguards (Non-Negotiable)

- Minimum delay between sends: **2000ms** (hardcoded floor, user cannot go below)
- Default delay: **3000–8000ms** (random within range per message)
- Daily cap per session: **200 messages** (configurable up to plan limit)
- Call `socket.sendPresenceUpdate('composing', jid)` + `await delay(1000–3000ms)` before every send
- Call `socket.sendPresenceUpdate('paused', jid)` after send
- Vary message text via template variable substitution — never send byte-for-byte identical messages in bulk
- On `TOS_BLOCK` connection update: immediately pause all queued jobs for that session + emit alert event

### Idempotency on Bull Retry

```typescript
// Before sending, check MessageLog for waMessageId:
// If waMessageId already set → message was sent → skip, mark as duplicate
// This prevents double-sends when Bull retries a failed job
```

---

## 6. Contacts Module

### CSV/Excel Import Pipeline

```
Upload → Parse → Normalize phones → Validate → Deduplicate → Chunk insert
```

- **Parse:** use `papaparse` (CSV) + `xlsx` (Excel)
- **Normalize:** use `libphonenumber-js` → always store in **E.164 format** (e.g. `+8801712345678`)
- **Validate:** reject rows where phone is invalid after normalization
- **Deduplicate:** `upsert` on `(userId, phone)` unique constraint — update name/fields if exists
- **Chunk insert:** process in batches of **500 rows** — never load the entire file into memory at once
- **Progress:** report progress via WebSocket event (`contacts:import:progress`) to frontend
- Return a summary: `{ imported: N, updated: M, skipped: K, errors: [...] }`

### Phone Number Rules
- All phones stored in E.164 format — normalize on input, display with local format on output
- WhatsApp JID = phone without `+` + `@s.whatsapp.net` (e.g. `8801712345678@s.whatsapp.net`)
- Strip all non-digit characters before normalization
- Reject numbers that are not valid for any country

### Soft Delete
- `DELETE /contacts/:id` sets `deletedAt`, never hard deletes
- All queries filter `WHERE "deletedAt" IS NULL` automatically — TypeORM handles this via `@DeleteDateColumn()` (soft-delete is the default behaviour of all repository `find*` methods; use `withDeleted: true` only in admin contexts)

---

## 7. Templates Module

### Variable Engine

```typescript
// templates/variable-engine.service.ts

// Supported variables:
// {{name}}          → contact.name
// {{phone}}         → contact.phone (local format)
// {{custom.field}}  → contact.customFields.field
// {{date}}          → today's date
// {{time}}          → current time

// Security: strip HTML and sanitize input before substitution
// Use a safe parser — never eval() or use regex replace with user-controlled patterns
// Limit template body to 4096 characters (WhatsApp text limit)
```

### Media Attachments
- Store in MinIO bucket `wa-media`, path: `{userId}/{sha256_of_file}.{ext}` (content-addressed)
- Content-addressed naming deduplicates identical files across campaigns
- Validate MIME type server-side (not just extension) using `file-type` library
- Size limits: images 16MB, video 100MB, audio 16MB, documents 100MB
- Never serve MinIO URLs directly to clients — generate pre-signed URLs with 1-hour TTL

---

## 8. Campaigns Module & Bulk Sender Engine

### Campaign Flow

```
POST /campaigns          → create campaign (DRAFT)
POST /campaigns/:id/start → enqueue all messages → status: RUNNING
GET  /campaigns/:id      → return live status (sentCount, deliveredCount, failedCount)
POST /campaigns/:id/pause → pause queue processing → status: PAUSED
POST /campaigns/:id/cancel → drain queue, cancel remaining → status: FAILED
```

### BullMQ Queue Design

```typescript
// One queue per user: `campaign-{userId}`
// This ensures one user's volume doesn't delay another user's sends

// Job payload:
{
  campaignId: string,
  contactId: string,
  sessionId: string,
  templateId: string,
  idempotencyKey: string  // = `${campaignId}:${contactId}`
}

// Job options:
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 500 },
}
```

### Rate Limiter (Token Bucket)

```typescript
// rate-limiter.service.ts
// Implement token bucket per sessionId stored in Redis:
// - Bucket capacity: 1 token
// - Refill rate: 1 token per (delay_ms) milliseconds
// - Before each send: acquire token or wait
// This is more accurate than a fixed delay and handles burst correctly

// Also enforce daily cap via Redis counter:
// Key: `daily:sends:{sessionId}:{YYYY-MM-DD}`
// Expire at midnight UTC
// Reject job if counter >= dailyCap, re-queue for next day
```

### Campaign Status — Event-Driven Updates

```typescript
// After each message send, emit event:
eventEmitter.emit('message.sent', { campaignId, contactId, status, waMessageId });

// CampaignsService listens and increments sentCount/deliveredCount/failedCount
// Use NestJS EventEmitter for in-process events
// Emit WebSocket event for real-time frontend updates:
// gateway.emit('campaign:progress', { campaignId, sentCount, deliveredCount, failedCount })
```

---

## 9. WebSocket Gateway (Real-Time)

Add a NestJS WebSocket Gateway from Phase 1 so the frontend can watch campaign progress live:

```typescript
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL }, namespace: '/ws' })
export class AppGateway {
  @WebSocketServer() server: Server;

  // Events emitted to frontend:
  // 'campaign:progress'  → { campaignId, sentCount, deliveredCount, failedCount, status }
  // 'session:status'     → { sessionId, status, qrCode? }
  // 'contact:import'     → { progress, total }
}
```

---

## 10. Health Checks

Add health check endpoint for Docker Swarm liveness/readiness probes:

```typescript
// health/health.controller.ts
@Get('/health')
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.redis.checkHealth('redis'),
    () => this.disk.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
  ]);
}
```

---

## 11. Frontend — Next.js Setup (Phase 1 Pages)

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← sidebar + topbar shell
│   │   ├── page.tsx            ← dashboard home (campaign stats)
│   │   ├── contacts/
│   │   │   ├── page.tsx        ← contact list + import button
│   │   │   └── [id]/page.tsx   ← contact detail + message history
│   │   ├── templates/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── campaigns/
│   │   │   ├── page.tsx        ← campaign list
│   │   │   ├── new/page.tsx    ← campaign wizard
│   │   │   └── [id]/page.tsx   ← live campaign progress
│   │   └── settings/
│   │       └── whatsapp/page.tsx  ← QR scan page
│   └── api/                    ← Next.js API routes (thin proxy to NestJS)
├── components/
│   ├── ui/                     ← shadcn/ui base components
│   └── features/               ← domain-specific components
├── hooks/                      ← useSocket(), useCampaign(), useContacts()
├── lib/
│   ├── api-client.ts           ← typed Axios/fetch wrapper
│   └── socket.ts               ← Socket.io client singleton
└── types/                      ← shared from packages/types
```

### Key Frontend Rules
- Use **React Query (TanStack Query)** for all server state — no manual `useEffect` + `useState` for API calls
- Use **Zustand** for lightweight client-only state (active session, sidebar open state)
- Use **shadcn/ui** components (Tailwind-first, accessible, copy-paste model)
- QR code page: poll `/api/v1/whatsapp/qr` or listen to WebSocket `session:status` event — display QR as SVG
- Campaign progress page: connect to WebSocket, update counts in real-time without polling
- All forms use **React Hook Form** + **Zod** for validation (mirrors backend class-validator DTOs)

---

## 12. Docker Compose (Development)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: wa_marketing
      POSTGRES_USER: wa_user
      POSTGRES_PASSWORD: dev_password_only
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 13. Unit Test Instructions

### Framework Setup

```bash
# Already included with NestJS — no extra install needed:
# @nestjs/testing, jest, @types/jest, ts-jest, supertest, @types/supertest

# jest.config.ts additions:
coverageThreshold: { global: { branches: 80, functions: 80, lines: 80 } }
```

### TypeORM Repository Mock Helper

```typescript
// test/helpers/mock-repository.ts
export const createMockRepository = <T>() => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  })),
});

// Usage in a service spec:
const module = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: getRepositoryToken(User), useValue: createMockRepository() },
    { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
  ],
}).compile();
```

### Key Unit Tests Per Module

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  it('throws UnauthorizedException when user email not found')
  it('throws UnauthorizedException when password is incorrect')
  it('throws ForbiddenException when email is not verified')
  it('returns accessToken + refreshToken on valid login')
  it('stores only hashed refresh token — never plaintext')
  it('invalidates previous refresh token on rotation (one-time use)')
  it('rejects access token after TTL expiry')
})

// contacts.service.spec.ts
describe('ContactsService', () => {
  it('normalises BD phone 01712345678 to E.164 +8801712345678')
  it('normalises Grameenphone 017X, Robi 018X, Banglalink 019X correctly')
  it('rejects non-BD/non-valid country phone number')
  it('upserts on duplicate (userId, phone) — no duplicate row created')
  it('excludes soft-deleted contacts from findAll()')
  it('sets optedOut=true and records optedOutAt timestamp')
  it('throws ConflictException if opted-out contact is added to campaign')
})

// variable-engine.service.spec.ts
describe('VariableEngine', () => {
  it('replaces {{name}} with contact.name')
  it('replaces {{custom.city}} with contact.customFields.city')
  it('replaces {{phone}} with local-format phone number')
  it('leaves unresolvable variables as empty string (not raw {{...}})')
  it('throws BadRequestException if template body exceeds 4096 characters')
  it('strips HTML tags from template body before substitution')
})

// rate-limiter.service.spec.ts
describe('RateLimiter', () => {
  it('allows send when below daily cap')
  it('rejects and defers send when daily cap (200) is reached')
  it('counter resets at midnight UTC')
  it('enforces minimum 2000ms delay floor — ignores config below floor')
})

// campaign.service.spec.ts
describe('CampaignService', () => {
  it('throws BadRequestException if session is DISCONNECTED on start')
  it('excludes opted-out contacts when building message queue')
  it('transitions status DRAFT → RUNNING on start')
  it('transitions status RUNNING → PAUSED on pause without losing queue')
})
```

---

## 14. E2E Test Instructions

### Setup & Isolation Strategy

```bash
# E2E tests live in: backend/test/  (separate from unit tests in src/)
# jest-e2e.config.ts points to: testRegex: '.e2e-spec.ts$'
# Run: npm run test:e2e

# Use a SEPARATE test database — never run E2E against development DB:
# DATABASE_URL=postgresql://wa_user:dev@localhost:5432/wa_marketing_test
```

```typescript
// test/helpers/app.helper.ts
export async function createTestApp() {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  // Apply same global pipes, filters, interceptors as main.ts
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

// beforeAll: run TypeORM migrations on test DB
// afterEach: truncate all tables (keep schema, reset data)
// afterAll: close app and DB connection
```

### E2E File Structure

```
backend/test/
├── auth.e2e-spec.ts          ← registration, login, token refresh, rate limiting
├── contacts.e2e-spec.ts      ← CSV import, CRUD, BD phone normalisation, opt-out
├── templates.e2e-spec.ts     ← create, variable preview, media upload
├── campaigns.e2e-spec.ts     ← create, start, pause, cancel lifecycle
└── helpers/
    ├── auth.helper.ts        ← registerAndLogin() utility
    ├── seed.helper.ts        ← createTestUser(), createTestContact()
    └── app.helper.ts         ← createTestApp()
```

### Key E2E Tests

```typescript
// auth.e2e-spec.ts
describe('POST /api/v1/auth/register', () => {
  it('201: creates user with valid BD email + strong password')
  it('400: rejects weak password "password123"')
  it('409: rejects duplicate email registration')
})
describe('POST /api/v1/auth/login', () => {
  it('200: returns accessToken + refreshToken for verified user')
  it('401: rejects wrong password')
  it('403: rejects unverified email')
  it('429: blocks after 5 failed attempts in 15 minutes')
})

// contacts.e2e-spec.ts
describe('POST /api/v1/contacts/import', () => {
  it('201: imports 50 BD contacts from CSV with +880 phone numbers')
  it('returns summary { imported, updated, skipped, errors }')
  it('re-import of same CSV produces no duplicate rows (upsert)')
  it('rejects file containing zero valid phone numbers')
})

// campaigns.e2e-spec.ts
describe('Campaign lifecycle', () => {
  it('POST /campaigns → 201 DRAFT campaign')
  it('POST /campaigns/:id/start → status: RUNNING, jobs in queue')
  it('opted-out contact in group is excluded from queue')
  it('POST /campaigns/:id/pause → status: PAUSED, remaining jobs preserved')
  it('POST /campaigns/:id/cancel → status: FAILED, remaining jobs removed')
})
```

### E2E in CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Start test PostgreSQL
  run: docker run -d -p 5433:5432 -e POSTGRES_DB=wa_marketing_test -e POSTGRES_USER=wa_user -e POSTGRES_PASSWORD=test postgres:16-alpine

- name: Wait for DB + run migrations
  run: DATABASE_URL=postgresql://wa_user:test@localhost:5433/wa_marketing_test npm run migration:run

- name: Run unit tests
  run: npm run test:cov

- name: Run E2E tests
  run: DATABASE_URL=postgresql://wa_user:test@localhost:5433/wa_marketing_test npm run test:e2e
```

---

## 15. Demo Data Seeding — Bangladesh Context

Seed scripts provide realistic Bangladeshi business data for investor demonstrations. Never run in production.

### Setup

```bash
# Package already installed (typeorm-extension)
# Add to package.json scripts:
# "seed": "ts-node -r tsconfig-paths/register src/database/seeds/run-seeds.ts"
# "seed:fresh": "npm run migration:revert && npm run migration:run && npm run seed"
```

### Seed File Structure

```
backend/src/database/seeds/
├── run-seeds.ts           ← entry point; rejects if NODE_ENV === 'production'
├── 01-users.seed.ts       ← 3 BD businesses (Dhaka RMG, Sylhet food, Chattogram retail)
├── 02-wa-sessions.seed.ts ← pre-connected sessions per user
├── 03-contacts.seed.ts    ← 50 BD contacts per user (real phone number prefixes)
├── 04-templates.seed.ts   ← 5 BD-context marketing templates per user
└── 05-campaigns.seed.ts   ← 3 campaigns per user (COMPLETED + RUNNING + DRAFT)
```

### Demo Users — 3 BD Business Scenarios

```typescript
// 01-users.seed.ts
const demoUsers = [
  {
    email: 'rahim@dhakafashion.com.bd',
    name: 'Md. Abdur Rahim',
    plan: Plan.PRO,
    // Scenario: RMG / garments exporter in Dhaka — bulk B2B buyer outreach
  },
  {
    email: 'karim@sylhetfoods.com.bd',
    name: 'Mohammad Karim',
    plan: Plan.STARTER,
    // Scenario: Restaurant chain in Sylhet — daily Iftar/lunch offer campaigns
  },
  {
    email: 'nasrin@ctgretail.com.bd',
    name: 'Nasrin Akter',
    plan: Plan.FREE,
    // Scenario: Retail boutique in Chattogram — seasonal promotions
  },
];
// All demo accounts use password: Demo@1234
```

### Demo Contacts — 50 BD Phone Numbers

```typescript
// 03-contacts.seed.ts
// BD phone prefixes: Grameenphone 017X, Robi 018X, Banglalink 019X, Airtel 016X
const bdContacts = [
  { name: 'Farhan Ahmed',      phone: '+8801712345001', customFields: { city: 'Dhaka',       division: 'Dhaka',     business: 'Retailer' } },
  { name: 'Suraiya Begum',     phone: '+8801812345002', customFields: { city: 'Narayanganj', division: 'Dhaka',     business: 'Wholesaler' } },
  { name: 'Jamal Uddin',       phone: '+8801912345003', customFields: { city: 'Gazipur',     division: 'Dhaka',     business: 'Manufacturer' } },
  { name: 'Roksana Parvin',    phone: '+8801612345004', customFields: { city: 'Chattogram',  division: 'Chittagong',business: 'Exporter' } },
  { name: 'Mosharraf Hossain', phone: '+8801712345005', customFields: { city: 'Sylhet',      division: 'Sylhet',    business: 'Restaurant' } },
  { name: 'Tahmina Khatun',    phone: '+8801812345006', customFields: { city: 'Rajshahi',    division: 'Rajshahi',  business: 'Distributor' } },
  { name: 'Anwar Hossain',     phone: '+8801912345007', customFields: { city: 'Khulna',      division: 'Khulna',    business: 'Farmer' } },
  { name: 'Sharmin Akter',     phone: '+8801612345008', customFields: { city: 'Comilla',     division: 'Chittagong',business: 'Boutique' } },
  { name: 'Delwar Islam',      phone: '+8801712345009', customFields: { city: 'Mymensingh',  division: 'Mymensingh',business: 'Retailer' } },
  { name: 'Moriom Begum',      phone: '+8801812345010', customFields: { city: 'Bogura',      division: 'Rajshahi',  business: 'Supplier' } },
  // Generate 40 more with the same pattern — cover all 8 BD divisions
];
```

### Demo Templates — BD Marketing Context

```typescript
// 04-templates.seed.ts
const bdTemplates = [
  {
    name: 'Eid Special Offer',
    body: 'আস্সালামু আলাইকুম {{name}} ভাই! 🌙 ঈদ উপলক্ষে সকল পণ্যে ২০% ছাড়! অফার সীমিত সময়ের। অর্ডার করুন: 01712-XXXXXX',
  },
  {
    name: 'Pahela Boishakh Promo',
    body: 'শুভ নববর্ষ {{name}}! 🎉 পহেলা বৈশাখ উপলক্ষে বিশেষ ছাড় — যেকোনো পণ্যে ১৫% অফ। শোরুম: {{custom.city}}',
  },
  {
    name: 'New Collection — English',
    body: 'Hi {{name}}, our new winter collection is now available! 🧥 Premium RMG quality. WhatsApp for the full catalogue. Delivery across Bangladesh.',
  },
  {
    name: 'Payment Reminder',
    body: 'Dear {{name}}, আপনার অর্ডারের বাকি পেমেন্ট Tk.{{custom.amount}} পেন্ডিং। bKash/Nagad: 01712-XXXXXX. ধন্যবাদ 🙏',
  },
  {
    name: 'Delivery Confirmation',
    body: '✅ সুখবর {{name}}! আপনার পণ্য আজ ডেলিভারি হবে। ট্র্যাক করুন: {{custom.trackingUrl}}. কল করুন: 01812-XXXXXX',
  },
];
```

### Demo Campaigns (rich analytics view)

```typescript
// 05-campaigns.seed.ts
// Per user, create 3 campaigns:
// 1. COMPLETED — "Eid Offer 2025" campaign, sent to all 50 contacts
//    → Seed MessageLog entries: 45 DELIVERED, 30 READ, 5 FAILED
//    → Provides a full analytics view for investor demo
//
// 2. RUNNING — "New Collection Launch", 20/50 contacts sent
//    → Creates in-progress state for live dashboard demo  
//
// 3. DRAFT — "Pahela Boishakh 2026", scheduledAt = next week
//    → Shows the scheduling feature in the UI
```

> ⚠️ **Run seeds only in development/demo. The `run-seeds.ts` entry point must guard against `NODE_ENV === 'production'` and throw immediately if true.**

---

## 16. Feature Documentation Guide

After each module is built and tested, add a corresponding guide to `docs/guides/`.

### Required Guides for Phase 1

```
docs/
├── guides/
│   ├── phase-1-setup.md           ← project setup, env vars, running locally
│   ├── connecting-whatsapp.md     ← QR scan flow, session states, troubleshooting
│   ├── importing-contacts.md      ← CSV format, BD phone normalisation, dedup rules
│   ├── creating-templates.md      ← variable syntax, preview, media attachments
│   └── running-campaigns.md       ← create → launch → monitor bulk campaign
```

### Guide Template (use for each doc)

```markdown
# [Feature Name]

## What This Does
1–2 sentences describing the purpose.

## Prerequisites
List what must be configured/completed first.

## Step-by-Step
1. Step one (with screenshot path if applicable)
2. Step two...

## Limitations
- Rate limits, file size limits, plan restrictions

## Troubleshooting
| Problem | Cause | Fix |
|---------|-------|-----|
| QR expired | 60-second timeout | Click Refresh QR |
| CONNECTING never resolves | Phone offline | Check phone internet |
| TOS_BLOCK status | Aggressive sends | Reduce frequency, wait 24h |
```

---

## 17. Definition of Done — Phase 1

- [ ] User can register, verify email, and log in
- [ ] User can scan QR and see session status transition to CONNECTED
- [ ] User can import 1,000 contacts from CSV — duplicates merged, invalid phones rejected
- [ ] User can create a template with `{{name}}` and preview with a real contact
- [ ] User can create a campaign, select a group, and launch immediately
- [ ] Campaign respects rate limiting (≥2s delay between sends, visible in logs)
- [ ] Campaign status updates in real-time on the frontend via WebSocket
- [ ] Opted-out contacts are skipped in campaign send
- [ ] User can upload an image and it is stored in MinIO and sent in a campaign
- [ ] Health check endpoint returns 200 with all dependency statuses
- [ ] Unit test coverage ≥ 80% across all Phase 1 modules
- [ ] All E2E critical path tests pass (register → import → campaign)
- [ ] Demo seed data loads correctly (`npm run seed`) with BD contacts and templates
- [ ] `docs/guides/` contains guides for all Phase 1 features
- [ ] Docker Compose `docker compose up` brings up the full stack from scratch
