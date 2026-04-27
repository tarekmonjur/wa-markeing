# REST API Reference

## Authentication

### API Key Authentication

API keys are available on **PRO** and **AGENCY** plans.

1. Go to **Settings → API Keys**
2. Click **Create New API Key**
3. Copy the key immediately — it won't be shown again
4. Use the key in requests:

```bash
# Via X-API-Key header (recommended for scripts)
curl -H "X-API-Key: wam_..." https://your-domain.com/api/v1/contacts

# Via Authorization header (standard Bearer token)
curl -H "Authorization: Bearer wam_..." https://your-domain.com/api/v1/contacts
```

**Security notes:**
- API keys are stored as SHA-256 hashes — the raw key is never stored
- Never pass API keys as query parameters
- Revoke compromised keys immediately from the API Keys settings page

## Rate Limits

- 60 requests per minute per API key
- 1,000 requests per hour per API key

## Endpoints

### Send a Message

```
POST /api/v1/messages/send
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone | string | Yes | Phone number with country code (e.g. +8801712345678) |
| body | string | Yes | Message text |
| sessionId | UUID | Yes | WhatsApp session to send from |
| mediaUrl | string | No | URL of media to attach |
| mediaType | string | No | IMAGE, VIDEO, AUDIO, or DOCUMENT |

### Create a Campaign

```
POST /api/v1/campaigns
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Campaign name |
| sessionId | UUID | Yes | WhatsApp session ID |
| templateId | UUID | Yes | Message template ID |
| groupId | UUID | Yes | Contact group ID |
| autoStart | boolean | No | Start immediately (default: false) |

### List Campaigns

```
GET /api/v1/campaigns?page=1&limit=20
```

### Get Campaign Details

```
GET /api/v1/campaigns/:id
```

### Create/Update Contact

```
POST /api/v1/contacts
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| phone | string | Yes | Phone number |
| name | string | No | Contact name |
| email | string | No | Contact email |
| customFields | object | No | Custom fields (e.g. birthday, company) |

### Get Contact

```
GET /api/v1/contacts/:phoneOrId
```

### Unsubscribe Contact

```
DELETE /api/v1/contacts/:id/unsubscribe
```

### Campaign Analytics

```
GET /api/v1/analytics/campaigns/:id
```

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 403,
  "message": "Your FREE plan does not include this feature.",
  "error": "PLAN_FEATURE_RESTRICTED"
}
```

Common status codes:
- `401` — Invalid or missing API key/JWT
- `403` — Plan limit exceeded or feature not available
- `404` — Resource not found
- `429` — Rate limit exceeded
