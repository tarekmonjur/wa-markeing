# Importing Contacts

## CSV Format

Upload a CSV file with the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Contact display name |
| `phone` | Yes | Phone number (any format) |
| `email` | No | Email address |
| `*` | No | Any additional columns become `customFields` |

### Example CSV

```csv
name,phone,email,city,business
Farhan Ahmed,01712345001,farhan@test.com,Dhaka,Retailer
Suraiya Begum,+8801812345002,,Narayanganj,Wholesaler
```

## Phone Normalization

All phone numbers are automatically normalized to E.164 format:

- `01712345001` → `+8801712345001` (BD default country)
- `+8801812345002` → `+8801812345002` (already E.164)
- `017-1234-5001` → `+8801712345001` (strips formatting)

Invalid numbers are skipped and reported in the import summary.

## Deduplication

Contacts are deduplicated by `(userId, phone)`. If a contact with the same phone already exists, it is updated (upsert) rather than duplicated.

## API Endpoint

```
POST /api/v1/contacts/import/csv
Content-Type: multipart/form-data
Field: file (CSV file)
```

## Opt-Out

Contacts can be opted out via:
```
PATCH /api/v1/contacts/:id/opt-out
```

Opted-out contacts are excluded from all future campaigns.
