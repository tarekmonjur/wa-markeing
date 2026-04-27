---
description: "Use when building Phase 2 of the WhatsApp Marketing SaaS: campaign scheduler, auto-reply chatbot engine, opt-out/unsubscribe system, media message support, inbound message inbox, and drip campaign sequences. Covers weeks 5–8 of the roadmap."
---

# Phase 2 — Automation, Scheduling & Auto-Reply

**Scope:** Weeks 5–8 | Prerequisites: Phase 1 complete and passing all DoD criteria.
**Goal:** Campaigns can be scheduled for future delivery, auto-replies respond to inbound messages, contacts can self-unsubscribe, media messages are fully supported, and a drip sequence builder is available.

---

## 1. Campaign Scheduler

### Requirements
- User picks a future date/time (with timezone) when creating or editing a campaign
- Campaign status moves `DRAFT → SCHEDULED` on save
- At the scheduled time, the campaign auto-starts (status → `RUNNING`)
- User can cancel a scheduled campaign (status → `DRAFT`)
- User can reschedule (change `scheduledAt` while status is `SCHEDULED`)

### Implementation

Use **BullMQ delayed jobs** — do NOT use cron or `setTimeout`. BullMQ delayed jobs survive server restarts and are stored in Redis:

```typescript
// campaigns/scheduler.service.ts

async scheduleCampaign(campaignId: string, scheduledAt: Date): Promise<void> {
  const delay = scheduledAt.getTime() - Date.now();
  if (delay <= 0) throw new BadRequestException('scheduledAt must be in the future');

  await this.campaignLaunchQueue.add(
    'launch-campaign',
    { campaignId },
    {
      delay,
      jobId: `launch:${campaignId}`,   // idempotent — prevents duplicate jobs
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  await this.campaignRepo.update(campaignId, { status: 'SCHEDULED', scheduledAt });
}

async cancelScheduledCampaign(campaignId: string): Promise<void> {
  // Remove the delayed job from Redis by its jobId
  const job = await this.campaignLaunchQueue.getJob(`launch:${campaignId}`);
  if (job) await job.remove();
  await this.campaignRepo.update(campaignId, { status: 'DRAFT', scheduledAt: null });
}
```

### Timezone Handling
- Store `scheduledAt` in UTC in the database always
- Accept timezone from the client (`America/New_York`, `Asia/Dhaka`, etc.) and convert to UTC on input
- Display local time in frontend using `date-fns-tz` library
- Add `timezone` column to `User` model — default to `UTC`

### Recurring Campaigns (Phase 2 Addition)

Add a `recurrence` field to `Campaign` (optional JSON):

```typescript
// Supported recurrence patterns:
{
  type: 'daily' | 'weekly' | 'monthly',
  daysOfWeek?: number[],   // 0=Sun, 6=Sat (for weekly)
  dayOfMonth?: number,     // 1–28 (for monthly, cap at 28 to handle Feb)
  endDate?: string,        // ISO date, optional
}
```

Use `@nestjs/schedule` with a cron job that runs every minute to spawn the next occurrence of recurring campaigns.

---

## 2. Auto-Reply / Chatbot Engine

### Architecture

The inbound message handler lives in `session-manager`, which forwards events to NestJS via an **internal HTTP webhook** (or BullMQ job):

```
Baileys socket.ev.on('messages.upsert')
    │
    ▼
session-manager/InboundHandler.ts
    │  POST /internal/inbound-message (or BullMQ job)
    ▼
NestJS AutoReplyModule
    │  match keywords → generate reply
    ▼
session-manager/MessageSender.ts → Baileys send reply
```

### Keyword Rule Entity (TypeORM)

Add to the `auto-reply` module:

```typescript
// auto-reply/entities/auto-reply-rule.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

export enum MatchType { EXACT = 'EXACT', CONTAINS = 'CONTAINS', STARTS_WITH = 'STARTS_WITH', REGEX = 'REGEX' }

@Entity('auto_reply_rules')
@Index(['userId', 'isActive'])
export class AutoReplyRule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column({ nullable: true }) sessionId?: string;  // null = applies to all sessions
  @Column() keyword: string;                        // case-insensitive match
  @Column({ type: 'enum', enum: MatchType, default: MatchType.CONTAINS }) matchType: MatchType;
  @Column('text') replyBody: string;
  @Column({ nullable: true }) mediaUrl?: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ default: 0 }) priority: number;         // higher = checked first
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
}
```

### Keyword Matching Pipeline

```typescript
// auto-reply/keyword-matcher.service.ts

// IMPORTANT: for REGEX match type, validate and compile the regex safely:
// - Use a timeout-limited regex engine or `safe-regex` library to reject ReDoS patterns
// - Never execute user-supplied regex without validation (OWASP: Regex Injection)

matchRules(inboundText: string, rules: AutoReplyRule[]): AutoReplyRule | null {
  const sorted = rules.sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (this.matches(inboundText.toLowerCase(), rule)) return rule;
  }
  return null;
}
```

### Opt-Out Integration

The "STOP" keyword is a **system-level rule** that cannot be deleted by the user:

```typescript
// This rule is created automatically for every new user/session
// and cannot be disabled:
{
  keyword: 'stop',
  matchType: 'EXACT',
  replyBody: 'You have been unsubscribed. Reply START to re-subscribe.',
  priority: 9999,  // always checked first
}

// On STOP match:
// 1. Set contact.optedOut = true, contact.optedOutAt = now
// 2. Cancel any queued messages for this contact in BullMQ
// 3. Log opt-out event in MessageLog
// 4. Send confirmation reply
```

### Deduplication of Inbound Events

Baileys can emit the same `messages.upsert` event multiple times (due to re-delivery on reconnect). Deduplicate using the WhatsApp message ID:

```typescript
// In InboundHandler.ts
// Use Redis SET with a TTL of 24 hours:
// Key: `dedup:inbound:{waMessageId}`
// If key exists → skip processing
// If key doesn't exist → process + set key with 24h TTL
```

---

## 3. Opt-Out / Unsubscribe System

### Scope
- Any contact who sends "STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT" (case-insensitive) is immediately opted out
- Opted-out contacts are **never** queued for any campaign — enforced in the BullMQ campaign processor BEFORE sending
- Re-subscribe: reply "START" or "YES" to re-enable

### Double Safety Check

Opt-out is checked at TWO points:
1. **At campaign creation time:** exclude opted-out contacts when building the message queue
2. **At send time (in processor):** re-check opt-out status before sending — contact may have opted out during a long-running campaign

```typescript
// campaign.processor.ts
async process(job: Job<CampaignJobPayload>) {
  // 1. Re-fetch contact to check current opt-out status
  const contact = await this.contactRepo.findById(job.data.contactId);
  if (contact.optedOut) {
    await this.messageLogRepo.update(job.data.logId, {
      status: 'FAILED',
      failReason: 'OPTED_OUT',
    });
    return; // skip silently
  }
  // 2. Proceed with send
}
```

### Audit Trail

Every opt-out/re-subscribe must be logged with:
- Timestamp
- Source (INBOUND_KEYWORD, ADMIN_MANUAL, CSV_IMPORT_FLAG)
- Who triggered it (contact's own message / admin user ID)

---

## 4. Media Message Support

### Upload Flow

```
Frontend → POST /media/upload (multipart)
    → backend validates MIME type + size
    → stream to MinIO (do NOT buffer in memory)
    → return { mediaId, url (presigned), type, size }
```

### Server-Side Validation Rules

```typescript
// media/media-validation.service.ts

const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/3gpp'],
  AUDIO: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
  DOCUMENT: ['application/pdf', 'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
             'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};

const MAX_SIZES = {
  IMAGE: 16 * 1024 * 1024,    // 16MB
  VIDEO: 100 * 1024 * 1024,   // 100MB
  AUDIO: 16 * 1024 * 1024,    // 16MB
  DOCUMENT: 100 * 1024 * 1024, // 100MB
};

// CRITICAL: Validate MIME type from file magic bytes, NOT from file extension
// Use the `file-type` npm package to read the first bytes of the stream
// Extension spoofing (uploading .exe renamed to .jpg) must be rejected
```

### Stream Upload to MinIO (Memory-Safe)

```typescript
// Never use multer's memoryStorage for large files
// Use multer's diskStorage or pipe directly to MinIO:

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
// For large files, switch to streaming:
// pipe req.file.stream directly to minioClient.putObject()
```

### Sending Media via Baileys

```typescript
// session-manager/MessageSender.ts

// For media, download from MinIO to a temp buffer (or stream), then send:
const buffer = await minioClient.getObject(bucket, objectName);

await socket.sendMessage(jid, {
  image: buffer,              // or video / audio / document
  caption: resolvedCaption,   // template body after variable substitution
  mimetype: 'image/jpeg',
  fileName: 'campaign.jpg',   // for documents
});
```

---

## 5. Conversation Inbox

### Index Additions for Inbox

No new table needed — `MessageLog` already captures both INBOUND and OUTBOUND. Generate a TypeORM migration to add the following indexes:

```sql
-- migration: AddMessageLogInboxIndexes
CREATE INDEX IF NOT EXISTS idx_message_logs_contact_created ON message_logs ("contactId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_message_logs_user_direction_created ON message_logs ("userId", direction, "createdAt");
```

### Inbox API Endpoints

```
GET /inbox                    → list conversations (last message per contact, sorted by date)
GET /inbox/:contactId         → full conversation thread (paginated, cursor-based)
POST /inbox/:contactId/send   → send a manual one-off message to a contact
```

### Pagination Strategy

Use **cursor-based pagination** for conversations (not offset), as new messages arriving mid-scroll would cause offset drift:

```typescript
// GET /inbox/:contactId?cursor=<messageId>&limit=50
// Returns messages before the cursor, sorted newest→oldest
// Frontend renders newest at bottom, loads older messages on scroll up
```

---

## 6. Drip Campaign / Sequence Builder

### Drip Entities (TypeORM)

Add to the `campaigns` module:

```typescript
// campaigns/entities/drip-sequence.entity.ts
export enum StepCondition { ALWAYS = 'ALWAYS', NO_REPLY = 'NO_REPLY', REPLIED = 'REPLIED' }
export enum EnrollStatus  { ACTIVE = 'ACTIVE', PAUSED = 'PAUSED', COMPLETED = 'COMPLETED', UNSUBSCRIBED = 'UNSUBSCRIBED' }

@Entity('drip_sequences') @Index(['userId'])
export class DripSequence {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'userId' }) user: User;
  @OneToMany(() => DripStep, s => s.sequence) steps: DripStep[];
  @OneToMany(() => DripEnrollment, e => e.sequence) enrollments: DripEnrollment[];
}

// campaigns/entities/drip-step.entity.ts
@Entity('drip_steps') @Index(['sequenceId', 'stepNumber'])
export class DripStep {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() sequenceId: string;
  @Column() stepNumber: number;   // 1, 2, 3...
  @Column() templateId: string;
  @Column() delayHours: number;   // hours after previous step
  @Column({ type: 'enum', enum: StepCondition, default: StepCondition.ALWAYS }) condition: StepCondition;

  @ManyToOne(() => DripSequence, s => s.steps, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'sequenceId' }) sequence: DripSequence;
  @ManyToOne(() => Template) @JoinColumn({ name: 'templateId' }) template: Template;
}

// campaigns/entities/drip-enrollment.entity.ts
@Entity('drip_enrollments')
@Unique(['sequenceId', 'contactId'])
@Index(['sequenceId', 'status'])
export class DripEnrollment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() sequenceId: string;
  @Column() contactId: string;
  @Column() sessionId: string;
  @Column({ default: 1 }) currentStep: number;
  @Column({ type: 'enum', enum: EnrollStatus, default: EnrollStatus.ACTIVE }) status: EnrollStatus;
  @CreateDateColumn() enrolledAt: Date;
  @Column({ nullable: true }) completedAt?: Date;

  @ManyToOne(() => DripSequence, s => s.enrollments, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'sequenceId' }) sequence: DripSequence;
  @ManyToOne(() => Contact) @JoinColumn({ name: 'contactId' }) contact: Contact;
}
```

### Drip Sequence Engine

```typescript
// campaigns/drip.service.ts

// Enrolling contacts into a sequence:
async enroll(sequenceId: string, contactIds: string[], sessionId: string): Promise<void> {
  // 1. Filter opted-out contacts
  // 2. Upsert DripEnrollment records (idempotent)
  // 3. Schedule Step 1 for each contact via BullMQ delayed job (delay = step.delayHours * 3600000)
}

// Processing a drip step:
async processDripStep(enrollmentId: string, stepNumber: int): Promise<void> {
  // 1. Fetch enrollment, check status === ACTIVE
  // 2. Fetch step template + contact
  // 3. Check step condition (e.g. NO_REPLY: skip if contact replied since enrollment)
  // 4. Send message via session-manager
  // 5. Advance currentStep
  // 6. Schedule next step if exists, else mark enrollment COMPLETED
}
```

### Conditional Step Logic

When `condition = NO_REPLY`: check `MessageLog` for any INBOUND message from the contact after `enrollment.enrolledAt`. If found, skip this step (contact has engaged — no need to nudge).

---

## 7. Frontend Pages — Phase 2

```
app/(dashboard)/
├── campaigns/
│   └── new/
│       └── page.tsx      ← add scheduling date picker + drip option to wizard
├── inbox/
│   ├── page.tsx          ← conversation list
│   └── [contactId]/
│       └── page.tsx      ← chat thread view
├── automations/
│   ├── auto-replies/
│   │   ├── page.tsx      ← list keyword rules
│   │   └── new/page.tsx  ← rule builder form
│   └── drip-sequences/
│       ├── page.tsx      ← list sequences
│       ├── new/page.tsx  ← sequence builder (step chain UI)
│       └── [id]/page.tsx ← enrollment stats per step
```

### Drip Sequence Builder UI

- Visual step chain: `[Step 1: Template A] → [+N days] → [Step 2: Template B] → [+N days] → ...`
- Drag-to-reorder steps
- Per-step: select template, set delay, set condition
- Show enrollment count and completion rate per sequence

---

## 8. Internal Service Communication

Phase 2 introduces the need for `session-manager` to communicate back to the NestJS backend (inbound messages, status updates). Use **BullMQ** for this — do NOT use direct HTTP calls from session-manager to NestJS (creates tight coupling and circular dependency):

```typescript
// session-manager publishes to queue: 'inbound-messages'
// NestJS backend has a BullMQ consumer for 'inbound-messages'
// This means session-manager only needs Redis access — no HTTP dependency on backend

// Job payload for inbound:
{
  userId: string,
  sessionId: string,
  fromJid: string,     // sender phone JID
  waMessageId: string,
  body: string,
  timestamp: number,
  mediaType?: string,
  mediaBase64?: string, // only for small media (< 1MB), else store in MinIO first
}
```

---

## 9. Unit Test Instructions — Phase 2

### Key Unit Tests

```typescript
// scheduler.service.spec.ts
describe('SchedulerService', () => {
  it('throws BadRequestException if scheduledAt is in the past')
  it('adds delayed BullMQ job with correct delay in milliseconds')
  it('uses idempotent jobId (launch:{campaignId}) to prevent duplicate jobs')
  it('cancelScheduledCampaign removes the BullMQ job and resets status to DRAFT')
  it('rescheduling replaces the old job with a new delayed job')
})

// keyword-matcher.service.spec.ts
describe('KeywordMatcher', () => {
  it('EXACT match: "stop" matches "STOP" case-insensitively')
  it('CONTAINS match: "order" matches message "my order is wrong"')
  it('STARTS_WITH match: "hi" matches "Hi can you help"')
  it('higher priority rule wins when multiple rules match')
  it('REGEX: valid pattern matches correctly')
  it('REGEX: ReDoS pattern (e.g. ^(a+)+$) is rejected on save with 400')
  it('returns null when no rules match')
})

// drip.service.spec.ts
describe('DripService', () => {
  it('enroll(): skips opted-out contacts silently')
  it('enroll(): upserts enrollments idempotently (no duplicate on re-enroll)')
  it('processDripStep(): skips step when status is not ACTIVE')
  it('processDripStep(): NO_REPLY condition skips step when contact replied')
  it('processDripStep(): marks enrollment COMPLETED after last step')
  it('processDripStep(): schedules next step with correct delay in ms')
})

// inbound-handler dedup spec
describe('InboundHandler deduplication', () => {
  it('processes first occurrence of a waMessageId')
  it('skips second occurrence of the same waMessageId (Redis key exists)')
})
```

---

## 10. E2E Test Instructions — Phase 2

### E2E File Structure (add to backend/test/)

```
backend/test/
├── scheduler.e2e-spec.ts        ← schedule, cancel, verify BullMQ job lifecycle
├── auto-reply.e2e-spec.ts       ← keyword rules CRUD + STOP keyword flow
├── drip-sequence.e2e-spec.ts    ← create sequence, enroll contacts, step delivery
└── inbox.e2e-spec.ts            ← conversation list and thread pagination
```

### Key E2E Tests

```typescript
// scheduler.e2e-spec.ts
describe('Campaign Scheduler', () => {
  it('POST /campaigns with scheduledAt 5s in future → status SCHEDULED, job in queue')
  it('Verifies job fires after 5s (use jest.useFakeTimers with BullMQ mock)')
  it('DELETE /campaigns/:id/schedule → removes job, status back to DRAFT')
})

// auto-reply.e2e-spec.ts
describe('Auto-Reply System', () => {
  it('POST /auto-reply-rules with ReDoS regex → 400')
  it('Inbound STOP message → contact.optedOut=true + confirmation reply sent')
  it('Inbound START message from opted-out contact → optedOut=false')
  it('Same waMessageId posted twice to /internal/inbound → processed only once')
})

// drip-sequence.e2e-spec.ts
describe('Drip Sequences', () => {
  it('Creates 3-step sequence, enrolls 5 BD contacts')
  it('Step 1 fires immediately, Step 2 scheduled after delayHours')
  it('Opted-out contact in enroll list is skipped — no DripEnrollment created')
  it('NO_REPLY condition: step skipped when contact sent a reply after enrollment')
})
```

---

## 11. Demo Data Seeding — Bangladesh Context

Extend the Phase 1 seed data with Phase 2 automation scenarios:

### Seed File Additions

```
backend/src/database/seeds/
└── 06-auto-replies.seed.ts   ← BD-specific keyword rules per user
└── 07-drip-sequences.seed.ts ← 2 drip sequences per user with BD templates
```

### BD Auto-Reply Rules

```typescript
// 06-auto-replies.seed.ts
const bdAutoReplies = [
  // Bangla STOP variants
  { keyword: 'stop',     matchType: 'EXACT',    replyBody: 'আপনার সাবস্ক্রিপশন বাতিল হয়েছে। পুনরায় পেতে START লিখুন।', priority: 9999 },
  { keyword: 'বন্ধ',    matchType: 'CONTAINS', replyBody: 'আপনার সাবস্ক্রিপশন বাতিল হয়েছে।', priority: 9998 },
  // Pricing inquiry
  { keyword: 'price',   matchType: 'CONTAINS', replyBody: 'আমাদের মূল্য তালিকার জন্য এখানে ক্লিক করুন: {{custom.priceListUrl}}', priority: 10 },
  { keyword: 'দাম',     matchType: 'CONTAINS', replyBody: 'আমাদের পণ্যের দাম জানতে 01712-XXXXXX তে কল করুন।', priority: 10 },
  // Order status
  { keyword: 'order',   matchType: 'CONTAINS', replyBody: 'Your order status: please provide your order number for tracking.', priority: 5 },
  { keyword: 'অর্ডার', matchType: 'CONTAINS', replyBody: 'আপনার অর্ডার নম্বরটি জানান, আমরা স্ট্যাটাস জানাব।', priority: 5 },
];
```

### BD Drip Sequence Scenarios

```typescript
// 07-drip-sequences.seed.ts
// Sequence 1: "New Customer Onboarding" (Rahim - RMG exporter)
//   Step 1 (0h) : Welcome + catalogue PDF
//   Step 2 (24h): Bulk discount offer for first order
//   Step 3 (72h): "Last chance" Eid collection promo
//
// Sequence 2: "Ramadan Campaign" (Karim - Sylhet foods)
//   Step 1 (0h) : Sehri menu message
//   Step 2 (12h): Iftar special offer
//   Step 3 (24h): Full day meal package promo

// Seed 10 BD contacts enrolled in each sequence
// Set enrolledAt to 48h ago so dashboard shows in-progress state
// Mark 3 contacts as COMPLETED per sequence (shows completion funnel)
```

---

## 12. Feature Documentation Guide — Phase 2

Add guides to `docs/guides/` for each Phase 2 feature:

```
docs/guides/
├── scheduling-campaigns.md      ← date/time picker, timezone, recurring options
├── auto-reply-rules.md          ← keyword types, priority, STOP keyword behaviour
├── drip-sequences.md            ← building a sequence, enroll contacts, step conditions
├── conversation-inbox.md        ← inbound messages, manual reply, unread counts
└── media-messages.md            ← supported formats, size limits, upload flow
```

Each guide follows the template established in Phase 1 (What / Prerequisites / Steps / Limitations / Troubleshooting).

---

## 13. Definition of Done — Phase 2

- [ ] Campaigns can be scheduled with a future datetime (timezone-aware)
- [ ] Scheduled campaigns auto-launch at the correct time (tested with 1-minute delay)
- [ ] Recurring campaign patterns (daily/weekly) fire on schedule for 3 consecutive occurrences
- [ ] "STOP" keyword received → contact opted-out → confirmation sent → excluded from future sends
- [ ] Custom keyword rules trigger correct auto-replies
- [ ] Bangla keyword variants (e.g. "বন্ধ") trigger opt-out correctly
- [ ] Duplicate inbound messages (same WA message ID) are processed only once
- [ ] Media uploads validate MIME from file bytes (not extension) and reject invalid files
- [ ] Images/PDFs sent in campaigns are received correctly on recipient phones
- [ ] Conversation inbox shows all inbound + outbound messages per contact in chronological order
- [ ] Drip sequence: 3-step sequence with delays fires all steps in correct order
- [ ] Drip step with NO_REPLY condition skips step when contact has replied
- [ ] Unit test coverage ≥ 80% across all Phase 2 modules
- [ ] All E2E critical path tests pass (schedule → fire, STOP → opt-out, drip enroll → step 1 fires)
- [ ] BD demo seed data loads for all Phase 2 features (`npm run seed`)
- [ ] `docs/guides/` contains guides for all Phase 2 features
