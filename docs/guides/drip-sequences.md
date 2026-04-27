# Drip Sequences

## What This Does

A drip sequence is a series of time-delayed messages sent to contacts automatically. You define the steps (each with a template, a delay, and an optional condition), enroll contacts, and the system handles the rest — sending Step 1 immediately, Step 2 after the configured delay, and so on.

**Use cases:** onboarding new customers, follow-up nudge sequences, Ramadan sehri/iftar promotions over multiple days.

## Prerequisites

- At least one WhatsApp session in **CONNECTED** status
- Message templates created for each step
- Contacts to enroll (opted-in, not opted-out)

## Concepts

### Sequence

A named automation container. Has one or more steps. Can be active or inactive.

### Step

A single message in the sequence. Each step has:

| Field | Type | Description |
|-------|------|-------------|
| `stepNumber` | `number` | Order (1, 2, 3 …) |
| `templateId` | `uuid` | Template to send for this step |
| `delayHours` | `number` | Hours to wait after the previous step before sending this one |
| `condition` | `enum` | When to send (see below) |

### Step Conditions

| Condition | Behaviour |
|-----------|-----------|
| `ALWAYS` | Send regardless of contact activity |
| `NO_REPLY` | **Skip** this step if the contact sent any inbound message since enrollment (they engaged — no need to nudge) |
| `REPLIED` | **Only send** this step if the contact has replied since enrollment |

### Enrollment

Linking specific contacts to a sequence. Each enrollment tracks which step the contact is on and its current status.

### Enrollment Statuses

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Receiving steps normally |
| `PAUSED` | Steps paused (e.g. admin action) |
| `COMPLETED` | All steps sent; sequence finished |
| `UNSUBSCRIBED` | Contact sent STOP — no more steps will fire |

## Step-by-Step

### 1. Create a Sequence

```
POST /api/v1/drip-sequences
{
  "name": "New Customer Onboarding",
  "isActive": true
}
```

### 2. Add Steps

Each step is added individually. `stepNumber` controls the order; `delayHours` is relative to the previous step.

```
POST /api/v1/drip-sequences/:id/steps
{
  "stepNumber": 1,
  "templateId": "uuid-welcome-template",
  "delayHours": 0,
  "condition": "ALWAYS"
}
```

```
POST /api/v1/drip-sequences/:id/steps
{
  "stepNumber": 2,
  "templateId": "uuid-discount-template",
  "delayHours": 24,
  "condition": "NO_REPLY"
}
```

```
POST /api/v1/drip-sequences/:id/steps
{
  "stepNumber": 3,
  "templateId": "uuid-last-chance-template",
  "delayHours": 72,
  "condition": "NO_REPLY"
}
```

**Sequence flow:**

```
[Step 1: Welcome]  →  +24h  →  [Step 2: Discount (skip if replied)]
                                        │
                                       +72h
                                        │
                              [Step 3: Last Chance (skip if replied)]
```

### 3. Enroll Contacts

```
POST /api/v1/drip-sequences/:id/enroll
{
  "contactIds": ["uuid1", "uuid2", "uuid3"],
  "sessionId": "wa-session-uuid"
}
```

- Opted-out contacts are **silently skipped** — no enrollment created
- Re-enrolling the same contact is **idempotent** — existing active enrollment is not duplicated
- Step 1 fires immediately (or after `delayHours` = 0)

### 4. Monitor a Sequence

```
GET /api/v1/drip-sequences/:id
```

Returns the sequence with each step and aggregate enrollment counts (active / completed / unsubscribed / total enrolled).

### 5. Pause or Delete

```
PATCH /api/v1/drip-sequences/:id
{ "isActive": false }
```

Inactive sequences stop scheduling new step jobs. Enrollments already in flight complete their current queued step but do not advance further.

## Example: 3-Day Ramadan Sequence

| Step | Template | Delay | Condition |
|------|----------|-------|-----------|
| 1 | Sehri menu message | 0h | ALWAYS |
| 2 | Iftar special offer | 12h | ALWAYS |
| 3 | Full-day meal package | 24h | NO_REPLY |

## API Endpoints

```
POST   /api/v1/drip-sequences                   — Create sequence
GET    /api/v1/drip-sequences                   — List sequences
GET    /api/v1/drip-sequences/:id               — Get sequence + steps + enrollment stats
PATCH  /api/v1/drip-sequences/:id               — Update sequence (name, isActive)
DELETE /api/v1/drip-sequences/:id               — Delete sequence and all enrollments

POST   /api/v1/drip-sequences/:id/steps         — Add a step
PATCH  /api/v1/drip-sequences/:id/steps/:stepId — Update a step
DELETE /api/v1/drip-sequences/:id/steps/:stepId — Remove a step

POST   /api/v1/drip-sequences/:id/enroll        — Enroll contacts

GET    /api/v1/drip-sequences/:id/enrollments   — List enrollments (paginated)
```

## Limitations

- `delayHours` minimum: `0` (send immediately when step is reached)
- Contact must not be opted-out to be enrolled
- A contact can only have one active enrollment per sequence at a time
- Steps must have unique `stepNumber` values within a sequence
- Deleting a sequence cancels all pending BullMQ jobs for that sequence

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Contact not enrolled | Contact is opted-out | Check `contact.optedOut` status |
| Step 2 never fires | `NO_REPLY` condition and contact replied | Expected behaviour — contact engaged |
| Enrollment shows `UNSUBSCRIBED` | Contact sent STOP during sequence | Expected behaviour |
| Step fires twice | Unlikely; BullMQ job retry with idempotency enabled | Check Redis for duplicate job IDs |
| All steps show `COMPLETED` immediately | `delayHours: 0` on all steps | Set appropriate delays |
