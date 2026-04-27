# Subscription Plans

## Plan Tiers

| Feature | FREE | STARTER | PRO | AGENCY |
|---------|------|---------|-----|--------|
| Contacts | 500 | 5,000 | 50,000 | Unlimited |
| WhatsApp Sessions | 1 | 2 | 10 | Unlimited |
| Campaigns/month | 5 | 30 | Unlimited | Unlimited |
| Messages/day | 100 | 500 | 2,000 | Unlimited |
| Team Members | 1 | 3 | 10 | Unlimited |
| AI Generations/day | 5 | 30 | 200 | Unlimited |
| Webhooks | ❌ | ✅ | ✅ | ✅ |
| REST API | ❌ | ❌ | ✅ | ✅ |
| Auto-Reply | ❌ | ✅ | ✅ | ✅ |
| Drip Sequences | ❌ | ✅ | ✅ | ✅ |

## Viewing Your Usage

1. Go to **Settings → Plan & Usage**
2. View progress bars showing current usage vs. plan limits
3. Yellow indicators appear at 80% usage, red at 95%

## How Limits are Enforced

- When you reach a limit, the system returns a `403 PLAN_LIMIT_EXCEEDED` error
- Monthly counters (campaigns) reset on the 1st of each month
- Daily counters (messages, AI) reset at midnight UTC
- Contact and session counts are tracked in real-time

## Upgrading

Contact your administrator or use the upgrade button on the Plan page to request a plan change.
