---
description: "Use when building Phase 3 of the WhatsApp Marketing SaaS: advanced campaign analytics with pre-aggregated read models, multi-account WhatsApp support, A/B message testing with statistical significance, AI message copy generation (OpenAI and Ollama), Google Sheets contact sync, webhook delivery system, user roles and permissions. Covers weeks 9–12 of the roadmap."
---

# Phase 3 — Analytics, Multi-Account, A/B Testing & AI

**Scope:** Weeks 9–12 | Prerequisites: Phase 1 and Phase 2 complete and passing all DoD criteria.
**Goal:** Rich campaign analytics dashboard, multiple WhatsApp accounts per user, A/B testing with significance tracking, AI-powered message copy generation, Google Sheets sync, outbound webhooks, and role-based access control.

---

## 1. Analytics Architecture — Read Model Pattern

### Problem with Naive Aggregation
Never run `SELECT COUNT(*), GROUP BY` over `MessageLog` on every dashboard page load. At 1 million+ log entries, this will cause:
- Slow queries (multi-second dashboards)
- High DB CPU under concurrent access
- Timeout spikes during campaign sends

### Solution: Pre-Aggregated Stats (CQRS Read Model)

Maintain a **separate stats table** that is updated via events after every message state change — queries read from it directly:

```typescript
// analytics/entities/campaign-stats.entity.ts
import { Entity, PrimaryColumn, Column, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';

@Entity('campaign_stats')
export class CampaignStats {
  @PrimaryColumn() campaignId: string;
  @Column({ default: 0 }) totalContacts: number;
  @Column({ default: 0 }) sentCount: number;
  @Column({ default: 0 }) deliveredCount: number;
  @Column({ default: 0 }) readCount: number;
  @Column({ default: 0 }) failedCount: number;
  @Column({ default: 0 }) repliedCount: number;
  @Column({ default: 0 }) optedOutCount: number;
  @Column({ type: 'float', default: 0 }) deliveryRate: number;  // deliveredCount / sentCount
  @Column({ type: 'float', default: 0 }) readRate: number;      // readCount / deliveredCount
  @Column({ type: 'float', default: 0 }) replyRate: number;     // repliedCount / deliveredCount
  @UpdateDateColumn() updatedAt: Date;

  @OneToOne(() => Campaign) @JoinColumn({ name: 'campaignId' }) campaign: Campaign;
}

// analytics/entities/daily-stats.entity.ts
@Entity('daily_stats')
@Unique(['userId', 'sessionId', 'date'])
@Index(['userId', 'date'])
export class DailyStats {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ nullable: true }) sessionId?: string;
  @Column({ type: 'date' }) date: string;  // UTC date as YYYY-MM-DD string
  @Column({ default: 0 }) sentCount: number;
  @Column({ default: 0 }) deliveredCount: number;
  @Column({ default: 0 }) readCount: number;
  @Column({ default: 0 }) failedCount: number;
}
```

### Stats Update Mechanism

```typescript
// analytics/stats-updater.service.ts

// Listen to NestJS EventEmitter events emitted after every message state change:

@OnEvent('message.sent')
async onMessageSent(payload: MessageSentEvent) {
  // Atomic increment — use TypeORM query builder for UPDATE ... SET sentCount = sentCount + 1:
  // await this.statsRepo.createQueryBuilder()
  //   .update(CampaignStats)
  //   .set({ sentCount: () => '"sentCount" + 1' })
  //   .where('"campaignId" = :id', { id: campaignId })
  //   .execute();
  // or use Redis INCR (faster) and flush to DB every 30 seconds via a cron job
}

@OnEvent('message.delivered')
async onMessageDelivered(payload: MessageDeliveredEvent) { /* ... */ }

@OnEvent('message.read')
async onMessageRead(payload: MessageReadEvent) { /* ... */ }

@OnEvent('message.failed')
async onMessageFailed(payload: MessageFailedEvent) { /* ... */ }
```

> **Improvement:** Use Redis INCR/HINCR for hot counters during active campaigns (avoiding DB write storms), then flush to PostgreSQL via a BullMQ job every 30 seconds. This prevents N DB writes for N messages in a fast campaign burst.

### Analytics API Endpoints

```
GET /analytics/campaigns/:id          → CampaignStats for one campaign
GET /analytics/campaigns              → list with stats, filterable by date range + status
GET /analytics/overview               → aggregated daily stats for the user's dashboard (30 days)
GET /analytics/campaigns/:id/contacts → per-contact delivery status (paginated)
POST /analytics/campaigns/:id/export  → trigger async PDF/CSV export job → returns jobId
GET  /analytics/exports/:jobId        → poll export job status → returns download URL
```

### Export — Async, Not Blocking

PDF and CSV generation for large campaigns can take 10+ seconds. Never do this in a synchronous HTTP request:

```typescript
// POST /analytics/campaigns/:id/export → enqueue BullMQ export job → return { jobId }
// BullMQ worker generates the file, uploads to MinIO, updates ExportJob record with status + url
// GET /analytics/exports/:jobId → return { status: 'PENDING' | 'COMPLETE', downloadUrl? }
// Frontend polls every 2 seconds until status = COMPLETE, then shows download link
```

Use `pdfkit` for PDF generation and `fast-csv` for CSV generation inside the worker.

---

## 2. Multi-Account WhatsApp Support

### WaSession Entity Additions (TypeORM migration)

Add new columns to the existing `WaSession` entity and generate a migration:

```typescript
// Add to WaSession entity:
@Column({ default: 'Default Account' }) label: string;
@Column({ default: false }) isDefault: boolean;
@Column({ default: 0 }) dailySendCount: number;   // reset at midnight UTC via cron
@Column({ type: 'date', nullable: true }) dailySendDate?: string;

// Generate migration:
// typeorm migration:generate src/database/migrations/AddWaSessionMultiAccountFields -d src/database/data-source.ts
```

### Session Pool Changes

```typescript
// session-manager/SessionPool.ts

// Change the pool key from Map<userId, BaileysInstance>
// to Map<sessionId, BaileysInstance>
// Multiple sessions per user are now fully supported

// On campaign creation: user selects which session (account) to send from
// The Campaign model already has sessionId FK — no schema change needed
```

### Account Health Scoring

Track per-session health to help users identify risky accounts:

```typescript
// Compute a health score (0–100) for each session:
// - deliveryRate last 7 days (weight: 40%)
// - failRate last 7 days (weight: 30%)
// - replyRate last 7 days (weight: 20%)
// - days since last TOS_BLOCK warning (weight: 10%)

// GREEN ≥ 80 | YELLOW 50–79 | RED < 50
// Display health badge per account on the WhatsApp Accounts settings page
// RED accounts should prompt the user with a warning before launching a campaign
```

### Automatic Account Rotation

For users with multiple accounts, allow "auto-rotate" mode on campaigns:

```typescript
// When autoRotate = true on a Campaign:
// The campaign processor picks the healthiest available session
// that has not hit its daily cap — round-robin weighted by health score
// If all sessions are at daily cap, pause campaign until midnight UTC
```

---

## 3. A/B Message Testing

### A/B Test Entities (TypeORM)

```typescript
// campaigns/entities/ab-test.entity.ts
export enum AbStatus { RUNNING = 'RUNNING', COMPLETED = 'COMPLETED', CANCELLED = 'CANCELLED' }

@Entity('ab_tests')
export class AbTest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() campaignId: string;
  @Column() variantA: string;   // templateId or inline message body
  @Column() variantB: string;
  @Column({ type: 'float', default: 0.5 }) splitRatio: number;
  @Column({ nullable: true }) winnerId?: string;
  @Column({ type: 'enum', enum: AbStatus, default: AbStatus.RUNNING }) status: AbStatus;
  @CreateDateColumn() createdAt: Date;
  @Column({ nullable: true }) completedAt?: Date;

  @OneToOne(() => Campaign) @JoinColumn({ name: 'campaignId' }) campaign: Campaign;
  @OneToMany(() => AbResult, r => r.abTest) results: AbResult[];
}

// campaigns/entities/ab-result.entity.ts
@Entity('ab_results')
export class AbResult {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() abTestId: string;
  @Column() variant: string;    // 'A' or 'B'
  @Column({ default: 0 }) sent: number;
  @Column({ default: 0 }) delivered: number;
  @Column({ default: 0 }) read: number;
  @Column({ default: 0 }) replied: number;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => AbTest, t => t.results, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'abTestId' }) abTest: AbTest;
}
```

### Contact Split

```typescript
// campaigns/ab-test.service.ts

async splitContacts(contactIds: string[], splitRatio: number): Promise<{ a: string[], b: string[] }> {
  // Shuffle contacts deterministically using the abTestId as a seed
  // (so the same contacts always end up in the same group if re-run)
  // Use Fisher-Yates shuffle with seeded random (seedrandom library)
  const shuffled = seededShuffle(contactIds, abTestId);
  const splitAt = Math.floor(shuffled.length * splitRatio);
  return { a: shuffled.slice(0, splitAt), b: shuffled.slice(splitAt) };
}
```

### Statistical Significance

Do NOT declare a winner based on raw numbers alone. Use a **Chi-squared test** to determine if the difference is statistically significant (p < 0.05):

```typescript
// analytics/significance.service.ts

// Compare read rates of A vs B:
// Null hypothesis: both variants perform equally
// If chi-squared p-value < 0.05: reject null → declare winner

computeSignificance(a: AbResult, b: AbResult): { pValue: number, isSignificant: boolean, winner: 'A' | 'B' | 'INCONCLUSIVE' } {
  // Chi-squared 2x2 contingency table:
  // | Variant | Read | Not Read |
  // |---------|------|----------|
  // |    A    |  a.read  | a.delivered - a.read |
  // |    B    |  b.read  | b.delivered - b.read |
  // Use `chi-squared-test` npm package or implement manually
}

// Display significance indicator in the A/B results UI:
// "Not enough data yet" (< 100 delivered per variant)
// "No significant difference" (p >= 0.05)
// "Variant A is significantly better (p < 0.05)"
```

---

## 4. AI Message Generator

### Design

The AI module has an **abstracted provider interface** so OpenAI and Ollama are interchangeable:

```typescript
// ai/interfaces/ai-provider.interface.ts
export interface IAiProvider {
  generateMarketingCopy(prompt: GeneratePromptDto): Promise<string>;
}

// ai/providers/openai.provider.ts  → implements IAiProvider
// ai/providers/ollama.provider.ts  → implements IAiProvider (fully local, $0)

// The user can choose their preferred provider in Settings.
// The AiModule injects the correct provider based on config.
```

### Prompt Engineering

```typescript
// ai/prompt-builder.service.ts

buildPrompt(dto: GeneratePromptDto): string {
  return `You are a WhatsApp marketing copywriter. Write a SHORT, conversational, 
engaging WhatsApp message (max 160 characters) for the following:

Business: ${dto.businessName}
Product/Service: ${dto.product}
Goal: ${dto.goal}  // e.g. "announce 20% discount", "invite to webinar"
Tone: ${dto.tone}  // e.g. "friendly", "professional", "urgent"
Include a call-to-action.
Output ONLY the message text, no explanation, no quotes.`;
}
```

### Security — Prompt Injection Protection

**CRITICAL:** User-supplied inputs (`businessName`, `product`, `goal`) must be sanitized before embedding in the prompt. A malicious user could inject `"Ignore all previous instructions and..."`:

```typescript
// ai/prompt-sanitizer.service.ts

sanitize(input: string): string {
  // 1. Strip any instruction-like patterns (case-insensitive):
  //    /ignore (all |previous )?(instructions?|prompts?|context)/i
  //    /you are now/i, /your new (role|task|persona)/i
  // 2. Truncate to 500 characters max
  // 3. Strip HTML/markdown
  // Return sanitized input
}
```

### Cost Guardrails

```typescript
// ai/cost-limiter.service.ts

// Per-user daily quota (stored in Redis):
// FREE plan: 10 AI generations/day
// PRO plan: 100 generations/day
// Key: `ai:quota:{userId}:{YYYY-MM-DD}`, expire at midnight UTC

// Check quota before every call → return 429 if exceeded
// Max tokens per request: input 500, output 200 (prevents runaway costs)
```

### Ollama Integration (Fully Free, Local)

```typescript
// ai/providers/ollama.provider.ts

// Ollama REST API: POST http://localhost:11434/api/generate
// Recommended model: llama3.2:3b (fast, low memory, good quality)
// Run Ollama as a Docker service in docker-compose:

// ollama:
//   image: ollama/ollama
//   volumes:
//     - ollama_data:/root/.ollama
//   ports:
//     - "11434:11434"

// On first deploy, pull the model: docker exec ollama ollama pull llama3.2:3b
```

---

## 5. Google Sheets Integration

### Flow

```
User connects Google account (OAuth2) → Store token (encrypted) → User picks a Sheet
→ Backend fetches rows → Normalize + import as contacts (same pipeline as CSV import)
→ Optional: enable auto-sync (refresh contacts daily)
```

### Implementation

```typescript
// integrations/google-sheets/google-sheets.service.ts

// Use google-auth-library + googleapis npm packages
// OAuth2 scopes needed: https://www.googleapis.com/auth/spreadsheets.readonly
// Store access_token + refresh_token encrypted in DB (use AES-256-GCM, key from Swarm Secret)
// Token refresh: use refresh_token to get new access_token when expired

// Sheet column mapping (user configures per sheet):
// "Which column is the phone number?" → required
// "Which column is the name?" → optional
// "Map additional columns to custom fields" → optional
```

### Security
- OAuth tokens stored **encrypted** in the database — never plaintext
- Encrypt with AES-256-GCM, key loaded from Docker Swarm Secret (not env var)  
- Use `@googleapis/sheets` only with `readonly` scope — never request write permissions
- Validate the sheet URL is a legitimate Google Sheets URL before making API calls (SSRF prevention)

---

## 6. Webhook Delivery System

### Webhook Entities (TypeORM)

```typescript
// webhooks/entities/webhook-endpoint.entity.ts
export enum DeliveryStatus { PENDING = 'PENDING', DELIVERED = 'DELIVERED', FAILED = 'FAILED', ABANDONED = 'ABANDONED' }

@Entity('webhook_endpoints') @Index(['userId'])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() url: string;
  @Column() secret: string;                         // HMAC-SHA256 signing key
  @Column('simple-array') events: string[];         // ['message.sent', 'campaign.completed']
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @OneToMany(() => WebhookDelivery, d => d.endpoint) deliveries: WebhookDelivery[];
}

// webhooks/entities/webhook-delivery.entity.ts
@Entity('webhook_deliveries') @Index(['endpointId', 'status'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() endpointId: string;
  @Column() event: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.PENDING }) status: DeliveryStatus;
  @Column({ nullable: true }) responseCode?: number;
  @Column({ type: 'text', nullable: true }) responseBody?: string;
  @Column({ default: 0 }) attemptCount: number;
  @Column({ nullable: true }) nextRetryAt?: Date;
  @CreateDateColumn() createdAt: Date;
  @Column({ nullable: true }) deliveredAt?: Date;

  @ManyToOne(() => WebhookEndpoint, e => e.deliveries, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'endpointId' }) endpoint: WebhookEndpoint;
}
```

### Delivery with Retry + HMAC Signature

```typescript
// webhooks/webhook-delivery.service.ts

async deliver(deliveryId: string): Promise<void> {
  const delivery = await this.repo.findById(deliveryId);
  const endpoint = delivery.endpoint;

  // Sign payload with HMAC-SHA256 using endpoint.secret
  const signature = this.sign(endpoint.secret, JSON.stringify(delivery.payload));

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WA-Signature': `sha256=${signature}`,
      'X-WA-Event': delivery.event,
      'X-WA-Delivery-Id': deliveryId,
    },
    body: JSON.stringify(delivery.payload),
    signal: AbortSignal.timeout(10_000), // 10-second timeout
  });

  if (response.ok) {
    await this.repo.update(deliveryId, { status: 'DELIVERED', deliveredAt: new Date() });
  } else {
    await this.scheduleRetry(delivery);
  }
}

// Retry schedule (exponential backoff):
// Attempt 1: immediate
// Attempt 2: 1 minute
// Attempt 3: 5 minutes
// Attempt 4: 30 minutes
// Attempt 5: 2 hours
// After 5 failures → status = ABANDONED, notify user via email
```

### Webhook URL Validation (SSRF Prevention)

```typescript
// Before saving a WebhookEndpoint URL, validate it:
// 1. Must be HTTPS (reject HTTP in production)
// 2. Must not resolve to private IP ranges (10.x, 172.16.x, 192.168.x, 127.x, ::1)
// 3. Resolve DNS and check IP is public — prevents SSRF attacks

async validateWebhookUrl(url: string): Promise<void> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new BadRequestException('Webhook URL must use HTTPS');
  const { address } = await dns.promises.lookup(parsed.hostname);
  if (isPrivateIp(address)) throw new BadRequestException('Webhook URL must be a public address');
}
```

---

## 7. User Roles & Permissions

### Roles

```typescript
enum UserRole {
  ADMIN,   // full access: manage team, billing, all settings
  AGENT,   // send campaigns, manage contacts, view analytics
  VIEWER,  // read-only: view campaigns, contacts, analytics
}
```

### NestJS RBAC Implementation

```typescript
// common/decorators/roles.decorator.ts
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true; // no roles decorator = any authenticated user
    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.some(role => user.roles?.includes(role));
  }
}

// Usage:
@Roles(UserRole.ADMIN)
@Delete('/users/:id')
deleteUser() { /* ... */ }
```

### Team Membership Entity (TypeORM)

```typescript
// teams/entities/team-member.entity.ts
export enum UserRole { ADMIN = 'ADMIN', AGENT = 'AGENT', VIEWER = 'VIEWER' }

@Entity('team_members')
@Index(['teamId'])
export class TeamMember {
  @PrimaryColumn() userId: string;   // the invited member
  @PrimaryColumn() teamId: string;   // the owner user's ID acts as the team ID
  @Column({ type: 'enum', enum: UserRole, default: UserRole.AGENT }) role: UserRole;
  @CreateDateColumn() joinedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
}
```

---

## 8. Frontend Pages — Phase 3

```
app/(dashboard)/
├── analytics/
│   ├── page.tsx                    ← overview: daily stats charts (30 days)
│   ├── campaigns/[id]/page.tsx    ← per-campaign: delivery funnel, per-contact table
│   └── exports/[jobId]/page.tsx  ← export status polling + download
├── whatsapp/
│   └── accounts/page.tsx          ← multi-account list + health scores + add account
├── campaigns/
│   └── new/ab-test/page.tsx       ← A/B test setup wizard
├── ai/
│   └── page.tsx                   ← AI copy generator (form → result → insert to template)
├── integrations/
│   ├── google-sheets/page.tsx     ← connect + sheet picker + sync settings
│   └── webhooks/
│       ├── page.tsx               ← list endpoints + recent delivery logs
│       └── new/page.tsx           ← add webhook URL + event selection
└── settings/
    └── team/page.tsx              ← invite team member + assign role
```

### Analytics Charts
- Use **Recharts** (lightweight, Tailwind-friendly, SSR-compatible)
- Chart types needed: Line (daily sends over 30 days), Bar (campaign comparison), Donut (delivery/read/failed breakdown)
- All charts must be responsive and accessible (aria labels, color-blind safe palette)
- Export buttons on all charts (PNG download via `html2canvas`)

---

## 9. Unit Test Instructions — Phase 3

### Key Unit Tests

```typescript
// stats-updater.service.spec.ts
describe('StatsUpdater', () => {
  it('increments sentCount atomically (TypeORM query builder SET sentCount = sentCount + 1)')
  it('increments deliveredCount on message.delivered event')
  it('recalculates deliveryRate = deliveredCount / sentCount after each update')
  it('100 concurrent increments produce the correct final count (Redis INCR test)')
})

// ab-test.service.spec.ts
describe('AbTestService', () => {
  it('splits 100 contacts exactly 50/50 with 0.5 splitRatio')
  it('deterministic shuffle: same contactIds + same abTestId always produce same split')
  it('splitRatio 0.3 produces 30 in group A and 70 in group B')
})

// significance.service.spec.ts
describe('SignificanceService', () => {
  it('returns INCONCLUSIVE when < 100 delivered per variant')
  it('returns INCONCLUSIVE when p >= 0.05 (equal rates)')
  it('returns winner A when A read rate is significantly higher (p < 0.05)')
  it('returns winner B when B read rate is significantly higher (p < 0.05)')
})

// webhook-delivery.service.spec.ts
describe('WebhookDelivery', () => {
  it('generates correct HMAC-SHA256 signature for payload')
  it('schedules retry after failed attempt (following backoff schedule)')
  it('sets status ABANDONED after 5 failed attempts')
  it('marks status DELIVERED and records deliveredAt on 2xx response')
})

// prompt-sanitizer.service.spec.ts
describe('PromptSanitizer', () => {
  it('strips "ignore all previous instructions" from user input')
  it('strips "you are now" injection variant')
  it('truncates input > 500 characters')
  it('strips HTML tags from input')
  it('preserves normal business input unchanged')
})

// roles.guard.spec.ts
describe('RolesGuard', () => {
  it('allows ADMIN on admin-only endpoint')
  it('blocks VIEWER on POST /campaigns (403)')
  it('blocks AGENT on admin settings endpoint (403)')
  it('allows any authenticated user when no @Roles() decorator present')
})
```

---

## 10. E2E Test Instructions — Phase 3

### E2E File Structure (add to backend/test/)

```
backend/test/
├── analytics.e2e-spec.ts        ← stats accuracy, export job polling
├── ab-test.e2e-spec.ts          ← create A/B test, verify contact split, significance
├── ai-generator.e2e-spec.ts    ← generate copy, quota enforcement, injection rejection
├── webhooks.e2e-spec.ts         ← create endpoint, SSRF validation, delivery + retry
└── roles.e2e-spec.ts            ← VIEWER/AGENT/ADMIN access matrix
```

### Key E2E Tests

```typescript
// analytics.e2e-spec.ts
describe('Analytics', () => {
  it('GET /analytics/campaigns/:id returns stats matching seeded MessageLog rows')
  it('POST /analytics/campaigns/:id/export returns jobId')
  it('GET /analytics/exports/:jobId polls until COMPLETE and returns download URL')
  it('Overview endpoint returns 30 days of DailyStats entries')
})

// webhooks.e2e-spec.ts
describe('Webhook Endpoints', () => {
  it('POST /webhooks with HTTP URL → 400 (must be HTTPS)')
  it('POST /webhooks with URL resolving to 192.168.x.x → 400 (SSRF blocked)')
  it('POST /webhooks with valid HTTPS URL → 201')
  it('Delivery record created + retry scheduled after first failed attempt')
})

// roles.e2e-spec.ts
describe('Role-Based Access Control', () => {
  it('ADMIN can POST /campaigns')
  it('AGENT can POST /campaigns')
  it('VIEWER cannot POST /campaigns → 403')
  it('VIEWER can GET /analytics → 200')
  it('AGENT cannot DELETE /settings/team/:userId → 403')
})

// ai-generator.e2e-spec.ts
describe('AI Generator', () => {
  it('POST /ai/generate returns marketing copy within 160 chars')
  it('Prompt injection in product field is sanitized — injected text not in response')
  it('After 10 generations (FREE plan limit), returns 429')
})
```

---

## 11. Demo Data Seeding — Bangladesh Context

Extend Phase 1 + 2 seeds with Phase 3 analytics and A/B test data:

### Seed File Additions

```
backend/src/database/seeds/
├── 08-campaign-stats.seed.ts    ← pre-aggregated stats for completed campaigns
├── 09-ab-tests.seed.ts          ← A/B test with realistic BD result split
└── 10-webhooks.seed.ts          ← 1 webhook endpoint per user (webhook.site demo URL)
```

### Analytics Demo Data

```typescript
// 08-campaign-stats.seed.ts
// Populate CampaignStats for each COMPLETED campaign:
// Rahim (RMG exporter):
//   sentCount: 50, deliveredCount: 45 (90%), readCount: 30 (67%), failedCount: 5
//
// Karim (Sylhet foods) — high engagement for Ramadan campaign:
//   sentCount: 50, deliveredCount: 48 (96%), readCount: 40 (83%), repliedCount: 8
//
// Nasrin (Chattogram retail) — modest results for FREE plan:
//   sentCount: 20, deliveredCount: 17 (85%), readCount: 10 (59%), failedCount: 3
//
// Also seed 30 days of DailyStats for a realistic trend chart on the overview page
```

### A/B Test Demo

```typescript
// 09-ab-tests.seed.ts
// For Rahim: A/B test between Eid Bengali copy vs English copy
// Variant A (Bengali Eid offer): read rate 67%
// Variant B (English collection): read rate 48%
// Status: COMPLETED, winner: Variant A (p < 0.05 — demonstrates significance feature)
```

---

## 12. Feature Documentation Guide — Phase 3

```
docs/guides/
├── analytics-dashboard.md      ← reading charts, exporting reports, date filters
├── multi-account-whatsapp.md   ← adding accounts, health scores, auto-rotation
├── ab-testing.md               ← setting up A/B test, reading significance indicator
├── ai-copy-generator.md        ← generating copy, quota limits, Ollama vs OpenAI
├── google-sheets-sync.md       ← OAuth connection, column mapping, auto-sync
├── webhooks.md                 ← registering endpoint, event types, verifying HMAC
└── team-roles.md               ← inviting members, role permissions table
```

---

## 13. Definition of Done — Phase 3

- [ ] Analytics dashboard loads in < 1 second for a user with 100 campaigns
- [ ] Campaign stats update in real-time during an active campaign (WebSocket updates)
- [ ] PDF and CSV exports work for campaigns with up to 10,000 contacts
- [ ] User can connect 3 WhatsApp accounts and assign different accounts to different campaigns
- [ ] Account health score is visible and correctly computed per account
- [ ] A/B test splits 100 contacts 50/50 and shows statistical significance indicator after 100 sends per variant
- [ ] AI copy generator produces relevant marketing text and rejects prompt injection attempts
- [ ] Ollama provider works as a zero-cost alternative to OpenAI
- [ ] Google Sheets sync imports contacts from a real spreadsheet
- [ ] Webhook delivers signed payload within 5 seconds; failed delivery retries with backoff; SSRF-protected URL validation blocks private IPs
- [ ] VIEWER role cannot create or modify campaigns (403 on all write endpoints)
- [ ] Unit test coverage ≥ 80% across all Phase 3 modules
- [ ] All E2E critical path tests pass (analytics export, SSRF webhook block, roles matrix)
- [ ] BD demo seed data shows rich analytics with BD campaign results
- [ ] `docs/guides/` contains guides for all Phase 3 features
