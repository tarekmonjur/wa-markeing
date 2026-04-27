# Birthday & Date Automations

## Overview

Automatically send personalized messages to contacts on their birthday, anniversary, or any other custom date field.

## Setup

### Step 1: Add Date Fields to Contacts

Ensure your contacts have a date field in their custom fields. When importing contacts via CSV, include a column like `birthday` or `anniversary` in `YYYY-MM-DD` format.

Example contact custom fields:
```json
{
  "birthday": "1990-05-15",
  "anniversary": "2015-03-20"
}
```

### Step 2: Create a Message Template

Create a template for the automation message. Use `{{name}}` and other variables:

```
শুভ জন্মদিন {{name}}! 🎂
আপনার বিশেষ দিনে আমাদের পক্ষ থেকে শুভেচ্ছা।
```

### Step 3: Configure the Automation

1. Go to **Automations → Date Automations**
2. Click **New Automation**
3. Select a WhatsApp session and message template
4. Set the **Date Field Name** (e.g. `birthday`)
5. Set the **Send Time** (HH:mm format, in your timezone)
6. Click **Create**

## How It Works

- A daily job runs at midnight UTC
- For each active automation, it finds contacts where the MM-DD of the date field matches today
- Messages are enqueued with a delay until the configured send time in your timezone
- Year is ignored — so a birthday of `1990-05-15` will trigger every May 15

## February 29 Handling

If a contact has a February 29 birthday:
- In leap years: message is sent on February 29
- In non-leap years: message is sent on February 28

## Important Notes

- Opted-out contacts are automatically excluded
- Contacts with missing or invalid date values are skipped
- Each contact receives at most one message per day per automation
- The automation uses an idempotency key to prevent duplicate sends
