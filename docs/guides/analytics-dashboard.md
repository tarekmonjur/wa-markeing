# Analytics Dashboard

## What This Does

The analytics dashboard gives you pre-aggregated statistics on message delivery, read rates, and reply rates — across all campaigns and over a rolling 30-day window. Data is maintained in dedicated read-model tables, so the dashboard loads in under one second even with millions of message logs.

You can also export per-campaign reports as CSV or PDF asynchronously.

## Prerequisites

- At least one completed or running campaign with message logs

## Dashboard Sections

### Overview (Last 30 Days)

Accessible at **Analytics → Overview**.

| Metric | Definition |
|--------|-----------|
| Sent | Total messages where status reached `SENT` |
| Delivered | Messages acknowledged by recipient's phone |
| Read | Messages opened by recipient |
| Failed | Messages that could not be delivered |
| Delivery Rate | `deliveredCount / sentCount × 100` |
| Read Rate | `readCount / deliveredCount × 100` |
| Reply Rate | `repliedCount / deliveredCount × 100` |

A bar chart shows daily breakdowns for the past 30 days so you can spot trends (e.g. higher engagement on weekends).

### Per-Campaign Analytics

Accessible at **Analytics → Campaigns → [Campaign Name]**.

Shows the same metrics scoped to a single campaign, plus:

- **Delivery Funnel:** Total → Sent → Delivered → Read → Replied
- **Per-Contact Status Table:** paginated list of every contact in the campaign with their individual message status and timestamps

## Step-by-Step

### 1. View the Overview

```
GET /api/v1/analytics/overview
```

Returns an array of daily stats for the last 30 days plus aggregate totals.

### 2. View a Campaign's Stats

```
GET /api/v1/analytics/campaigns/:id
```

Returns the `CampaignStats` read model: `{ sentCount, deliveredCount, readCount, failedCount, repliedCount, deliveryRate, readRate, replyRate, updatedAt }`.

### 3. List Campaigns with Stats

```
GET /api/v1/analytics/campaigns?startDate=2026-04-01&endDate=2026-04-30&status=COMPLETED
```

| Query param | Description |
|-------------|-------------|
| `startDate` | Filter campaigns created after this UTC date |
| `endDate` | Filter campaigns created before this UTC date |
| `status` | Filter by campaign status (COMPLETED, RUNNING, etc.) |
| `limit` | Results per page (default 20) |
| `offset` | Pagination offset |

### 4. Per-Contact Delivery Status

```
GET /api/v1/analytics/campaigns/:id/contacts?limit=50&offset=0
```

Returns each contact's message log entry for the campaign: name, phone, status, sentAt, deliveredAt, readAt.

### 5. Export a Report

#### Step A — Start the Export

```
POST /api/v1/analytics/campaigns/:id/export
{
  "format": "csv"   // or "pdf"
}
```

**Response:** `{ "jobId": "uuid" }`

The export runs asynchronously (large campaigns can have thousands of rows). Do not wait for the HTTP response to complete the file — use the `jobId` to poll.

#### Step B — Poll for Completion

```
GET /api/v1/analytics/exports/:jobId
```

| Response status | Meaning |
|-----------------|---------|
| `{ "status": "PENDING" }` | Job queued, not started yet |
| `{ "status": "PROCESSING" }` | File being generated |
| `{ "status": "COMPLETE", "downloadUrl": "..." }` | File ready; download within 24 hours |
| `{ "status": "FAILED", "error": "..." }` | Export failed; retry |

Poll every 2–3 seconds. Once `status = COMPLETE`, the `downloadUrl` is a presigned MinIO URL valid for 24 hours.

## Real-Time Updates During Active Campaigns

Stats update in real-time via WebSocket events while a campaign is running:

```
campaign:progress  { campaignId, sentCount, deliveredCount, failedCount, status }
```

The overview and per-campaign pages listen to this event and refresh counters without reloading the page.

## How Stats Are Maintained

Stats are updated **atomically** after each message state change using event listeners:

```
message.sent      → sentCount + 1
message.delivered → deliveredCount + 1, recalculate deliveryRate
message.read      → readCount + 1, recalculate readRate
message.failed    → failedCount + 1
```

This means queries always read pre-computed values — no expensive `GROUP BY` aggregations at request time.

## API Endpoints

```
GET  /api/v1/analytics/overview                       — 30-day daily aggregate stats
GET  /api/v1/analytics/campaigns                      — Campaign list with stats (filterable)
GET  /api/v1/analytics/campaigns/:id                  — Single campaign stats
GET  /api/v1/analytics/campaigns/:id/contacts         — Per-contact delivery status (paginated)
POST /api/v1/analytics/campaigns/:id/export           — Start async CSV/PDF export → { jobId }
GET  /api/v1/analytics/exports/:jobId                 — Poll export status → { status, downloadUrl }
```

## Limitations

- Stats are eventually consistent (updated via event emitter after each state change; < 1 second lag during active sends)
- PDF exports for campaigns with 10 000+ contacts may take 20–30 seconds
- `downloadUrl` expires after **24 hours** — re-trigger the export if the link expires
- Daily stats are keyed by UTC date; local-time date breakdowns must be handled on the frontend

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Stats show 0 for a completed campaign | Stats events not processed | Check BullMQ worker logs; stats are event-driven |
| Export stuck at `PROCESSING` | BullMQ export worker overloaded | Check worker health; retry after a few minutes |
| `deliveryRate` is `null` | `sentCount = 0` (division by zero guard) | Expected on campaigns that haven't sent yet |
| Overview shows gaps in the chart | No messages sent on those days | Expected; those days have 0 values |
