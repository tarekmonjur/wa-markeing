# Connecting WhatsApp

## Overview

WhatsApp sessions are managed via the `/api/v1/whatsapp/sessions` endpoints. Each user can create sessions that will be linked to the Baileys session manager service.

## Session Lifecycle

1. **Create** — `POST /api/v1/whatsapp/sessions` creates a new session record
2. **QR Scan** — The session-manager service generates a QR code for pairing
3. **Connected** — Once scanned, status updates to `CONNECTED`
4. **Disconnected** — If the phone goes offline, status becomes `DISCONNECTED`

## Session States

| Status | Description |
|--------|-------------|
| `DISCONNECTED` | Initial state, not yet paired |
| `CONNECTING` | QR code displayed, waiting for scan |
| `CONNECTED` | Successfully paired and online |
| `LOGGED_OUT` | User explicitly logged out |

## API Endpoints

```
POST   /api/v1/whatsapp/sessions      — Create session
GET    /api/v1/whatsapp/sessions      — List all sessions
GET    /api/v1/whatsapp/sessions/:id  — Get session details
DELETE /api/v1/whatsapp/sessions/:id  — Delete session
```

## Troubleshooting

- **QR not appearing**: Ensure the session-manager service is running
- **Session keeps disconnecting**: Check phone internet connection
- **"Session not found" error**: The session may have been deleted; create a new one
