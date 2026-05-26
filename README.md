
# 🌳 EcoWoods — The Unified Hardwood Flooring Platform

**One Platform. Zero Drift. Production-Ready Revenue Engine.**

[![CI](https://github.com/iceccarelli/ecowoods-app/actions/workflows/ci.yml/badge.svg)](https://github.com/iceccarelli/ecowoods-app/actions/workflows/ci.yml)

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://ecowoods-app.vercel.app)

[![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?logo=stripe)](https://stripe.com)

[![n8n](https://img.shields.io/badge/Orchestration-n8n-FF6B6B?logo=n8n)](https://n8n.io)

[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-000000?logo=turborepo)](https://turbo.build)

[![React Native](https://img.shields.io/badge/Mobile-React%20Native-61DAFB?logo=react)](https://reactnative.dev)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)

**Live Production**: [https://ecowoods-app.vercel.app](https://ecowoods-app.vercel.app)

---

## Executive Summary

EcoWoods is a **fully unified, production-grade platform** that combines:

- **Beautiful marketing & lead generation** (current live site)

- **Instagram-style social feed** of real customer projects

- **Amazon-style product catalogue** (hardwood, stains, tools, packages)

- **Full Stripe-powered commerce** (one-time purchases + subscriptions)

- **React Native mobile app** with identical API contracts

- **n8n-powered live nervous system** (real-time notifications, abandoned cart recovery, order updates)

**Core Principle**: Single source of truth. Every byte of data flows through shared Zod schemas. No duplication. No drift. Ever.

---

## Architecture — The Perfect Flow

```mermaid

graph TD

    subgraph "Acquisition Layer"

        Marketing[apps/web<br/>Next.js 14 Marketing Site]

        QuoteForm[Multi-step Quote Form]

    end

    subgraph "Engagement & Commerce Layer"

        Shop[apps/web<br/>Shop + Filters + Variants]

        Feed[apps/web<br/>Instagram-style Social Feed]

        Cart[apps/web + apps/mobile<br/>Persistent Cart + Stripe Checkout]

    end

    subgraph "Mobile Experience"

        RN[apps/mobile<br/>React Native Expo]

        RN_Screens[BidDetailScreen v4.0<br/>with Stripe + Calendar with react-query]

    end

    subgraph "Backend & Data Layer"

        API[packages/api-client<br/>Unified REST + Zod Contracts]

        DB[(PostgreSQL + Supabase Realtime)]

        Shared[packages/shared<br/>Zod Schemas + Types]

    end

    subgraph "Orchestration & Nervous System"

        n8n[n8n Workflows<br/>Order Created • Shipping Update<br/>New Like • Abandoned Cart]

        Notif[Email • SMS • Push • In-App]

    end

    Marketing -->|Lead| API

    Shop --> API

    Feed -->|Optimistic UI + Realtime| API

    Cart --> Stripe

    Stripe -->|Webhook| n8n

    n8n --> Notif

    RN --> API

    API --> Shared

    Shared --> DB

    DB -->|Triggers| n8n

```

---

## End-to-End Data Flow (Surgical Precision)

```mermaid

sequenceDiagram

    participant User as User (Web or Mobile)

    participant Frontend as apps/web or apps/mobile

    participant API as packages/api-client

    participant DB as PostgreSQL

    participant n8n as n8n Orchestrator

    participant Stripe as Stripe

    User->>Frontend: Browse products / Create post / Add to cart

    Frontend->>API: POST /api/products or /api/feed or /api/cart (Zod validated)

    API->>DB: Persist with shared schema

    DB->>n8n: Webhook / Trigger (order.created, post.liked, etc.)

    n8n->>Stripe: Create Checkout Session (if purchase)

    Stripe->>n8n: webhook (payment_intent.succeeded)

    n8n->>User: Email + SMS + Push + In-App notification

    n8n->>Frontend: Realtime update via Supabase Realtime

    Frontend->>User: Optimistic UI update + confirmation

```

---

## Directory Structure (Clean & Scalable)

```

ecowoods-app/

├── apps/

│   ├── web/                    # Next.js 14 Marketing + Shop + Feed + Cart

│   ├── mobile/                 # React Native (Expo) — full v4.0 screens + Stripe

│   └── admin/                  # Staff dashboard (vanilla + future React)

├── packages/

│   ├── shared/                 # Zod schemas, constants, theme tokens

│   ├── api-client/             # Unified fetch client + TanStack Query hooks

│   ├── ui/                     # Shared React + React Native components

│   ├── auth/                   # JWT / Clerk / Supabase auth helpers

│   └── utils/                  # Formatting, validation, helpers

├── backend/                    # FastAPI (ready for heavy workloads)

├── shared/                     # Legacy shared (being migrated to packages/)

├── .github/workflows/          # CI (lint, test, security, Docker, Vercel)

├── turbo.json                  # Turborepo pipeline

├── pnpm-workspace.yaml

├── vercel.json                 # Monorepo-aware deployment

└── README.md

```

---

## Tech Stack — Production Grade

| Layer              | Technology                                      | Why It’s Perfect |

|--------------------|-------------------------------------------------|------------------|

| **Web**            | Next.js 14 (App Router) + TanStack Query + Zod + Framer Motion | Blazing fast, type-safe, incredible DX |

| **Mobile**         | React Native (Expo) + react-query + Stripe SDK     | Identical API contracts as web |

| **Shared Types**   | Zod + TypeScript (packages/shared)                 | Zero runtime surprises, single source of truth |

| **Backend**        | FastAPI (Python) + SQLAlchemy + PostgreSQL         | High performance when needed |

| **Payments**       | Stripe Checkout + Webhooks                         | One-time + Subscriptions + Refunds |

| **Orchestration**  | n8n (self-hosted or cloud)                         | Visual workflows, retries, logging, webhooks |

| **Monorepo**       | Turborepo + pnpm                                   | Lightning builds, caching, parallel tasks |

| **Deployment**     | Vercel (web) + Railway/Fly.io (backend)            | Zero-config, instant previews |

| **Real-time**      | Supabase Realtime / Pusher                         | Instant feed updates, notifications |

---

## Environment Setup (Detailed)

### Prerequisites

- **Node.js** ≥ 18.18

- **pnpm** ≥ 9 (recommended) or npm

- **Python** 3.11+ (for backend)

- **Docker** & Docker Compose (recommended for full stack)

- **Git**

### 1. Clone & Install

```bash

git clone https://github.com/iceccarelli/ecowoods-app.git

cd ecowoods-app

pnpm install

```

### 2. Environment Variables

Create the following `.env` files:

#### Root `.env` (shared secrets)

```env

# Database

DATABASE_URL="postgresql://user:password@localhost:5432/ecowoods"

# Supabase (recommended for Realtime)

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url

NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Stripe

STRIPE_SECRET_KEY=sk_test_...

STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# n8n

N8N_WEBHOOK_URL=http://localhost:5678/webhook/...

N8N_API_KEY=your_n8n_api_key

```

#### `apps/web/.env.local`

```env

NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api

NEXT_PUBLIC_APP_URL=http://localhost:3000

```

#### `apps/mobile/.env`

```env

EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api

EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

```

#### `backend/.env`

```env

DATABASE_URL=postgresql://...

STRIPE_SECRET_KEY=sk_test_...

JWT_SECRET=super_secret_jwt_key

```

### 3. Local Development

```bash

# Start everything

turbo dev

# Or start specific apps

turbo dev --filter=web

turbo dev --filter=mobile

```

### 4. Full Stack with Docker + n8n (Recommended)

```bash

docker compose up -d

# n8n will be available at http://localhost:5678

```

### 5. Codespace Specific (You are here)

Everything is pre-configured. Just run:

```bash

pnpm install

turbo dev

```

### 6. Stripe Test Mode

Use these test cards:

- `4242 4242 4242 4242` → Successful payment

- `4000 0000 0000 0002` → Card declined

### 7. n8n Setup

1. Open http://localhost:5678

2. Create workflows from the `n8n/` folder in the repo

3. Set webhook URLs in your `.env` files

---

## Quick Start (Developer Experience)

### 1. Codespace (Recommended)

```bash

# You are already here

pnpm install

turbo dev

```

### 2. Local Development

```bash

git clone https://github.com/iceccarelli/ecowoods-app.git

cd ecowoods-app

pnpm install

turbo dev

```

### 3. Full Stack (Docker + n8n)

```bash

docker compose up -d

# n8n available at http://localhost:5678

```

---

## Development Workflow (Zero Drift Forever)

1. **Always work on `main`** (protected branch)

2. Create feature branch from `main`

3. Use **shared Zod schemas** from `packages/shared/schemas`

4. All API calls go through `packages/api-client`

5. Run `turbo lint && turbo typecheck` before commit

6. Pre-commit hook blocks any push that breaks types or lint

7. Every PR must pass full CI + Vercel preview

---

## Current Status & Roadmap

**✅ Completed**

- Clean Turborepo monorepo structure

- Unified `packages/shared` Zod contracts

- Stripe integration in `BidDetailScreen` v4.0

- react-query + UI upgrades in CalendarScreen & BidsScreen

- Vercel monorepo deployment configured

- Shared API client layer

**🚀 Next (In Progress)**

- Full `/shop` page with filters, variants, stock

- Instagram-style `/feed` with infinite scroll + optimistic likes

- Persistent cart + Stripe Checkout flow

- n8n workflows (Order confirmation, Abandoned cart, New like notification)

- React Native push notifications via n8n + Expo

---

## n8n Workflows (The Live Nerve)

| Workflow                  | Trigger                    | Actions |

|---------------------------|----------------------------|-------|

| Order Created             | Stripe webhook             | Confirmation email + SMS + Push + Admin alert |

| Shipping Status Changed   | Carrier webhook / Manual   | Real-time status update + notification |

| New Like / Comment        | Feed API                   | Notify post author + followers |

| Abandoned Cart            | Cron + DB query            | Reminder email after 24h + 48h |

All workflows are versioned in the repo under `n8n/` (exported JSON).

---

## Contributing & Maintenance

- **Pre-commit hook** (Husky + lint-staged) enforces formatting, types, and lint

- **CI** runs on every push: lint, typecheck, tests, security scan, Docker build

- **Vercel Preview** on every PR

- Weekly: `turbo build` + load test on critical flows

---

## The Promise

This platform will feel like **Instagram** (social proof), transact like **Amazon** (frictionless checkout), and operate with the **live nerve of n8n** (instant feedback).

Every component shares the same types. Every action triggers the same workflows. Every deployment is identical.

**One codebase. One truth. Infinite scale.**

---

**Built with obsession for consistency, performance, and developer joy.**

*Last updated: May 26, 2026 — Monorepo v2 + Stripe merged + Full Environment Setup*

