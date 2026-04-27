# Google Sheets Contact Sync

## What This Does

Google Sheets sync lets you import contacts directly from a Google Spreadsheet and keep them in sync automatically. Map any column to contact fields (phone, name, custom fields), and optionally enable daily auto-sync so the platform always reflects the latest rows in your sheet.

> **Status:** This feature is part of Phase 3. Verify the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables are set before using it.

## Prerequisites

- A Google account with access to the target spreadsheet
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in your environment
- The spreadsheet must have a header row
- The spreadsheet must have at least one column containing phone numbers

## Step-by-Step

### 1. Connect Your Google Account

Navigate to **Integrations → Google Sheets → Connect Google Account**.

You will be redirected to Google's OAuth2 consent screen. Grant **read-only** access to Google Sheets (`spreadsheets.readonly` scope). No write permission is requested or stored.

After authorising, you are redirected back to the platform. Your OAuth tokens are stored **encrypted** in the database (AES-256-GCM).

### 2. Pick a Spreadsheet

After connecting, the platform lists your Google Drive spreadsheets. Select the one containing your contacts.

```
GET /api/v1/integrations/google-sheets/sheets
```

Returns a list of `{ sheetId, title }` objects.

### 3. Map Columns

Tell the platform which column contains the phone number, which has the name, and which custom fields to import.

```
POST /api/v1/integrations/google-sheets/import
{
  "sheetId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
  "mappings": {
    "phone":  "B",   // column letter or 1-based index
    "name":   "A",
    "email":  "C",
    "custom": {
      "city":     "D",
      "business": "E"
    }
  }
}
```

At least `phone` mapping is required. All other fields are optional.

### 4. Run the Import

The import runs through the same pipeline as CSV import:

1. Rows are fetched from the sheet
2. Phone numbers are normalised to E.164 format
3. Invalid phone numbers are skipped and reported
4. Contacts are upserted — duplicates are updated, not duplicated
5. A summary is returned: `{ imported, updated, skipped, errors }`

### 5. Enable Auto-Sync (Optional)

Auto-sync fetches the sheet daily at **02:00 UTC** and re-runs the import:

```
PATCH /api/v1/integrations/google-sheets/:integrationId
{
  "autoSync": true,
  "syncTime": "02:00"   // UTC
}
```

Each sync produces an `ImportLog` record you can review at any time.

### 6. Disconnect Google Account

```
DELETE /api/v1/integrations/google-sheets
```

Removes the stored OAuth token. Existing contacts imported from sheets are **not deleted** — only the sync configuration is removed.

## Security

| Concern | How It Is Handled |
|---------|------------------|
| OAuth tokens | Stored AES-256-GCM encrypted in DB; key loaded from environment secret |
| Scope | `spreadsheets.readonly` only — no write or drive access |
| Token refresh | Refresh token used silently when access token expires; no re-auth needed |
| SSRF protection | Sheet URLs are validated to ensure they are legitimate Google Sheets URLs before any API call |

## API Endpoints

```
GET    /api/v1/integrations/google-sheets/auth           — Start OAuth2 flow (redirect)
GET    /api/v1/integrations/google-sheets/callback        — OAuth2 callback (handled by platform)
GET    /api/v1/integrations/google-sheets/sheets          — List accessible sheets
POST   /api/v1/integrations/google-sheets/import          — Import contacts from a sheet
GET    /api/v1/integrations/google-sheets/logs            — View sync history
PATCH  /api/v1/integrations/google-sheets/:id             — Update auto-sync settings
DELETE /api/v1/integrations/google-sheets                 — Disconnect Google account
```

## Limitations

- Only Google Sheets are supported (not Excel files on Google Drive)
- The platform requests **read-only** access — it cannot write to your sheet
- Maximum 10 000 rows per import run; larger sheets should be split
- Auto-sync runs once daily; manual import can be triggered at any time
- Column mapping uses spreadsheet column letters (`A`, `B`, `C`, ...) or 1-based integers

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Invalid sheet URL" | URL is not a Google Sheets URL | Use the share URL from Google Sheets |
| `403 from Google API` | OAuth token expired and refresh failed | Disconnect and reconnect the Google account |
| All rows under `skipped` | Phone column mapping incorrect | Check the column letter; ensure the phone column has valid numbers |
| Auto-sync not running | `autoSync: false` or cron job failure | Check integration settings and cron logs |
| Import creates duplicates | Different phone formats across sync runs | Normalisation should prevent this; verify E.164 format in the sheet |
