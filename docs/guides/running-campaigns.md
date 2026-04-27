# Running Campaigns

## Campaign Lifecycle

```
DRAFT → RUNNING → COMPLETED
         ↓    ↗
       PAUSED
         ↓
       FAILED (cancelled)
```

## Steps

### 1. Create Campaign

```
POST /api/v1/campaigns
{
  "name": "Eid Offer 2025",
  "sessionId": "uuid",
  "templateId": "uuid",
  "groupId": "uuid"
}
```

### 2. Start Campaign

```
POST /api/v1/campaigns/:id/start
```

Requirements:
- WhatsApp session must be `CONNECTED`
- Campaign must have a template and contact group
- Group must have at least one non-opted-out contact

### 3. Monitor Progress

Real-time progress via WebSocket at `ws://localhost:3001/ws`:

Events:
- `campaign:progress` — sent/delivered/failed count updates
- `campaign:completed` — campaign finished

### 4. Pause / Cancel

```
POST /api/v1/campaigns/:id/pause
POST /api/v1/campaigns/:id/cancel
```

## Rate Limiting

- **Minimum delay**: 2 seconds between messages
- **Daily cap**: 200 messages per session per day
- Automatic retry with exponential backoff (3 attempts)

## API Endpoints

```
POST   /api/v1/campaigns              — Create
GET    /api/v1/campaigns              — List (paginated)
GET    /api/v1/campaigns/:id          — Get details
PATCH  /api/v1/campaigns/:id          — Update (DRAFT only)
POST   /api/v1/campaigns/:id/start    — Start sending
POST   /api/v1/campaigns/:id/pause    — Pause
POST   /api/v1/campaigns/:id/cancel   — Cancel
```
