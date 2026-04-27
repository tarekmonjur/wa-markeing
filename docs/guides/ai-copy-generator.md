# AI Copy Generator

## What This Does

The AI Copy Generator creates short, engaging WhatsApp marketing messages based on your business context. You provide the business name, product, goal, and tone — the AI returns a ready-to-send message that you can copy directly into a template.

Two AI providers are supported: **OpenAI** (cloud, high quality) and **Ollama** (fully local, free). The system automatically falls back to Ollama if OpenAI is unavailable.

## Prerequisites

- For OpenAI: `OPENAI_API_KEY` set in your environment
- For Ollama: Docker running with the `ollama` service started and `llama3.2:3b` model pulled
  ```bash
  docker exec ollama ollama pull llama3.2:3b
  ```
- No prerequisites if only using Ollama (fully self-hosted, no API key needed)

## Step-by-Step

### 1. Open the AI Generator

Navigate to **AI Generator** in the sidebar, or call the API directly.

### 2. Fill in the Form

| Field | Required | Example |
|-------|----------|---------|
| `businessName` | Yes | `Dhaka Fashion House` |
| `product` | Yes | `Eid collection 2026` |
| `goal` | Yes | `announce 20% discount, drive online orders` |
| `tone` | Yes | `friendly`, `professional`, `urgent`, `casual` |
| `provider` | No | `openai` or `ollama` (default: whichever is configured) |

```
POST /api/v1/ai/generate
{
  "businessName": "Sylhet Foods",
  "product": "Iftar combo meal",
  "goal": "promote Ramadan iftar deal",
  "tone": "friendly"
}
```

### 3. Review the Output

**Response:**

```json
{
  "copy": "ইফতারের সেরা অফার! 🌙 Sylhet Foods-এর Iftar Combo এখন মাত্র ২৯৯ টাকায়। সীমিত সময়ের অফার — এখনই অর্ডার করুন!",
  "provider": "openai",
  "remaining": 8
}
```

- `copy` — Generated message text (≤ 160 characters, WhatsApp-optimised)
- `provider` — Which AI provider was used
- `remaining` — How many generations you have left today on your current plan

### 4. Use the Copy in a Template

Click **Copy to Clipboard** in the UI, then paste into a new or existing template. You can edit the generated text before saving.

## AI Providers

### OpenAI (Cloud)

- **Model:** `gpt-4o-mini`
- **Cost:** Uses your OpenAI API key; charged per token
- **Output quality:** High; handles both English and Bangla
- **Latency:** ~1–3 seconds

### Ollama (Local — Free)

- **Model:** `llama3.2:3b` (default; runs on CPU, no GPU required)
- **Cost:** Zero — fully self-hosted
- **Output quality:** Good for English; Bangla quality varies
- **Latency:** 5–15 seconds on CPU

**Automatic failover:** If OpenAI's API returns an error or key is missing, the system automatically retries with Ollama.

## Daily Quota Limits

Generations are counted per user per UTC day.

| Plan | Daily AI generations |
|------|---------------------|
| FREE | 10 |
| STARTER | 50 |
| PRO | 100 |
| AGENCY | 500 |

When the quota is exhausted the API returns `429 Too Many Requests`. The counter resets at **midnight UTC**.

## Security — Prompt Injection Protection

Your inputs (`businessName`, `product`, `goal`) are automatically sanitised before being embedded in the AI prompt. The following patterns are detected and stripped:

- `ignore all previous instructions`
- `you are now ...`
- `your new role/task/persona is ...`
- `forget all instructions`

Inputs are also truncated to 500 characters and stripped of HTML/Markdown. This prevents a malicious user from hijacking the AI prompt.

## API Endpoints

```
POST /api/v1/ai/generate
```

**Request body:**

```typescript
{
  businessName: string    // max 500 chars
  product:      string    // max 500 chars
  goal:         string    // max 500 chars
  tone:         string    // max 500 chars
  provider?:    'openai' | 'ollama'
}
```

**Response:**

```typescript
{
  copy:      string   // generated message text
  provider:  string   // which provider was used
  remaining: number   // quota remaining today
}
```

## Ollama Docker Setup

The `ollama` service is defined in `docker-compose.yml`. To enable it:

```yaml
# docker-compose.yml (already included)
ollama:
  image: ollama/ollama
  volumes:
    - ollama_data:/root/.ollama
  ports:
    - "11434:11434"
```

Pull the model once after first start:

```bash
docker exec ollama ollama pull llama3.2:3b
```

## Limitations

- Generated copy is ≤ 160 characters — always shorter than the 4096-character template limit; feel free to expand it manually
- Bangla output quality with Ollama `llama3.2:3b` varies; use OpenAI for production Bangla copy
- Quota is per-user, per-day (UTC); cannot be carried forward
- The API does not stream tokens — the full reply is returned after generation completes

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `429 Too Many Requests` | Daily quota exhausted | Wait for midnight UTC reset or upgrade plan |
| Response uses Ollama instead of OpenAI | `OPENAI_API_KEY` missing or invalid | Set a valid key in your `.env`; restart backend |
| Ollama returns an error | Model not pulled or container not running | Run `docker exec ollama ollama pull llama3.2:3b` |
| Generated copy not in Bangla | Tone/product fields in English | Include Bangla in the `goal` field: "announce offer in Bangla" |
| Input stripped / modified | Injection pattern detected | Remove instruction-like phrases from your input fields |
