# A/B Message Testing

## What This Does

A/B testing lets you send two different message variants to different portions of the same contact group and measure which performs better. The system uses statistical significance testing (chi-squared) to tell you whether one variant is genuinely better or whether the difference could be chance.

## Prerequisites

- A campaign in **DRAFT** status
- At least one contact group with contacts
- Two different message templates (or inline message bodies) to compare

## Concepts

| Term | Meaning |
|------|---------|
| Variant A | The first message version |
| Variant B | The second message version (the challenger) |
| Split ratio | Fraction of contacts who receive Variant A (default `0.5` = 50/50) |
| Statistical significance | p-value < 0.05 means the difference is not due to random chance |
| Winner | The variant with the better read rate once significance is confirmed |

## Step-by-Step

### 1. Create a Campaign (DRAFT)

```
POST /api/v1/campaigns
{
  "name": "Eid Offer — A/B Test",
  "sessionId": "uuid",
  "groupId": "uuid"
}
```

### 2. Set Up the A/B Test

```
POST /api/v1/campaigns/:id/ab-test
{
  "variantA": "uuid-template-bengali",
  "variantB": "uuid-template-english",
  "splitRatio": 0.5
}
```

- `variantA` and `variantB` are template UUIDs or inline message body strings
- `splitRatio` must be between `0.1` and `0.9`; default `0.5` (50/50)

### 3. How Contacts Are Split

Contacts are shuffled using a **deterministic seeded algorithm** (Fisher-Yates with the A/B test ID as the seed). This means:

- The same contacts always end up in the same group if you re-run with the same test ID
- There is no bias from the order contacts appear in the database
- With `splitRatio = 0.5` and 100 contacts: 50 receive Variant A, 50 receive Variant B

### 4. Start the Campaign

```
POST /api/v1/campaigns/:id/start
```

Both variants are enqueued simultaneously. Contacts receive their assigned variant.

### 5. Monitor Results

While the campaign is running:

```
GET /api/v1/campaigns/:id/ab-test/results
```

**Response:**

```json
{
  "test": {
    "id": "uuid",
    "variantA": "Bengali Eid copy",
    "variantB": "English collection",
    "splitRatio": 0.5,
    "status": "RUNNING"
  },
  "results": {
    "A": { "sent": 50, "delivered": 47, "read": 31, "replied": 3 },
    "B": { "sent": 50, "delivered": 45, "read": 22, "replied": 1 }
  },
  "significance": {
    "pValue": 0.031,
    "isSignificant": true,
    "winner": "A",
    "message": "Variant A is significantly better (p < 0.05)"
  }
}
```

### 6. Reading the Significance Indicator

| Significance message | Meaning |
|----------------------|---------|
| `"Not enough data yet"` | Fewer than 100 messages delivered per variant — wait for more data |
| `"No significant difference (p = 0.23)"` | Variants perform similarly; flip a coin or keep both |
| `"Variant A is significantly better (p < 0.05)"` | Use Variant A for future campaigns |
| `"Variant B is significantly better (p < 0.05)"` | Use Variant B for future campaigns |

The test uses a **chi-squared 2×2 contingency table** comparing read rates:

```
            | Read | Not Read |
Variant A   |  31  |    16    |
Variant B   |  22  |    23    |
```

p-value < 0.05 → reject null hypothesis → one variant genuinely outperforms the other.

### 7. Mark Test Completed

```
PATCH /api/v1/campaigns/:id/ab-test
{ "status": "COMPLETED" }
```

This records the winner and final stats. The test can no longer be modified.

## Test Statuses

| Status | Meaning |
|--------|---------|
| `RUNNING` | Campaign active; results accumulating |
| `COMPLETED` | Winner declared; test closed |
| `CANCELLED` | Test cancelled before completion; no winner |

## API Endpoints

```
POST   /api/v1/campaigns/:id/ab-test             — Set up A/B test on a campaign
GET    /api/v1/campaigns/:id/ab-test             — Get test configuration
GET    /api/v1/campaigns/:id/ab-test/results     — Get live results + significance analysis
PATCH  /api/v1/campaigns/:id/ab-test             — Update status (complete / cancel)
```

## Limitations

- Only one A/B test per campaign
- Statistical significance requires at least **100 delivered messages per variant** — smaller groups will show "Not enough data"
- The metric used for significance is **read rate** (read / delivered)
- A/B tests cannot be added to a campaign that is already `RUNNING` — set up the test before starting

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Not enough data yet" despite many sends | Fewer than 100 *delivered* per variant | Wait for more deliveries; increase group size |
| Split is not 50/50 exactly | Rounding with odd contact counts | Expected (e.g. 100 contacts → 50 A, 50 B exactly; 101 → 50 A, 51 B) |
| Both variants show 0 reads | Campaign just started; reads take time | Wait a few minutes after delivery |
| `400` when creating A/B test | Campaign already has an A/B test | Delete the existing test first |
