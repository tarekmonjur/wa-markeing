# Smart Send Window

## Overview

Smart Send Window ensures your WhatsApp messages are only sent during business hours in your timezone. Messages queued outside the window are automatically deferred to the next opening.

## Configuration

1. Go to **Settings → Send Window**
2. Enable **Smart Send**
3. Set your **Timezone** (e.g. `Asia/Dhaka`)
4. Configure **Window Start** and **Window End** hours (24-hour format)
5. Select **Send Days** (e.g. Sunday-Thursday for Bangladesh)
6. Click **Save Settings**

## How It Works

- When a campaign or automation job is ready to send, the system checks whether the current time falls within your send window
- If outside the window, the message is rescheduled with a delay until the next window opens
- The message is not lost — it's deferred, not dropped
- Smart send can be disabled to allow 24/7 sending

## Bangladesh Example

For a typical BD business:
- Timezone: `Asia/Dhaka`
- Window: 9:00 AM to 9:00 PM
- Days: Sunday, Monday, Tuesday, Wednesday, Thursday
- Friday and Saturday off (BD weekend)

## Tips

- Messages never fail due to send window — they're rescheduled
- Campaign progress may appear slower when the window is narrow
- The window applies to all message types: campaigns, automations, and drip sequences
