# Media Messages

## What This Does

You can attach images, videos, audio clips, and documents to message templates. When a campaign runs, the media file is sent alongside the template text via WhatsApp. Inbound media received from contacts is also stored and viewable in the conversation inbox.

## Prerequisites

- Media file ready to upload (see supported formats below)
- Message template to attach the media to

## Supported File Types and Size Limits

| Category | MIME Types | Max Size |
|----------|-----------|----------|
| **IMAGE** | `image/jpeg`, `image/png`, `image/webp`, `image/gif` | 16 MB |
| **VIDEO** | `video/mp4`, `video/3gpp` | 100 MB |
| **AUDIO** | `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`, `audio/ogg` | 16 MB |
| **DOCUMENT** | `application/pdf`, `.doc/.docx` (Word), `.xls/.xlsx` (Excel) | 100 MB |

## Upload Flow

```
1. POST /api/v1/media/upload  (multipart/form-data, field: "file")
   ↓
2. Server validates MIME type from file magic bytes
   ↓
3. File streamed to MinIO — never buffered fully in memory
   ↓
4. Response: { mediaId, url (presigned), type, mimeType, size }
   ↓
5. Use returned url or mediaId when creating/updating a template
```

## Step-by-Step

### 1. Upload a File

```bash
curl -X POST http://localhost:3001/api/v1/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@./eid-offer.jpg"
```

**Response:**

```json
{
  "mediaId": "3f2504e0-...",
  "url": "https://minio.../wa-media/...?X-Amz-Expires=3600...",
  "type": "IMAGE",
  "mimeType": "image/jpeg",
  "size": 524288
}
```

The `url` is a **presigned URL** valid for 1 hour. Use it immediately for preview; store `mediaId` for long-term reference.

### 2. Attach Media to a Template

Pass `mediaUrl` (the presigned URL or stored MinIO path) and `mediaType` when creating or updating a template:

```
POST /api/v1/templates
{
  "name": "Eid Offer with Banner",
  "body": "আস্সালামু আলাইকুম {{name}}! ঈদ উপলক্ষে ২০% ছাড়।",
  "mediaUrl": "https://minio.../wa-media/eid-offer.jpg",
  "mediaType": "IMAGE"
}
```

### 3. Use in a Campaign

Campaigns automatically pick up the media from the template. When the campaign runs, each contact receives the image + caption (template body with their name substituted).

## MIME Validation — Extension Spoofing Protection

The server validates the actual file content using **magic bytes** (first bytes of the file stream), not the file extension. A file renamed from `malware.exe` to `promo.jpg` will be rejected because its magic bytes do not match any allowed image format.

| Format | Magic bytes checked |
|--------|---------------------|
| JPEG | `0xFF 0xD8 0xFF` |
| PNG | `0x89 0x50 0x4E 0x47` |
| PDF | `0x25 0x50 0x44 0x46` |
| MP4 | `ftyp` box at byte 4 |
| GIF | `GIF87a` or `GIF89a` |
| WebP | `RIFF....WEBP` |

## MinIO Storage

- **Bucket:** `wa-media`
- **Object naming:** `{uuid}.{ext}` (content-addressed — same file uploaded twice reuses the same object)
- **Access:** Always via presigned URLs (1-hour TTL) — MinIO is never exposed directly to the public internet
- **Streaming:** Files are piped directly from the request to MinIO; they are never fully buffered in server memory

## API Endpoints

```
POST /api/v1/media/upload   — Upload a file; returns mediaId + presigned URL
GET  /api/v1/media/:mediaId — Get a fresh presigned URL for an existing media object
```

## Limitations

- Files exceeding the size limit are rejected with `413 Payload Too Large`
- Files with an unrecognised MIME type are rejected with `415 Unsupported Media Type`
- Presigned URLs expire after **1 hour** — regenerate via `GET /media/:mediaId` if needed
- Video messages on WhatsApp may be compressed by WhatsApp servers (quality loss for very large files)
- Audio messages are delivered as voice messages by default; use AAC or MP3 for best compatibility

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `415 Unsupported Media Type` | File type not in allowed list | Check the supported types table above |
| `413 Payload Too Large` | File exceeds size limit | Compress or resize the file |
| `400 Bad Request: MIME mismatch` | File extension doesn't match content | Use the correct extension; do not rename files |
| Presigned URL expired | URL is older than 1 hour | Call `GET /media/:mediaId` to get a fresh URL |
| Media not received on phone | WhatsApp session throttling | Reduce campaign send rate; check session health |
