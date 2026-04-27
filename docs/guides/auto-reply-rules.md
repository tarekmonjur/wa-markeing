# Auto-Reply Rules

## What This Does

Auto-reply rules let you automatically respond to inbound WhatsApp messages based on keywords. When a contact sends a message that matches a rule, the configured reply is sent instantly — no manual action needed.

The system also handles opt-out and opt-in keywords automatically (STOP / START).

## Prerequisites

- At least one WhatsApp session in **CONNECTED** status
- Inbound messages must be flowing through the session-manager service

## Match Types

| Type | Behaviour | Example keyword | Matches |
|------|-----------|-----------------|---------|
| `EXACT` | Full message equals keyword (case-insensitive) | `stop` | `"STOP"`, `"stop"` — not `"please stop"` |
| `CONTAINS` | Keyword appears anywhere in the message | `price` | `"what is the price?"`, `"price list please"` |
| `STARTS_WITH` | Message begins with keyword | `hi` | `"Hi there"`, `"hi can you help"` |
| `REGEX` | Full ECMAScript regex pattern | `order\s*\d+` | `"order 12345"`, `"order12"` |

All matching is **case-insensitive**.

## Priority

Rules are evaluated in descending priority order. Higher number = checked first.

- System **STOP** rule: priority `9999` (always checked first, cannot be deleted)
- User rules: default priority `0`; increase to override default rules

When multiple rules match the same message, only the **highest-priority** rule fires.

## Opt-Out Keywords (System — Cannot Be Deleted)

The following keywords automatically opt out the contact, send a confirmation, and prevent future campaign messages:

```
stop · unsubscribe · cancel · end · quit · বন্ধ
```

**Confirmation reply sent:**
> You have been unsubscribed. Reply START to re-subscribe.

## Opt-In Keywords

The following keywords re-enable a previously opted-out contact:

```
start · yes · শুরু
```

**Confirmation reply sent:**
> You have been re-subscribed. You will now receive messages again.

## Step-by-Step: Create a Rule

### 1. Create a Rule

```
POST /api/v1/auto-reply-rules
{
  "keyword": "price",
  "matchType": "CONTAINS",
  "replyBody": "আমাদের মূল্য তালিকার জন্য এখানে ক্লিক করুন: https://example.com/price",
  "priority": 10,
  "isActive": true
}
```

### 2. Scope to a Specific Session (Optional)

Add `sessionId` to limit the rule to one WhatsApp account:

```json
{
  "sessionId": "uuid",
  "keyword": "order",
  "matchType": "CONTAINS",
  "replyBody": "আপনার অর্ডার নম্বরটি জানান।"
}
```

If `sessionId` is omitted the rule applies to **all** your connected sessions.

### 3. Toggle Active/Inactive

```
PATCH /api/v1/auto-reply-rules/:id
{ "isActive": false }
```

Inactive rules are skipped during matching but kept for future use.

## REGEX Rules — Safety

User-supplied regex patterns are validated on save to prevent **ReDoS** (Regular Expression Denial of Service) attacks. The following patterns are rejected with `400 Bad Request`:

- Catastrophic backtracking patterns such as `(a+)+`, `(a|b)+c`, `(a+){2,}`
- Any pattern that can cause exponential match time

**Valid example:**
```json
{ "keyword": "order\\s*\\d+", "matchType": "REGEX", "replyBody": "Your order is being processed." }
```

## Session-Level Deduplication

Baileys can deliver the same inbound message more than once after a reconnect. The system deduplicates using the WhatsApp message ID (Redis key with 24-hour TTL), so your rule fires only once per unique message.

## API Endpoints

```
POST   /api/v1/auto-reply-rules           — Create rule
GET    /api/v1/auto-reply-rules           — List all rules (sorted by priority desc)
GET    /api/v1/auto-reply-rules/:id       — Get rule
PATCH  /api/v1/auto-reply-rules/:id       — Update rule
DELETE /api/v1/auto-reply-rules/:id       — Delete rule (system STOP rule cannot be deleted)
```

## Limitations

- The system STOP rule (priority 9999) cannot be deleted or disabled
- Maximum regex pattern length: 500 characters
- Reply body maximum: 4096 characters (WhatsApp text limit)
- Media replies (`mediaUrl`) are supported via the `mediaUrl` field on the rule

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Rule never fires | `isActive: false` or session not connected | Check rule status and session status |
| Wrong rule fires | Multiple rules match; priority tie | Increase priority on the intended rule |
| `400` on REGEX rule | Pattern flagged as ReDoS risk | Simplify the pattern; avoid nested quantifiers |
| STOP keyword not working | Contact message has extra characters | The STOP rule uses `EXACT` — contact must send exactly "stop" (case-insensitive) |
| Same reply sent twice | Baileys re-delivery before Redis dedup | This should not happen in normal operation; check Redis connectivity |
