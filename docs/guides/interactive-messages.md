# Interactive WhatsApp Messages

## Overview

Send interactive messages (buttons and lists) to contacts for richer engagement and menu-driven chatbot flows.

## Message Types

### Button Messages

Up to 3 buttons per message. Contacts tap a button to reply.

```json
{
  "type": "button",
  "body": "Please choose an option:",
  "footer": "Reply within 24 hours",
  "buttons": [
    { "id": "opt_1", "text": "Product Info" },
    { "id": "opt_2", "text": "Pricing" },
    { "id": "opt_3", "text": "Support" }
  ]
}
```

**Limitations:**
- Maximum 3 buttons
- Button text: max 20 characters
- Button IDs are returned in the reply for programmatic routing

### List Messages

Menu-style messages with up to 10 sections and 10 items each.

```json
{
  "type": "list",
  "body": "Browse our catalog:",
  "buttonText": "View Options",
  "sections": [
    {
      "title": "Products",
      "rows": [
        { "id": "prod_1", "title": "Panjabi", "description": "Premium cotton" },
        { "id": "prod_2", "title": "Saree", "description": "Silk collection" }
      ]
    }
  ]
}
```

## Reply Handling

When a contact replies to an interactive message:

- **Button replies** include `buttonResponseId` with the selected button's ID
- **List replies** include `listResponseId` with the selected row's ID

These can be used with Auto-Reply rules to create menu-driven chatbot flows.

## Sending via API

Use the `interactive` field in the campaign queue message:

```json
{
  "phone": "+8801712345678",
  "body": "Choose an option:",
  "interactive": {
    "type": "button",
    "buttons": [
      { "id": "yes", "text": "Yes" },
      { "id": "no", "text": "No" }
    ]
  }
}
```

## Known Limitations

- Interactive messages may not be supported on all WhatsApp Web versions
- Some older phone models may display button messages as plain text
- WhatsApp may rate-limit interactive messages more strictly
