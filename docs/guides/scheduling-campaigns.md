# Scheduling Campaigns

## What This Does

Campaigns can be scheduled for future delivery instead of launching immediately. The system uses BullMQ delayed jobs stored in Redis, so scheduled campaigns survive server restarts and fire at the exact target time.

## Prerequisites

- Campaign must exist in **DRAFT** status
- WhatsApp session must be **CONNECTED** (verified at launch time, not at schedule time)
- `scheduledAt` must be a future timestamp

## Step-by-Step

### 1. Create a Campaign (or Edit an Existing Draft)

```
POST /api/v1/campaigns
{
  "name": "Eid Mubarak 2026",
  "sessionId": "uuid",
  "templateId": "uuid",
  "groupId": "uuid"
}
```

The campaign is created with status `DRAFT`.

### 2. Schedule for Future Delivery

```
POST /api/v1/campaigns/:id/schedule
{
  "scheduledAt": "2026-05-01T10:00:00.000Z",
  "timezone": "Asia/Dhaka"
}
```

- `scheduledAt` — ISO 8601 UTC timestamp
- `timezone` — IANA timezone string (e.g. `Asia/Dhaka`, `America/New_York`). Used for display only; the value is stored as UTC.

On success the campaign status moves to **SCHEDULED**.

### 3. Cancel a Scheduled Campaign

```
DELETE /api/v1/campaigns/:id/schedule
```

Removes the pending BullMQ job and reverts status to **DRAFT**. The campaign can then be re-scheduled or launched manually.

### 4. Reschedule (Change the Time)

```
PATCH /api/v1/campaigns/:id/reschedule
{
  "scheduledAt": "2026-05-02T08:00:00.000Z"
}
```

Replaces the existing delayed job with a new one at the updated time. Status remains **SCHEDULED**.

### 5. Watch It Launch

At the scheduled time the system transitions:

```
SCHEDULED → RUNNING → COMPLETED
```

Real-time progress is visible via WebSocket (`ws://localhost:3001/ws`):

```
campaign:progress  { campaignId, sentCount, deliveredCount, failedCount, status }
campaign:completed { campaignId }
```

## Status Flow

```
DRAFT
  │ POST /campaigns/:id/schedule
  ▼
SCHEDULED
  │ scheduled time reached
  ▼
RUNNING
  │ all messages sent
  ▼
COMPLETED
```

From `SCHEDULED` you can also:
- `DELETE /campaigns/:id/schedule` → back to `DRAFT`
- `PATCH /campaigns/:id/reschedule` → stays `SCHEDULED` with new time

## API Endpoints

```
POST   /api/v1/campaigns/:id/schedule    — Schedule a campaign
PATCH  /api/v1/campaigns/:id/reschedule  — Change scheduled time
DELETE /api/v1/campaigns/:id/schedule    — Cancel scheduled campaign
POST   /api/v1/campaigns/:id/start       — Launch immediately (bypasses scheduler)
```

## Timezone Handling

| Concern | Behaviour |
|---------|-----------|
| Storage | Always UTC (`timestamptz` in PostgreSQL) |
| Input | Client sends ISO 8601 UTC; `timezone` field is metadata only |
| Display | Frontend converts UTC → local using `date-fns-tz` |
| Accuracy | BullMQ delay = `scheduledAt.getTime() - Date.now()` (millisecond precision) |

## Limitations

- `scheduledAt` must be at least a few seconds in the future; past timestamps are rejected with `400 Bad Request`
- If the WhatsApp session is disconnected at launch time the campaign transitions to `FAILED`
- Recurring / repeating schedules are configured via the `recurrence` field (daily / weekly / monthly) — see the campaign creation DTO for the full schema
- Recurring campaign patterns:
  - **daily** — repeats every day at the same time
  - **weekly** — repeats on selected `daysOfWeek` (0=Sun, 6=Sat)
  - **monthly** — repeats on a specific `dayOfMonth` (1–28, capped at 28 for February safety)
- Set an optional `endDate` (ISO string) to auto-stop recurring campaigns
- A cron job (`@nestjs/schedule`, runs every minute) checks for completed recurring campaigns and clones them for the next occurrence
- Monthly `dayOfMonth` is capped at 28 to handle February

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `400 Bad Request: scheduledAt must be in the future` | Timestamp is in the past | Use a future UTC timestamp |
| Campaign stays `SCHEDULED` and never launches | Redis is down or BullMQ worker not running | Check Redis connectivity and session-manager logs |
| Campaign launched but session `DISCONNECTED` | Phone went offline between schedule and launch | Reconnect WhatsApp, reschedule the campaign |
| Duplicate `RUNNING` campaigns | Same campaign scheduled twice | The BullMQ jobId `launch:{campaignId}` is idempotent — only one job can exist per campaign |
