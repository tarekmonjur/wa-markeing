# Conversation Inbox

## What This Does

The Inbox shows every inbound and outbound message grouped by contact, giving you a unified view of all WhatsApp conversations. You can read full message threads and send one-off manual replies directly from the inbox — no campaign needed.

## Prerequisites

- At least one WhatsApp session in **CONNECTED** status
- Contacts must have exchanged at least one message (inbound or outbound)

## Inbox Structure

### Conversation List (`GET /inbox`)

Shows one row per contact, sorted by most recent message. Each row displays:

| Field | Description |
|-------|-------------|
| Contact name / phone | Identified by E.164 phone number |
| Last message preview | Truncated body of the last message |
| Last message time | UTC timestamp (displays in local time on frontend) |
| Direction badge | `INBOUND` or `OUTBOUND` |
| Unread count | Number of unread inbound messages |

**Unread logic:** A message is counted as unread when `direction = INBOUND` and `status = DELIVERED`. Once a thread is opened the unread count resets.

The list auto-refreshes every **10 seconds** on the frontend.

### Message Thread (`GET /inbox/:contactId`)

Opens the full message history with a single contact in chronological order (oldest at top, newest at bottom). Both inbound and outbound messages are shown.

Each message shows:

| Field | Description |
|-------|-------------|
| Body | Message text |
| Direction | `INBOUND` (from contact) / `OUTBOUND` (from you) |
| Status | `PENDING → SENT → DELIVERED → READ` (outbound) |
| Timestamp | Sent / delivered / read times |
| Media | Presigned URL for image / document / audio / video if present |

## Step-by-Step

### 1. View All Conversations

```
GET /api/v1/inbox?limit=50&offset=0
```

Returns a list of conversation summaries sorted by `lastMessageAt` descending.

### 2. Open a Thread

```
GET /api/v1/inbox/:contactId?limit=50
```

Returns the 50 most recent messages. Use the `cursor` parameter to load older messages.

### 3. Load Older Messages (Pagination)

The thread uses **cursor-based pagination** — pass the ID of the oldest message currently visible:

```
GET /api/v1/inbox/:contactId?cursor=<messageId>&limit=50
```

Returns messages **before** the cursor, newest → oldest. The response includes `hasMore: true/false` to indicate whether more pages exist. The frontend loads older messages as you scroll up.

### 4. Send a Manual Reply

Send a one-off message to a contact without creating a campaign:

```
POST /api/v1/inbox/:contactId/send
{
  "sessionId": "wa-session-uuid",
  "body": "আপনার অর্ডারটি আগামীকাল ডেলিভারি হবে।"
}
```

The message is logged in `MessageLog` with `direction = OUTBOUND` and tracked for delivery/read receipts.

## Real-Time Updates

New inbound messages arrive via WebSocket events (`ws://localhost:3001/ws`):

```
message:inbound  { contactId, message: { id, body, direction, status, createdAt } }
```

The frontend updates the conversation list and open thread without requiring a page refresh.

## API Endpoints

```
GET  /api/v1/inbox                       — List conversations (last message per contact)
GET  /api/v1/inbox/:contactId            — Get full message thread (cursor-paginated)
POST /api/v1/inbox/:contactId/send       — Send manual one-off message
```

### Query Parameters

| Endpoint | Parameter | Default | Description |
|----------|-----------|---------|-------------|
| `GET /inbox` | `limit` | 50 | Max conversations per page |
| `GET /inbox` | `offset` | 0 | Pagination offset |
| `GET /inbox/:contactId` | `limit` | 50 | Messages per page |
| `GET /inbox/:contactId` | `cursor` | — | MessageLog ID to paginate from |

## Limitations

- Messages are not deletable from the inbox (audit trail preserved)
- Manual replies are sent through a specific session — you must supply `sessionId`
- Media files sent by contacts (inbound media) are stored in MinIO and accessible via presigned URLs (1-hour TTL)
- The inbox shows all message directions (`INBOUND` + `OUTBOUND`) from `MessageLog` — it is not a separate data store

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Inbox is empty | No messages yet or session not connected | Send a test campaign or connect WhatsApp |
| Unread count not resetting | Frontend not calling the thread endpoint | Open the thread to mark messages as viewed |
| Thread stops loading older messages | `hasMore: false` | You have reached the beginning of the conversation |
| Manual reply fails | Session disconnected | Reconnect WhatsApp session first |
| Same inbound message appears twice | Baileys re-delivery race condition | System deduplicates by `waMessageId`; second occurrence is discarded |
