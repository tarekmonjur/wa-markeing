# WhatsApp Marketing SaaS — Product Proposal

**Role:** Product Manager
**Date:** April 27, 2026
**Version:** 1.1 (Tech stack updated)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [R&D: Free WhatsApp Automation Libraries](#2-rd-free-whatsapp-automation-libraries)
3. [Technical Strategy (No Paid API)](#3-technical-strategy-no-paid-api)
4. [Tech Stack](#4-tech-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [NestJS Module Structure (SOLID)](#6-nestjs-module-structure-solid)
7. [Full Feature List](#7-full-feature-list)
8. [Development Phases & Roadmap](#8-development-phases--roadmap)
9. [Anti-Ban Architecture](#9-anti-ban-architecture)
10. [Risk Assessment](#10-risk-assessment)
11. [Cost Breakdown](#11-cost-breakdown)
12. [Verification Plan](#12-verification-plan)
13. [Confirmed Decisions](#13-confirmed-decisions)

---

## 1. Executive Summary

We will build a **self-hosted, multi-tenant WhatsApp Marketing SaaS Platform** that enables small businesses to send bulk and automated marketing messages via WhatsApp — **without paying for the official WhatsApp Business API**.

The platform uses the open-source **Baileys** library (WebSocket-based, MIT license) to connect each customer's own WhatsApp number and automate message delivery through a clean NestJS backend, Next.js frontend, and Docker Swarm deployment.

**Cost structure:** Server cost only (~$20–40/month VPS). Zero API/licensing fees.

---

## 2. R&D: Free WhatsApp Automation Libraries

After research, four viable free/open-source WhatsApp automation libraries were evaluated:

| Library | Approach | License | Stars | Status |
|---|---|---|---|---|
| **Baileys** | WebSocket (no browser) | MIT | 9.1k | ✅ Active |
| **whatsapp-web.js** | Puppeteer browser | Apache 2.0 | 21.7k | ✅ Active |
| **WPPConnect** | Puppeteer browser | LGPL v3 | 3.3k | ✅ Active |
| **Venom-bot** | Browser | Proprietary | 6.6k | ❌ Abandoned |

### Chosen Library: Baileys (Primary)

**Why Baileys wins:**
- Connects via **WebSocket directly** — no headless browser, far harder for WhatsApp to detect
- **Lowest server resource usage** — no Chromium process running per account
- Full **multi-device** support (scan QR once, works across sessions)
- **MIT licensed**, actively maintained (v7.0.0, Nov 2025)
- Pure TypeScript/Node.js — seamless NestJS integration

### Fallback Library: whatsapp-web.js

- Apache 2.0, 21.7k GitHub stars, largest community
- Uses Puppeteer (headless browser) — more memory, but very stable
- Ideal if Baileys breaking changes become an issue
- Swap is seamless due to `ISessionManager` abstraction interface (SOLID/DIP)

> **⚠️ Important Legal Disclosure:** Unofficial libraries violate WhatsApp's Terms of Service for automated bulk messaging. The platform must enforce opt-in lists, rate limiting, and provide users with clear ToS warnings to reduce account-ban risk.

---

## 3. Technical Strategy (No Paid API)

The core strategy is:

1. Customer registers an account on the platform
2. Customer scans a QR code with their own WhatsApp mobile app (same as WhatsApp Web)
3. Baileys establishes and persists a WebSocket session on the server
4. All message sending, automation, and scheduling operates through that session
5. Customer's WhatsApp number does the actual sending — no Meta/WhatsApp API involved
6. Per-user isolated sessions ensure one customer's issues don't affect others

This approach costs **$0 in API fees** — only server hosting is required.

---

## 4. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| **WhatsApp Layer** | Baileys (+ whatsapp-web.js fallback) | Free, WebSocket, MIT license, TypeScript-native |
| **Backend** | **NestJS** | Module system, Dependency Injection, enforces SOLID by design |
| **Frontend** | **Next.js + Tailwind CSS** | SSR/SSG, App Router, server components, fast UI |
| **Database** | PostgreSQL | Relational, excellent for contacts/campaigns/logs at scale |
| **Queue & Scheduling** | Bull + Redis | Per-user message queues, delayed jobs, scheduled campaigns |
| **File Storage** | MinIO (self-hosted S3-compatible) | Free media storage, no external S3 dependency |
| **Auth** | JWT + bcrypt (NestJS Passport) | Stateless, secure, standard |
| **Deployment** | **Docker + Docker Compose + Docker Swarm** | Production-grade multi-node orchestration, rolling updates |

**Estimated server cost:** ~$20–40/month (single VPS, e.g. DigitalOcean Droplet 4GB/2vCPU)

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Next.js Frontend                    │
│  (Dashboard, Campaigns, Contacts, Analytics, AI) │
└──────────────┬──────────────────────────────────┘
               │  REST API (JSON)
┌──────────────▼──────────────────────────────────┐
│           NestJS Backend (SOLID Modules)         │
│  Auth · Users · Contacts · Campaigns · Analytics │
│  Templates · Queue · AI · Webhooks               │
└───────┬──────────────┬───────────────────────────┘
        │              │
┌───────▼──────┐  ┌───▼──────────────────────────┐
│  PostgreSQL  │  │  Redis + Bull Queue           │
│  (tenants,   │  │  Per-user queues              │
│  contacts,   │  │  Scheduled jobs               │
│  campaigns,  │  │  Rate limiting per account    │
│  logs)       │  └──────┬────────────────────────┘
└──────────────┘         │
                  ┌──────▼───────────────────────┐
                  │  Session Manager Service      │
                  │  (Baileys instance pool)      │
                  │  1 Baileys session per user   │
                  │  QR generation / health check │
                  │  TOS_BLOCK auto-pause         │
                  └──────┬───────────────────────┘
                         │
                  ┌──────▼───────────────────────┐
                  │  MinIO (Media Storage)        │
                  │  Images, PDFs, Videos, Audio  │
                  └───────────────────────────────┘
```

### Docker Swarm Services

```
Stack: wa-marketing
├── backend        (NestJS API)          — replicas: 2
├── frontend       (Next.js)             — replicas: 2
├── session-mgr    (Baileys pool)        — replicas: 1 (pinned, no split-brain)
├── postgres       (Database)            — replicas: 1 (with volume)
├── redis          (Queue/Cache)         — replicas: 1 (with volume)
└── minio          (Object Storage)      — replicas: 1 (with volume)
```

- Secrets (DB password, JWT secret, API keys) stored as **Docker Swarm Secrets** — never in env vars or compose files
- Rolling updates with zero downtime: `--update-parallelism 1 --update-delay 10s`
- `session-mgr` constrained to a specific manager node to prevent Baileys session file split-brain

---

## 6. NestJS Module Structure (SOLID)

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/             ← AuthModule
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/   ← JWT, Local strategies
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── users/            ← UsersModule (tenant management)
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── entities/user.entity.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── whatsapp/         ← WhatsAppModule (Baileys session pool)
│   │   │   ├── whatsapp.controller.ts    (QR endpoint, session status)
│   │   │   ├── session-manager.service.ts
│   │   │   ├── interfaces/session-manager.interface.ts  ← ISessionManager
│   │   │   └── whatsapp.module.ts
│   │   │
│   │   ├── contacts/         ← ContactsModule
│   │   │   ├── contacts.controller.ts
│   │   │   ├── contacts.service.ts
│   │   │   ├── import.service.ts         (CSV/Excel parsing)
│   │   │   ├── entities/
│   │   │   │   ├── contact.entity.ts
│   │   │   │   ├── contact-group.entity.ts
│   │   │   │   └── contact-tag.entity.ts
│   │   │   └── contacts.module.ts
│   │   │
│   │   ├── templates/        ← TemplatesModule
│   │   │   ├── templates.controller.ts
│   │   │   ├── templates.service.ts
│   │   │   ├── variable-engine.service.ts  ({{name}} substitution)
│   │   │   ├── entities/template.entity.ts
│   │   │   └── templates.module.ts
│   │   │
│   │   ├── campaigns/        ← CampaignsModule
│   │   │   ├── campaigns.controller.ts
│   │   │   ├── campaigns.service.ts
│   │   │   ├── scheduler.service.ts
│   │   │   ├── drip.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── campaign.entity.ts
│   │   │   │   └── campaign-message.entity.ts
│   │   │   └── campaigns.module.ts
│   │   │
│   │   ├── queue/            ← QueueModule (Bull)
│   │   │   ├── queue.service.ts
│   │   │   ├── rate-limiter.service.ts
│   │   │   ├── processors/
│   │   │   │   ├── message.processor.ts
│   │   │   │   └── campaign.processor.ts
│   │   │   └── queue.module.ts
│   │   │
│   │   ├── analytics/        ← AnalyticsModule
│   │   │   ├── analytics.controller.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── report.service.ts         (PDF/CSV export)
│   │   │   ├── entities/message-log.entity.ts
│   │   │   └── analytics.module.ts
│   │   │
│   │   └── ai/               ← AiModule
│   │       ├── ai.controller.ts
│   │       ├── ai.service.ts
│   │       ├── providers/
│   │       │   ├── openai.provider.ts
│   │       │   └── ollama.provider.ts    (fully free, local LLM)
│   │       └── ai.module.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── response-transform.interceptor.ts
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   │
│   └── app.module.ts
```

### SOLID Principles Applied

| Principle | How It's Applied |
|---|---|
| **S** — Single Responsibility | Each module/service owns exactly one domain |
| **O** — Open/Closed | Extend via new modules; never modify core message pipeline |
| **L** — Liskov Substitution | `ISessionManager` interface → swap Baileys for whatsapp-web.js without changing business logic |
| **I** — Interface Segregation | Separate `IMessageSender`, `IContactRepository`, `ICampaignService`, `IAnalyticsService` |
| **D** — Dependency Inversion | NestJS DI container wires all dependencies; services depend on abstractions, not concretions |

---

## 7. Full Feature List

### Phase 1 — MVP (Must-Have)

| # | Feature | Description |
|---|---|---|
| 1 | **WhatsApp Account Linking** | QR code scan to connect customer's own WhatsApp number; session persisted |
| 2 | **Contact Management** | CSV/Excel import, manual add, phone number validation, deduplication |
| 3 | **Contact Groups & Segments** | Tag-based grouping, filter by custom fields (up to 20 fields per contact) |
| 4 | **Message Templates** | Create/save templates with personalization variables (`{{name}}`, `{{phone}}`, custom fields) |
| 5 | **Bulk Message Sender** | Send text messages to all contacts or selected groups at once |
| 6 | **Media Message Support** | Send images, PDFs, videos, audio files in campaigns |
| 7 | **Smart Rate Limiter** | Auto-delay between sends (3–8 sec configurable), daily message cap per account (default 200) |
| 8 | **Campaign Manager** | Create/name campaigns, track status: Pending / Sending / Completed / Failed |
| 9 | **Campaign Scheduler** | Pick a future date/time; campaign auto-starts via Bull delayed jobs |
| 10 | **Basic Analytics Dashboard** | Sent / Delivered / Failed counts per campaign; real-time status |
| 11 | **Message History Log** | Per-contact full conversation history (incoming + outgoing) |
| 12 | **Auto-Reply / Chatbot** | Keyword-triggered auto-responses; "STOP" keyword auto-unsubscribes contact |
| 13 | **Opt-Out / Unsubscribe Engine** | Auto-detect unsubscribe keywords, remove from all future sends, audit log |
| 14 | **AI Message Generator** | Generate marketing copy using OpenAI `gpt-4o-mini` or local Ollama (free) |

### Phase 2 — Growth (Important)

| # | Feature | Description |
|---|---|---|
| 15 | **Drip Campaigns / Sequences** | Automated follow-up sequences with time delays (Day 1 → Day 3 → Day 7) |
| 16 | **Campaign Analytics** | Read rate (read receipts), delivery rate, response rate, failure breakdown; visual charts |
| 17 | **Multi-Account Support** | Connect and manage multiple WhatsApp numbers per user |
| 18 | **A/B Message Testing** | Send 2 variants to split audience, compare delivery and response rates |
| 19 | **Google Sheets Integration** | Sync contacts directly from a Google Spreadsheet |
| 20 | **Webhook Support** | Notify external systems on message sent/delivered/received events |
| 21 | **User Roles & Permissions** | Admin / Agent / Viewer access control with NestJS RolesGuard |

### Phase 3 — Premium Differentiators

| # | Feature | Description |
|---|---|---|
| 22 | **Smart Sending Window** | Auto-send only during defined business hours per user timezone |
| 23 | **Birthday/Anniversary Automation** | Auto-trigger campaign on contact's custom date field |
| 24 | **Interactive Messages** | Buttons, list messages, quick-reply options (Baileys native support) |
| 25 | **Mini Catalog / Storefront** | Auto-generated product catalog page with Click-to-WhatsApp button |
| 26 | **CRM Integration** | Zapier, HubSpot webhooks, custom REST API |
| 27 | **Advanced Blacklist Engine** | Per-domain/number blocking; never re-message opted-out contacts |
| 28 | **Exportable Reports** | PDF / CSV campaign performance reports; scheduled email delivery |
| 29 | **REST API Access** | Allow customers to trigger messages via API key authentication |
| 30 | **Multi-Language UI** | English + regional language support for the dashboard |
| 31 | **Subscription / Plan Management** | Free/paid tiers (limit contacts, accounts, messages per plan) |

---

## 8. Development Phases & Roadmap

### Phase 1 — Foundation & Core MVP (Weeks 1–4)

**Goal:** Users can register, link WhatsApp, import contacts, and send bulk messages with media.

| Task | Description |
|---|---|
| Project scaffolding | Monorepo: `/backend` (NestJS), `/frontend` (Next.js), `/session-manager`, Docker Compose |
| Database schema | Tables: `users`, `wa_sessions`, `contacts`, `contact_groups`, `contact_tags`, `campaigns`, `campaign_messages`, `message_logs`, `templates` |
| Auth system | Registration/login, JWT tokens, bcrypt, email verification |
| Session Manager | Dynamic Baileys instance pool; QR generation; session health; TOS_BLOCK auto-pause |
| Contact Management | CSV/Excel upload, phone validation, deduplication, groups/tags |
| Message Template System | CRUD, variable substitution engine (`{{name}}`, `{{phone}}`, custom fields) |
| Bulk Sender Engine | Campaign creation → per-user Bull queue → Baileys send |
| Smart Rate Limiter | Configurable delays + daily cap enforced per session |
| Basic Dashboard | Sent/Delivered/Failed metrics per campaign |

**Exit Criteria:** Register → scan QR → import 50 CSV contacts → create template → launch campaign → see delivery counts.

---

### Phase 2 — Automation, Scheduling & Auto-Reply (Weeks 5–8)

**Goal:** Add scheduling, auto-reply, opt-out, and conversation inbox.

| Task | Description |
|---|---|
| Campaign Scheduler | Date/time picker; Bull delayed jobs; cancel/reschedule |
| Auto-Reply Engine | Keyword trigger library; incoming message listener on Baileys; STOP → opt-out |
| Opt-Out System | Per-contact opt-out flag; blacklist enforcement in queue |
| Media Message Support | Upload to MinIO; attach to templates; send via Baileys media API |
| Conversation Inbox | Per-contact view of full message history; search |

**Exit Criteria:** Schedule campaign 1 hour ahead → fires on time; "STOP" from test phone → contact opted-out; image campaign received correctly.

---

### Phase 3 — Analytics, Multi-Account & AI (Weeks 9–12)

**Goal:** Rich analytics, multiple WA accounts per user, drip campaigns, A/B testing, AI copy.

| Task | Description |
|---|---|
| Analytics Dashboard | Campaign-level delivery/read/response rates; Recharts visuals; date range filters |
| Drip Campaign Builder | UI to chain messages with time delays; branch on reply/no-reply |
| Multi-Account Management | Link N WhatsApp numbers per user; assign campaigns to specific number |
| A/B Message Testing | 50/50 contact split; compare variant performance |
| AI Message Generator | OpenAI `gpt-4o-mini` or Ollama (local, fully free); output into template editor |
| Report Export | PDF/CSV campaign analytics export |

**Exit Criteria:** Run A/B test — verify split delivery; generate AI copy for "clothing sale" — inserts into template; export PDF report with correct data.

---

### Phase 4 — SaaS Polish & Production (Weeks 13–16)

**Goal:** Multi-tenant SaaS hardening, Docker Swarm deployment, premium features.

| Task | Description |
|---|---|
| Subscription/Plan Management | Free/paid tiers; usage tracking; plan enforcement guards |
| User Roles | Admin / Agent / Viewer; RolesGuard on all endpoints |
| Interactive Messages | Buttons, list messages, quick replies via Baileys |
| Smart Sending Window | Business hours configuration per user timezone |
| REST API + Webhooks | API key auth; `/send-message`, `/create-campaign` endpoints; outbound webhooks |
| Docker Swarm Stack | `docker stack deploy`; Swarm Secrets; rolling updates; session-mgr node pinning |
| Email Notifications | Campaign completed; session disconnected; daily summary email |

---

## 9. Anti-Ban Architecture

These safeguards are **built-in by default and non-configurable below minimum thresholds**:

| Safeguard | Implementation |
|---|---|
| **Random send delay** | 3–8 seconds between every message (configurable, minimum 2s enforced) |
| **Daily message cap** | 200 messages/account/day by default (user can lower, not raise above plan limit) |
| **Typing simulation** | `sendStateTyping()` called before each message send |
| **Session persistence** | Baileys session files stored on persistent Docker volume; QR scan required only once |
| **TOS_BLOCK detection** | Auto-pause all sends + alert user if connection state becomes `TOS_BLOCK` |
| **Message variability** | Template variable substitution ensures no two messages are byte-for-byte identical |
| **Multi-account rotation** | High-volume sends spread across multiple connected numbers |
| **Opt-in enforcement** | Mandatory compliance checkbox before first campaign launch (UI-enforced) |
| **Opt-out respect** | Opted-out contacts are permanently skipped in queue — no bypass possible |

---

## 10. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| WhatsApp account ban (aggressive sends) | Medium–High | Built-in rate limits + opt-in only + typing simulation |
| WhatsApp ToS violation | Medium | User disclosure on registration, app ToS, liability limitation |
| Baileys breaks after WhatsApp protocol update | Medium | Community typically patches within days; `ISessionManager` abstraction enables quick switch to whatsapp-web.js |
| Multi-tenant session isolation breach | Low | Per-user Baileys instances + per-user Redis queues; no shared state |
| GDPR / data privacy | Low–Medium | Explicit consent logs, data deletion endpoint, no data sold/shared |
| Server compromise exposes WhatsApp sessions | Low–Medium | Sessions stored on encrypted volumes; Swarm Secrets for credentials; no plaintext secrets in code |

---

## 11. Cost Breakdown

| Item | Cost |
|---|---|
| WhatsApp API fees | **$0** — Baileys is open-source, free |
| VPS Server (e.g. DigitalOcean 4GB/2vCPU) | ~$24/month |
| PostgreSQL | Bundled on server |
| Redis | Bundled on server |
| MinIO | Bundled on server |
| Domain name | ~$10/year |
| OpenAI API (gpt-4o-mini for AI feature) | ~$0–5/month (extremely cheap; or $0 with local Ollama) |
| **Total recurring** | **~$24–30/month** |

---

## 12. Verification Plan

| # | Test | Expected Result |
|---|---|---|
| 1 | Register 2 test users, each link a different WhatsApp number | Both QR scans succeed; sessions persist after reload |
| 2 | Import 100 contacts via CSV with duplicate rows | Duplicates merged; 100 unique contacts stored |
| 3 | Create template with `{{name}}` variable, preview with contact | Name substituted correctly in preview |
| 4 | Launch bulk campaign to group of 10 | Logs show 3–8 second delay between each send |
| 5 | Send "STOP" keyword from a test phone | Contact auto-opted-out; excluded from subsequent sends |
| 6 | Schedule campaign 10 minutes in future | Campaign fires at correct time, not before |
| 7 | Upload image → launch media campaign | Image received correctly on recipient phone |
| 8 | Create drip sequence (3 messages, 1-min delays for test) | All 3 messages fire in correct order at correct times |
| 9 | Generate AI copy for "summer clothing sale" | Relevant marketing text generated; inserts into template editor |
| 10 | Export campaign analytics as CSV | CSV contains accurate sent/delivered/failed counts per contact |
| 11 | Force TOS_BLOCK state simulation | All sends paused; admin notified via dashboard alert |
| 12 | Deploy to Docker Swarm; rolling update `backend` service | Zero downtime during update |

---

## 13. Confirmed Decisions

| Decision | Choice |
|---|---|
| WhatsApp API | ❌ No paid API — Baileys (open-source, free, MIT) |
| Backend framework | NestJS with full module system and SOLID principles |
| Frontend framework | Next.js + Tailwind CSS |
| Deployment | Docker + Docker Compose + Docker Swarm |
| Deployment model | Multi-user SaaS (each user has own WhatsApp session) |
| WhatsApp library | Baileys (primary) · whatsapp-web.js (fallback via ISessionManager) |
| AI feature | Yes — OpenAI gpt-4o-mini (cheap) or Ollama (fully free, local) |
| MVP scope | All features: bulk send, CSV import, templates, scheduling, media, auto-reply, analytics |
| Anti-ban measures | Built-in and non-negotiable; minimum delays enforced at platform level |
| Session storage | Persistent Docker volumes per user; encrypted at rest |
| Secrets management | Docker Swarm Secrets (never in env vars or image layers) |
