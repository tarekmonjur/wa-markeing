# Webhooks

## What This Does

Webhooks let you subscribe to platform events and receive real-time HTTP POST notifications at a URL you control. Use webhooks to integrate with CRMs, trigger automation workflows (Zapier, n8n, Make), or update your own system when a campaign completes or a message is delivered.

Each delivery is signed with HMAC-SHA256 so you can verify it came from this platform.

## Prerequisites

- A publicly accessible HTTPS endpoint (e.g. your server, a webhook.site test URL, or an n8n workflow URL)
- The endpoint must respond with a 2xx HTTP status code within 10 seconds

## Supported Events

| Event | Fired when |
|-------|-----------|
| `campaign.started` | A campaign transitions to `RUNNING` |
| `campaign.completed` | All messages in a campaign have been processed |
| `campaign.paused` | A campaign is paused mid-run |
| `campaign.failed` | A campaign is cancelled or encounters a fatal error |
| `message.sent` | A message is accepted by WhatsApp servers |
| `message.delivered` | A message is delivered to the recipient's device |
| `message.read` | A message is read by the recipient |
| `message.failed` | A message delivery fails permanently |
| `contact.opted_out` | A contact sends STOP and is opted out |

## Step-by-Step

### 1. Register an Endpoint

Navigate to **Integrations → Webhooks → Add Endpoint**, or via API:

```
POST /api/v1/webhooks
{
  "url": "https://your-server.com/webhook",
  "secret": "my-signing-secret-32chars-min",
  "events": ["campaign.completed", "message.failed", "contact.opted_out"]
}
```

- `url` must be **HTTPS** (HTTP is rejected in production)
- `secret` is your signing key — keep it private; used to verify the HMAC signature
- `events` is an array of event names to subscribe to; subscribe to only what you need

### 2. Verify the HMAC Signature

Every delivery includes an `X-Webhook-Signature` header. Verify it on your server before processing the payload:

**Node.js example:**

```javascript
const crypto = require('crypto');

function verifySignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)          // raw request body as Buffer or string
    .digest('hex');
  return `sha256=${expected}` === signature;
}

// In your webhook handler:
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-webhook-signature'];
  if (!verifySignature(req.rawBody, sig, 'my-signing-secret')) {
    return res.status(401).send('Invalid signature');
  }
  // Process payload...
  res.sendStatus(200);
});
```

**Important:** Compare signatures using a constant-time comparison function to prevent timing attacks.

### 3. Payload Format

All events share this envelope:

```json
{
  "event": "campaign.completed",
  "timestamp": "2026-05-01T10:30:00.000Z",
  "data": { ... }
}
```

**Example — `campaign.completed`:**

```json
{
  "event": "campaign.completed",
  "timestamp": "2026-05-01T10:30:00.000Z",
  "data": {
    "campaignId": "uuid",
    "name": "Eid Offer 2026",
    "sentCount": 48,
    "deliveredCount": 45,
    "failedCount": 3,
    "completedAt": "2026-05-01T10:30:00.000Z"
  }
}
```

**Example — `contact.opted_out`:**

```json
{
  "event": "contact.opted_out",
  "timestamp": "2026-05-01T11:00:00.000Z",
  "data": {
    "contactId": "uuid",
    "phone": "+8801712345678",
    "optedOutAt": "2026-05-01T11:00:00.000Z",
    "source": "INBOUND_KEYWORD"
  }
}
```

### 4. View Delivery History

```
GET /api/v1/webhooks/:endpointId/deliveries?limit=50&offset=0
```

Returns a list of recent delivery attempts with status, HTTP response code, and attempt timestamps.

### 5. Disable / Delete an Endpoint

Disable temporarily (keeps history):

```
PATCH /api/v1/webhooks/:id
{ "isActive": false }
```

Delete permanently:

```
DELETE /api/v1/webhooks/:id
```

## Retry Schedule

If your endpoint returns a non-2xx response or times out, the system retries with **exponential backoff**:

| Attempt | Delay after previous |
|---------|---------------------|
| 1st | Immediate |
| 2nd | 1 minute |
| 3rd | 5 minutes |
| 4th | 30 minutes |
| 5th | 2 hours |
| After 5 failures | Status → `ABANDONED`; no more retries |

When a delivery is `ABANDONED`, you receive an email notification (if email notifications are enabled in your account settings).

## Delivery Statuses

| Status | Meaning |
|--------|---------|
| `PENDING` | Queued, not yet attempted |
| `DELIVERED` | Endpoint responded 2xx |
| `FAILED` | Last attempt returned non-2xx or timed out; retrying |
| `ABANDONED` | All 5 attempts failed; no more retries |

## SSRF Protection

Before a webhook URL is saved, the platform validates it:

1. Must be `https://` (not `http://`)
2. DNS is resolved and the resulting IP must be a **public** IP address
3. Private IP ranges are blocked: `10.x.x.x`, `172.16–31.x.x`, `192.168.x.x`, `127.x.x.x`, `::1`

This prevents Server-Side Request Forgery (SSRF) attacks where a malicious URL redirects platform HTTP requests to internal services.

## API Endpoints

```
POST   /api/v1/webhooks                          — Register endpoint
GET    /api/v1/webhooks                          — List endpoints
GET    /api/v1/webhooks/:id                      — Get endpoint
PATCH  /api/v1/webhooks/:id                      — Update (url, events, isActive, secret)
DELETE /api/v1/webhooks/:id                      — Delete endpoint
GET    /api/v1/webhooks/:id/deliveries           — Delivery history (paginated)
POST   /api/v1/webhooks/:id/test                 — Send a test ping to the endpoint
```

## Limitations

- Maximum 10 webhook endpoints per user
- Webhook payloads are delivered without retrying after `ABANDONED`; re-subscribe to future events by ensuring your endpoint is healthy
- The `secret` field is write-only after creation — it cannot be read back (store it securely when you create the endpoint)
- Delivery timeout: 10 seconds per attempt

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `400: URL must be HTTPS` | Using HTTP URL | Use an HTTPS endpoint |
| `400: URL resolves to private IP` | Internal/local URL | Use a public URL; for testing use webhook.site |
| Deliveries stuck at `PENDING` | BullMQ webhook worker not running | Check worker health; verify Redis is running |
| Signature verification fails | Using request body after it was parsed | Pass the **raw** request body (Buffer) to the HMAC function, before JSON parsing |
| `ABANDONED` delivery | Endpoint was down for too long | Fix your endpoint, then re-trigger by re-subscribing or using the `/test` endpoint |
