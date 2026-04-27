# Multi-Account WhatsApp

## What This Does

You can connect multiple WhatsApp accounts (phone numbers) to the platform and assign each campaign to a specific account. This lets you segment sends by brand, region, or contact list — and distribute volume across accounts to reduce ban risk.

## Prerequisites

- Extra phone number(s) available for WhatsApp
- Each number must be registered on WhatsApp before connecting

## Session (Account) Concepts

Each connected WhatsApp number is called a **session** (also called a WaSession internally). A user can have as many sessions as their plan allows.

| Field | Description |
|-------|-------------|
| Label | Friendly name for the account (e.g. "Dhaka Sales", "Sylhet Support") |
| Phone number | Set automatically after QR scan |
| Status | Current connection state (see below) |
| Daily send count | Messages sent today (resets at midnight UTC) |
| Is Default | Whether this account is pre-selected when creating campaigns |

## Session Status Reference

| Status | Meaning |
|--------|---------|
| `DISCONNECTED` | Not connected; no active Baileys socket |
| `CONNECTING` | Socket initiating; QR code being generated |
| `QR_READY` | QR code displayed; waiting for phone to scan (60-second window) |
| `CONNECTED` | Paired and online; ready to send |
| `TOS_BLOCK` | Account flagged by WhatsApp Terms of Service; paused automatically |
| `BANNED` | Account permanently banned by WhatsApp |

## Step-by-Step

### 1. Add a New Account

Navigate to **Settings → WhatsApp Accounts → Add Account**.

Or via API:

```
POST /api/v1/whatsapp/sessions
{
  "label": "Dhaka Sales Team"
}
```

A new session record is created with status `DISCONNECTED`.

### 2. Connect via QR Code

Open the session in Settings and click **Connect**. A QR code appears. Scan it with the WhatsApp app on the target phone:

1. Open WhatsApp → Settings → Linked Devices
2. Tap "Link a Device"
3. Scan the QR code

The QR code expires after **60 seconds**. If it expires, click Refresh QR.

Once scanned, the status transitions to `CONNECTED` and the phone number is recorded automatically.

### 3. Set a Label

```
PATCH /api/v1/whatsapp/sessions/:id
{
  "label": "Chattogram Retail",
  "isDefault": false
}
```

Labels appear in the campaign creation dropdown and the session list.

### 4. Set a Default Account

Mark an account as default and it will be pre-selected when creating new campaigns:

```
PATCH /api/v1/whatsapp/sessions/:id
{ "isDefault": true }
```

Only one session can be the default at a time.

### 5. Assign an Account to a Campaign

When creating a campaign, select the desired WhatsApp account:

```
POST /api/v1/campaigns
{
  "name": "Eid Offer — Dhaka",
  "sessionId": "uuid-of-dhaka-account",
  "templateId": "uuid",
  "groupId": "uuid"
}
```

Each campaign is bound to exactly one WhatsApp account for its full run.

### 6. Monitor Daily Send Counts

The `dailySendCount` field on each session shows how many messages have been sent today. The counter resets automatically at midnight UTC.

```
GET /api/v1/whatsapp/sessions
```

Returns all sessions with current `status`, `dailySendCount`, and `dailySendDate`.

### 7. Disconnect an Account

```
DELETE /api/v1/whatsapp/sessions/:id
```

Logs out the session from Baileys and removes session credentials. This action cannot be undone — the QR must be scanned again to reconnect.

## Anti-Ban Best Practices

Spreading volume across multiple accounts keeps each account below WhatsApp's unofficial detection thresholds.

| Guideline | Reason |
|-----------|--------|
| Do not send more than 200 messages/day per account | Hard daily cap enforced by the platform |
| Allow 3–8 seconds between messages | Minimum 2 s enforced; random delay mimics human behaviour |
| Use different template content | Identical messages sent in bulk are a ban signal |
| Do not send to numbers that never replied | Low engagement ratios increase ban risk |
| Pause a session immediately on `TOS_BLOCK` | Continuing to send after a TOS block leads to a full ban |

## API Endpoints

```
POST   /api/v1/whatsapp/sessions          — Register a new session
GET    /api/v1/whatsapp/sessions          — List all sessions
GET    /api/v1/whatsapp/sessions/:id      — Get session details
PATCH  /api/v1/whatsapp/sessions/:id      — Update label / isDefault
DELETE /api/v1/whatsapp/sessions/:id      — Disconnect and delete session
GET    /api/v1/whatsapp/sessions/:id/qr   — Get current QR code (SSE stream)
```

## Limitations

- Maximum sessions per plan: FREE = 1, STARTER = 2, PRO = 5, AGENCY = 20
- Session credentials are stored on the session-manager file volume (mounted Docker volume `sessions/`) — data is lost if the volume is deleted
- A session in `BANNED` status cannot be recovered; a new phone number is required

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| QR expiry before scan | 60-second window missed | Click Refresh QR |
| `CONNECTING` for hours | Baileys socket stuck | Restart the session-manager container |
| `TOS_BLOCK` after a campaign | Sent too many messages too fast | Wait 24h, reduce send rate, reconnect |
| Two sessions with the same phone | Duplicate connect | Delete the duplicate; WhatsApp only allows one active session per number |
| `dailySendCount` not resetting | Midnight UTC job delayed | Check cron job logs; manually reset via Redis if urgent |
