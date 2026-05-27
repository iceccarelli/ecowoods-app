<div align="center">

# 🌳 EcoWoods

### **The Unified Commerce, Social & Operations Platform for Hardwood Flooring**

*One codebase. One source of truth. Web + Mobile + Admin + Backend in perfect sync.*

[![CI](https://github.com/iceccarelli/ecowoods-app/actions/workflows/ci.yml/badge.svg)](https://github.com/iceccarelli/ecowoods-app/actions/workflows/ci.yml)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?logo=vercel)](https://ecowoods-app.vercel.app)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-F69220?logo=pnpm)](https://pnpm.io)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?logo=turborepo)](https://turborepo.com)
[![Next.js](https://img.shields.io/badge/Web-Next.js%2015-000000?logo=next.js)](https://nextjs.org)
[![Expo](https://img.shields.io/badge/Mobile-Expo%20SDK%2051-000020?logo=expo)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Zod](https://img.shields.io/badge/Validation-Zod-3068B7)](https://zod.dev)
[![Drizzle](https://img.shields.io/badge/ORM-Drizzle-C5F74F?logo=drizzle)](https://orm.drizzle.team)
[![Supabase](https://img.shields.io/badge/DB-Supabase%20Postgres-3FCF8E?logo=supabase)](https://supabase.com)
[![Stripe](https://img.shields.io/badge/Payments-Stripe-635BFF?logo=stripe)](https://stripe.com)
[![Auth.js](https://img.shields.io/badge/Auth-Auth.js%20v5-EB5424)](https://authjs.dev)
[![Resend](https://img.shields.io/badge/Email-Resend-000000)](https://resend.com)
[![Sentry](https://img.shields.io/badge/Errors-Sentry-362D59?logo=sentry)](https://sentry.io)
[![PostHog](https://img.shields.io/badge/Analytics-PostHog-1D4AFF?logo=posthog)](https://posthog.com)
[![FastAPI](https://img.shields.io/badge/Heavy%20workloads-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org)
[![Docker](https://img.shields.io/badge/Containers-Docker-2496ED?logo=docker)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live Production →** [ecowoods-app.vercel.app](https://ecowoods-app.vercel.app)

</div>

---

## 📑 Table of Contents

1. [Vision & Promise](#-vision--promise)
2. [Architecture at a Glance](#-architecture-at-a-glance)
3. [The Five-Phase Build Plan](#-the-five-phase-build-plan)
4. [Current Status — Honest Reality Check](#-current-status--honest-reality-check)
5. [Definitive Tech Stack](#-definitive-tech-stack)
6. [Repository Structure](#-repository-structure)
7. [End-to-End Data & Event Flow](#-end-to-end-data--event-flow)
8. [Authentication Flow (Web + Mobile)](#-authentication-flow-web--mobile)
9. [Payments Flow (Stripe)](#-payments-flow-stripe)
10. [The Event Catalog](#-the-event-catalog)
11. [Database Schema (Logical View)](#-database-schema-logical-view)
12. [Local Development Setup](#-local-development-setup)
13. [Environment Variables Reference](#-environment-variables-reference)
14. [Deployment](#-deployment)
15. [Developer Workflow & Conventions](#-developer-workflow--conventions)
16. [Quality Gates & CI/CD](#-quality-gates--cicd)
17. [Observability & Operations](#-observability--operations)
18. [Security Posture](#-security-posture)
19. [Roadmap & Open Decisions](#-roadmap--open-decisions)
20. [Contributing](#-contributing)
21. [License](#-license)

---

## 🎯 Vision & Promise

EcoWoods is **not three apps stitched together**. It is one product surface delivered through three clients:

| Client | What it is | Built with |
|---|---|---|
| **Web** | Marketing, catalog, social feed, checkout, account, admin | Next.js 15 (App Router) on Vercel |
| **Mobile** | Identical commerce + social on iOS/Android, native payments, push | Expo + React Native + expo-router |
| **Admin** | Staff dashboard for orders, products, feed moderation, refunds | Next.js 15 (separate app, same monorepo) |

All three clients consume the **same Zod schemas, the same API endpoints, the same database, the same event bus**. A product edit in Admin appears in the Web shop and Mobile app within milliseconds. An order placed on Mobile triggers the same email, push notification, and analytics events as one placed on Web.

### The four non-negotiables

> 1. **Single source of truth** — every type lives in `packages/shared` exactly once.
> 2. **Server authority** — the database is the truth; clients reconcile against it.
> 3. **Append-only event contracts** — `order.created` never gets renamed; if its shape must change, `order.created.v2` is born alongside it.
> 4. **Ship in phases** — every phase deploys to production. No big-bang releases.

---

## 🏛 Architecture at a Glance

```mermaid
graph TB
    subgraph Clients["🖥 Clients"]
        Web["apps/web<br/>Next.js 15"]
        Mobile["apps/mobile<br/>Expo + RN"]
        Admin["apps/admin<br/>Next.js 15"]
    end

    subgraph Shared["📦 Shared Packages (the backbone)"]
        SharedPkg["@ecowoods/shared<br/>Zod schemas, events, constants"]
        UI["@ecowoods/ui<br/>Cross-platform components"]
        ApiClient["@ecowoods/api-client<br/>Fetch + TanStack Query hooks"]
        Auth["@ecowoods/auth<br/>Auth.js v5 wrapper"]
        Payments["@ecowoods/payments<br/>Stripe SDK + webhooks"]
        DB["@ecowoods/db<br/>Drizzle ORM + repositories"]
        Notif["@ecowoods/notifications<br/>Email • Push • SMS"]
        Obs["@ecowoods/observability<br/>Logger • Sentry"]
    end

    subgraph Edge["🌐 Edge & Server"]
        NextAPI["Next.js API Routes<br/>/api/*"]
        Middleware["Edge Middleware<br/>auth gate • rate limit"]
    end

    subgraph Data["🗄 Data & Heavy Workloads"]
        Postgres[("Supabase Postgres<br/>+ Realtime + Storage")]
        FastAPI["backend/<br/>FastAPI: search, recs, AI"]
        N8N["n8n<br/>Workflows-as-code"]
    end

    subgraph External["🔌 Third-Party"]
        Stripe["Stripe<br/>Checkout + PaymentSheet"]
        Resend["Resend<br/>Transactional email"]
        Expo["Expo Push<br/>FCM + APNs"]
        Sentry["Sentry"]
        PostHog["PostHog"]
    end

    Web --> ApiClient
    Mobile --> ApiClient
    Admin --> ApiClient
    ApiClient --> NextAPI
    NextAPI --> Middleware
    NextAPI --> DB
    DB --> Postgres
    NextAPI --> Auth
    NextAPI --> Payments
    Payments --> Stripe
    NextAPI --> Notif
    Notif --> Resend
    Notif --> Expo
    Postgres -->|Triggers + Realtime| N8N
    N8N --> Notif
    Stripe -->|Webhooks| NextAPI
    FastAPI --> Postgres
    Web -.->|Search, recs| FastAPI
    Mobile -.->|Search, recs| FastAPI
    Web --> Obs
    Mobile --> Obs
    Admin --> Obs
    NextAPI --> Obs
    Obs --> Sentry
    Obs --> PostHog
    Web --> UI
    Mobile --> UI
    Admin --> UI
    UI --> SharedPkg
    ApiClient --> SharedPkg
    DB --> SharedPkg
```

**Key principle:** Every arrow in this diagram is a typed contract. Clients never speak directly to Stripe, the database, or third-party APIs — they speak to `@ecowoods/api-client`, which speaks to Next.js API routes, which speak to the typed packages. This is what makes drift impossible.

---

## 🗺 The Five-Phase Build Plan

The path from "monorepo builds on Vercel" to "Instagram-grade product." Each phase ships independently to production.

```mermaid
flowchart LR
    P0([Phase 0<br/>✅ DONE]) --> P1([Phase 1<br/>Commerce Core])
    P1 --> P2([Phase 2<br/>Mobile + Email])
    P2 --> P3([Phase 3<br/>Social Layer])
    P3 --> P4([Phase 4<br/>Admin + Observability])
    P4 --> P5([Phase 5<br/>Heavy Workloads + n8n])

    style P0 fill:#10b981,stroke:#059669,color:#fff
    style P1 fill:#3b82f6,stroke:#1d4ed8,color:#fff
    style P2 fill:#8b5cf6,stroke:#6d28d9,color:#fff
    style P3 fill:#ec4899,stroke:#be185d,color:#fff
    style P4 fill:#f59e0b,stroke:#b45309,color:#fff
    style P5 fill:#64748b,stroke:#334155,color:#fff
```

### Phase 0 — Foundation ✅ DONE
- Turborepo + pnpm workspaces resolve cleanly on Vercel
- `@ecowoods/ui` package builds with `tsup` and is consumed by `apps/web`
- `.vercelignore` no longer excludes `packages/`
- `vercel.json` points `outputDirectory` to `apps/web/.next`

### Phase 1 — Commerce Core (Week 1)
**Goal:** A logged-in user can browse → cart → pay → receive an order email.
**Packages built:** `shared`, `db`, `auth`, `payments`, `notifications` (email only), `ui` (expanded).
**Apps built:** `apps/web` only.

### Phase 2 — Mobile Parity (Weeks 2–3)
**Goal:** Identical experience on iOS/Android with native Stripe PaymentSheet.
**New packages:** `api-client` (now justified — 2 consumers).
**New apps:** `apps/mobile`.

### Phase 3 — Social Layer (Weeks 4–6)
**Goal:** Instagram-style feed, optimistic UI, real-time fan-out.
**New schemas:** `post`, `comment`, `like`, `notification`.
**New package surfaces:** `shared/events/`, `notifications/push`, `notifications/in-app`.

### Phase 4 — Admin + Observability (Weeks 7–8)
**Goal:** Operational maturity. Non-engineers can run the business.
**New apps:** `apps/admin` (Next.js, replacing vanilla HTML).
**New packages:** `observability`, `analytics`, `auth/permissions`.

### Phase 5 — Heavy Workloads + Orchestration (Week 9+)
**Goal:** Vector search, recommendations, automated workflows.
**New apps:** `backend/` (FastAPI), `n8n/` workflows-as-code.
**New packages:** `feature-flags`, `infrastructure/` IaC.

> **Why this order?** Each phase delivers user-visible value. A user-facing product without auth + payments is useless; a social feed without users is empty; an admin without data is pointless; n8n without workflows is wasted. Stack the dominoes correctly.

---

## 📊 Current Status — Honest Reality Check

| Layer | Status | Notes |
|---|:---:|---|
| Turborepo + pnpm workspace builds on Vercel | ✅ | Fixed via `.vercelignore` + `outputDirectory` |
| `@ecowoods/ui` package resolves cross-platform | ✅ | Built with `tsup`, consumed by web |
| `packages/shared` Zod schemas | 🟡 | Skeleton exists; needs audit & completion |
| `packages/api-client` | 🟡 | Skeleton; will become essential in Phase 2 |
| Auth.js v5 + Google/GitHub login | ❌ | Phase 1 deliverable |
| Drizzle + Supabase Postgres | ❌ | Phase 1 deliverable |
| Stripe Embedded Checkout | ❌ | Phase 1 deliverable |
| Transactional email (Resend + React Email) | ❌ | Phase 1 deliverable |
| Expo mobile app builds | ❌ | Phase 2 deliverable |
| Stripe PaymentSheet on mobile | ❌ | Phase 2 deliverable |
| Social feed with Supabase Realtime | ❌ | Phase 3 deliverable |
| Admin dashboard (Next.js) | ❌ | Phase 4 deliverable |
| Sentry + PostHog + structured logs | ❌ | Phase 4 deliverable |
| n8n workflows | ❌ | Phase 5 deliverable |
| FastAPI for vector search / recs | ❌ | Phase 5 deliverable |

**Honest progress: ~10% of destination.** The hardest 10% (monorepo + workspace resolution + deploy pipeline). The remaining 90% is well-known patterns executed in sequence.

---

## 🧱 Definitive Tech Stack

These choices are **final** unless a critical limitation forces a change. Avoid bikeshedding.

| Concern | Chosen Tech | Why this, not the alternatives |
|---|---|---|
| **Monorepo** | Turborepo + pnpm workspaces | Best caching, smallest disk footprint, Vercel-native |
| **Language** | TypeScript 5.5 (strict) | Type-safe end-to-end; same language client→server |
| **Web framework** | Next.js 15 App Router | RSC for fast pages, edge middleware, API routes |
| **Mobile framework** | Expo SDK 51 + expo-router | File-based routing matching Next.js mental model |
| **Validation** | Zod | Schemas double as TypeScript types AND runtime guards |
| **Database** | Supabase Postgres | Managed Postgres + Realtime + Storage + Auth user table in one |
| **ORM** | Drizzle ORM | TypeScript-first, no codegen, SQL-shaped, edge-compatible |
| **Auth** | Auth.js v5 (NextAuth) + Drizzle adapter | Owns user data, supports Google/GitHub/Microsoft/Apple/Email/Passkeys; Expo bridge via `expo-auth-session` |
| **Payments** | Stripe (Embedded Checkout web, PaymentSheet mobile) | PCI handled by Stripe; one webhook handles all surfaces |
| **Email** | Resend + React Email | React components for templates; clean DX, deliverability |
| **Push notifications** | Expo Push (FCM + APNs) | One API, free, abstracts both stores |
| **SMS** | Twilio (added in Phase 5 if needed) | Industry standard, easy fallback |
| **Real-time** | Supabase Realtime | Already paid for via Supabase, Postgres-native |
| **File storage** | Supabase Storage → R2/S3 at scale | Bundled with DB; migrate when egress costs justify |
| **State (server)** | TanStack Query v5 | The right tool. Use everywhere. |
| **State (client)** | Zustand (only when truly needed) | No Redux, no Recoil, no Context-juggling |
| **Forms** | react-hook-form + `@hookform/resolvers/zod` | Same Zod schema validates client + server + DB |
| **Styling (web)** | Tailwind CSS 3 + shadcn/ui | Industry baseline; copy-paste components you own |
| **Styling (mobile)** | NativeWind | Same Tailwind class names work in React Native |
| **Cross-platform components** | `.web.tsx` + `.native.tsx` file splitting | Bundlers resolve automatically; cleanest abstraction |
| **Animation** | Framer Motion (web) + Reanimated 3 (mobile) | Best-in-class on each platform |
| **Observability** | Sentry (errors) + PostHog (product) + Vercel Analytics (web vitals) | Three concerns, three best-in-class tools |
| **Logging** | pino (structured JSON) | Fast, ecosystem-standard |
| **Heavy workloads** | FastAPI + SQLAlchemy 2 + pgvector | Python for ML/search/AI; only added when needed |
| **Orchestration** | n8n (self-hosted via Docker) | Workflows-as-code, version-controlled JSON |
| **CI/CD** | GitHub Actions + Vercel + EAS Build | Test on push, deploy on merge |
| **Containers** | Docker + Docker Compose | Local FastAPI + n8n + Postgres reproducibility |
| **Code quality** | ESLint + Prettier + Husky + lint-staged + commitlint | Pre-commit gates; conventional commits |
| **Testing** | Vitest (unit) + Playwright (e2e web) + Detox (e2e mobile) + pytest (backend) | Right tool per surface |
| **Versioning** | Changesets | Disciplined releases for internal packages |

---

## 📁 Repository Structure

This is the **destination** structure. Build it phase by phase — don't scaffold empty packages.

```
ecowoods-app/
├── apps/
│   ├── web/                                  # Next.js 15 — marketing + shop + feed + cart + account
│   │   ├── app/
│   │   │   ├── (marketing)/                  # landing, about, contact — public routes
│   │   │   │   ├── page.tsx
│   │   │   │   ├── about/page.tsx
│   │   │   │   └── contact/page.tsx
│   │   │   ├── (shop)/
│   │   │   │   ├── shop/page.tsx             # product grid + filters
│   │   │   │   ├── shop/[slug]/page.tsx      # PDP (product detail page)
│   │   │   │   ├── cart/page.tsx
│   │   │   │   └── checkout/page.tsx         # Stripe Embedded Checkout
│   │   │   ├── (social)/                     # Phase 3
│   │   │   │   ├── feed/page.tsx             # Instagram-style infinite scroll
│   │   │   │   ├── post/[id]/page.tsx
│   │   │   │   └── profile/[handle]/page.tsx
│   │   │   ├── (account)/
│   │   │   │   ├── account/page.tsx
│   │   │   │   ├── orders/page.tsx
│   │   │   │   ├── orders/[id]/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   ├── api/
│   │   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   │   ├── stripe/
│   │   │   │   │   ├── checkout/route.ts     # create checkout session
│   │   │   │   │   ├── webhook/route.ts      # Stripe → us (signature-verified)
│   │   │   │   │   └── portal/route.ts       # customer portal
│   │   │   │   ├── products/route.ts
│   │   │   │   ├── cart/route.ts
│   │   │   │   ├── orders/route.ts
│   │   │   │   ├── feed/route.ts             # Phase 3
│   │   │   │   └── og/route.tsx              # dynamic OG images
│   │   │   ├── layout.tsx
│   │   │   └── global-error.tsx
│   │   ├── components/                       # web-only components
│   │   ├── lib/                              # web-only utilities, hooks
│   │   ├── middleware.ts                     # auth gating, rate limiting
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── mobile/                               # React Native (Expo) — Phase 2
│   │   ├── app/                              # expo-router file-based routes
│   │   │   ├── (tabs)/
│   │   │   │   ├── feed.tsx                  # Phase 3
│   │   │   │   ├── shop.tsx
│   │   │   │   ├── cart.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── product/[slug].tsx
│   │   │   ├── checkout.tsx                  # @stripe/stripe-react-native PaymentSheet
│   │   │   ├── orders/[id].tsx
│   │   │   └── _layout.tsx
│   │   ├── components/                       # mobile-only (RN primitives)
│   │   ├── lib/
│   │   ├── app.config.ts                     # Expo config
│   │   ├── eas.json                          # EAS Build config
│   │   └── package.json
│   │
│   └── admin/                                # Next.js admin dashboard — Phase 4
│       ├── app/
│       │   ├── (dashboard)/
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── orders/page.tsx
│       │   │   ├── orders/[id]/page.tsx
│       │   │   ├── products/page.tsx         # CRUD with image upload
│       │   │   ├── products/new/page.tsx
│       │   │   ├── feed/page.tsx             # moderation
│       │   │   ├── customers/page.tsx
│       │   │   └── analytics/page.tsx
│       │   └── layout.tsx                    # role check: admin/staff only
│       └── package.json
│
├── packages/
│   ├── shared/                               # ⭐ THE BACKBONE — used by every app
│   │   ├── src/
│   │   │   ├── schemas/                      # Zod = THE single source of truth
│   │   │   │   ├── user.ts
│   │   │   │   ├── product.ts                # SKU, variants, price, stock
│   │   │   │   ├── cart.ts
│   │   │   │   ├── order.ts                  # line items, status enum, payments
│   │   │   │   ├── address.ts
│   │   │   │   ├── payment.ts
│   │   │   │   ├── post.ts                   # Phase 3
│   │   │   │   ├── comment.ts                # Phase 3
│   │   │   │   ├── like.ts                   # Phase 3
│   │   │   │   ├── notification.ts           # Phase 3
│   │   │   │   ├── webhook.ts                # Stripe & n8n payload shapes
│   │   │   │   └── index.ts
│   │   │   ├── events/                       # event-driven contracts — Phase 3+
│   │   │   │   ├── event-names.ts            # const: 'order.created' | 'post.liked' | ...
│   │   │   │   ├── event-payloads.ts         # Zod schema per event
│   │   │   │   └── index.ts
│   │   │   ├── constants/
│   │   │   │   ├── routes.ts                 # canonical URLs (web + deep-link)
│   │   │   │   ├── theme-tokens.ts           # colors, spacing, radii — shared web/RN
│   │   │   │   ├── stripe.ts                 # product/price IDs, tax codes
│   │   │   │   └── feature-flags.ts          # Phase 5
│   │   │   ├── utils/
│   │   │   │   ├── format-currency.ts
│   │   │   │   ├── format-date.ts
│   │   │   │   └── slugify.ts
│   │   │   └── types/                        # derived types (z.infer<typeof X>)
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   └── package.json
│   │
│   ├── ui/                                   # ✅ cross-platform components
│   │   ├── src/
│   │   │   ├── Button.web.tsx
│   │   │   ├── Button.native.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── FeedPost.tsx                  # Phase 3
│   │   │   ├── PriceTag.tsx
│   │   │   └── index.ts
│   │   ├── tsup.config.ts
│   │   └── package.json
│   │
│   ├── db/                                   # Drizzle + Supabase — Phase 1
│   │   ├── src/
│   │   │   ├── client.ts                     # drizzle({ schema, connection })
│   │   │   ├── schema/                       # one file per entity
│   │   │   │   ├── users.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── addresses.ts
│   │   │   │   └── index.ts
│   │   │   ├── repositories/                 # query functions per entity
│   │   │   │   ├── product.repo.ts
│   │   │   │   ├── order.repo.ts
│   │   │   │   ├── user.repo.ts
│   │   │   │   └── feed.repo.ts              # Phase 3
│   │   │   ├── migrations/                   # drizzle-kit generated
│   │   │   ├── seed.ts
│   │   │   └── index.ts
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── auth/                                 # Auth.js v5 — Phase 1
│   │   ├── src/
│   │   │   ├── config.ts                     # providers: Google, GitHub, Microsoft, Apple, Email
│   │   │   ├── server.ts                     # auth() for Server Components / API routes
│   │   │   ├── client.ts                     # signIn/signOut for client components
│   │   │   ├── middleware.ts                 # session check for Edge middleware
│   │   │   ├── permissions.ts                # canModerate, canRefund, canEditProduct
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── payments/                             # All Stripe logic — Phase 1
│   │   ├── src/
│   │   │   ├── client.ts                     # stripe SDK init (server-only)
│   │   │   ├── checkout.ts                   # createCheckoutSession()
│   │   │   ├── webhooks.ts                   # handleStripeEvent(event) — typed
│   │   │   ├── customer.ts                   # createCustomer, getPaymentMethods
│   │   │   ├── subscriptions.ts              # Phase 5
│   │   │   ├── refunds.ts                    # Phase 4 (admin)
│   │   │   └── types.ts                      # z.infer of webhook payloads
│   │   └── package.json
│   │
│   ├── notifications/                        # Email + Push + SMS — phased
│   │   ├── src/
│   │   │   ├── email/                        # Phase 1
│   │   │   │   ├── client.ts                 # Resend SDK
│   │   │   │   ├── templates/                # React Email components
│   │   │   │   │   ├── order-confirmation.tsx
│   │   │   │   │   ├── shipping-update.tsx
│   │   │   │   │   ├── abandoned-cart.tsx
│   │   │   │   │   ├── welcome.tsx
│   │   │   │   │   ├── magic-link.tsx
│   │   │   │   │   └── password-reset.tsx
│   │   │   │   └── send.ts                   # typed send() per template
│   │   │   ├── push/                         # Phase 2
│   │   │   │   ├── client.ts                 # Expo Push API
│   │   │   │   └── send.ts
│   │   │   ├── sms/                          # Phase 5
│   │   │   │   └── send.ts                   # Twilio
│   │   │   └── in-app/                       # Phase 3
│   │   │       └── publish.ts                # Supabase Realtime channel
│   │   └── package.json
│   │
│   ├── api-client/                           # Phase 2 (when mobile arrives)
│   │   ├── src/
│   │   │   ├── client.ts                     # fetch wrapper with auth header injection
│   │   │   ├── endpoints/                    # one file per resource
│   │   │   │   ├── products.ts
│   │   │   │   ├── cart.ts
│   │   │   │   ├── orders.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── feed.ts                   # Phase 3
│   │   │   │   └── stripe.ts
│   │   │   ├── hooks/                        # TanStack Query: useProducts, useCart, ...
│   │   │   ├── mutations/                    # optimistic update logic
│   │   │   ├── query-keys.ts                 # centralized key factory
│   │   │   └── error.ts                      # typed APIError class
│   │   └── package.json
│   │
│   ├── observability/                        # Phase 4
│   │   ├── src/
│   │   │   ├── logger.ts                     # pino — structured JSON logs
│   │   │   ├── sentry.ts                     # @sentry/nextjs + @sentry/react-native
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── analytics/                            # Phase 4
│   │   ├── src/
│   │   │   ├── client.ts                     # PostHog (web + RN)
│   │   │   ├── events.ts                     # typed event catalog
│   │   │   └── identify.ts
│   │   └── package.json
│   │
│   ├── feature-flags/                        # Phase 5
│   │   └── src/index.ts                      # PostHog flags or env-driven
│   │
│   ├── config/                               # Phase 4+
│   │   ├── eslint-config/
│   │   ├── tsconfig/                         # base.json, nextjs.json, react-native.json
│   │   └── prettier-config/
│   │
│   └── testing/                              # Phase 4+
│       ├── fixtures/                         # mock products, users, orders
│       ├── msw-handlers/                     # mock service worker for API tests
│       └── playwright-helpers/
│
├── backend/                                  # FastAPI — Phase 5 only when needed
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── search.py                     # vector search (pgvector)
│   │   │   ├── recommendations.py            # "you might also like"
│   │   │   └── webhooks.py
│   │   ├── services/
│   │   ├── models/                           # SQLAlchemy 2
│   │   ├── schemas/                          # Pydantic mirrors of shared/schemas
│   │   └── events/                           # event publisher → Redis/n8n
│   ├── tests/                                # pytest
│   ├── alembic/                              # migrations
│   ├── pyproject.toml
│   └── Dockerfile
│
├── n8n/                                      # Workflows-as-code — Phase 5
│   ├── workflows/
│   │   ├── order-created.json
│   │   ├── shipping-update.json
│   │   ├── abandoned-cart-24h.json
│   │   ├── abandoned-cart-48h.json
│   │   ├── new-like-notification.json        # Phase 3+
│   │   ├── new-comment-notification.json
│   │   ├── new-follower.json
│   │   ├── stripe-payment-succeeded.json
│   │   ├── stripe-subscription-renewed.json
│   │   ├── stripe-refund-issued.json
│   │   ├── review-request-7d-post-delivery.json
│   │   └── low-stock-alert.json
│   └── README.md                             # import + version instructions
│
├── infrastructure/                           # IaC — Phase 5
│   ├── docker/
│   │   ├── web.Dockerfile
│   │   ├── backend.Dockerfile
│   │   └── n8n.Dockerfile
│   ├── terraform/                            # Supabase, Cloudflare, Vercel project provisioning
│   └── github-actions/                       # reusable workflow components
│
├── docs/                                     # Living architecture docs
│   ├── architecture.md
│   ├── data-flow.md
│   ├── event-catalog.md                      # every event name + when fired + who listens
│   ├── api-contracts.md
│   ├── deployment.md
│   ├── runbook.md                            # incident response
│   └── onboarding.md
│
├── scripts/                                  # One-off TS scripts (tsx)
│   ├── seed-stripe-products.ts               # sync shared/constants/stripe.ts → Stripe API
│   ├── seed-database.ts
│   └── generate-types-from-db.ts
│
├── .changeset/                               # Versioning for packages/*
├── .github/
│   └── workflows/
│       ├── ci.yml                            # lint, typecheck, test, build
│       ├── e2e.yml                           # Playwright on PR
│       ├── deploy-web.yml                    # via Vercel auto-deploy
│       ├── eas-mobile.yml                    # EAS Build on tag
│       └── security.yml                      # CodeQL, dependency review
├── .gitignore
├── .vercelignore
├── docker-compose.yml                        # local FastAPI + n8n + Postgres
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── vercel.json
└── README.md                                 # ← you are here
```

---

## 🔄 End-to-End Data & Event Flow

Every action in the system flows through this **exact** pipeline. Memorize it — once you've built one feature this way, every subsequent feature is a 1-day copy-paste.

```mermaid
sequenceDiagram
    autonumber
    participant U as User<br/>(Web or Mobile)
    participant C as @ecowoods/api-client<br/>(TanStack Query)
    participant M as Next.js Middleware<br/>(auth + rate limit)
    participant R as Next.js API Route<br/>(/api/orders)
    participant V as Zod validation<br/>(@ecowoods/shared)
    participant DB as @ecowoods/db<br/>(Drizzle)
    participant P as Postgres<br/>(Supabase)
    participant E as Event Bus<br/>(Postgres NOTIFY + n8n)
    participant N as @ecowoods/notifications
    participant A as @ecowoods/analytics
    participant O as @ecowoods/observability

    U->>C: Click "Place Order"
    C->>C: Optimistic cache update
    C->>M: POST /api/orders<br/>Authorization: Bearer ...
    M->>M: Verify session
    M->>R: Forward request
    R->>V: Validate body against OrderSchema
    V-->>R: Typed payload OR 400
    R->>DB: orderRepo.create(payload)
    DB->>P: INSERT INTO orders ...
    P-->>DB: Row with id
    DB-->>R: Order<br/>(typed)
    R->>E: emit('order.created', order)
    R->>O: log.info('order.created', { orderId })
    R->>A: track('Order Placed', { value })
    R-->>C: 201 Created + order
    C->>C: Reconcile cache with server truth
    C-->>U: Success UI

    par Side effects (parallel)
        E->>N: Send order-confirmation email
        N->>U: 📧 Email arrives
    and
        E->>N: Send push notification
        N->>U: 📱 Push arrives (mobile)
    and
        E-->>P: Supabase Realtime fan-out
        P-->>U: Live order status updates
    end
```

### The Pipeline in TypeScript

```typescript
// apps/web/app/api/orders/route.ts
import { auth } from '@ecowoods/auth/server';
import { OrderInputSchema } from '@ecowoods/shared/schemas';
import { orderRepo } from '@ecowoods/db';
import { emit } from '@ecowoods/shared/events';
import { logger } from '@ecowoods/observability';
import { track } from '@ecowoods/analytics';

export async function POST(req: Request) {
  // 1. Auth
  const session = await auth();
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  // 2. Validate (Zod schema = single source of truth)
  const body = await req.json();
  const parsed = OrderInputSchema.safeParse(body);
  if (!parsed.success) return Response.json(parsed.error, { status: 400 });

  // 3. Persist (typed repository)
  const order = await orderRepo.create({
    ...parsed.data,
    userId: session.user.id,
  });

  // 4. Emit event (typed, append-only contract)
  await emit('order.created', order);

  // 5. Log + analyze (side channels, never blocking)
  logger.info({ orderId: order.id }, 'order.created');
  void track('Order Placed', { value: order.total });

  // 6. Respond
  return Response.json(order, { status: 201 });
}
```

---

## 🔐 Authentication Flow (Web + Mobile)

Auth.js v5 owns sessions on the web. Mobile uses **`expo-auth-session`** to perform OAuth against the same Auth.js endpoints, and stores the session in `expo-secure-store`.

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant Web as apps/web (Next.js)
    participant Mob as apps/mobile (Expo)
    participant AuthJS as Auth.js v5<br/>/api/auth/[...nextauth]
    participant OAuth as Google / GitHub /<br/>Microsoft / Apple
    participant DB as Postgres<br/>(users, accounts, sessions)

    rect rgb(235, 245, 255)
    Note over U,DB: WEB FLOW
    U->>Web: Click "Sign in with Google"
    Web->>AuthJS: GET /api/auth/signin/google
    AuthJS->>OAuth: Redirect to Google consent
    OAuth-->>U: Consent screen
    U->>OAuth: Approve
    OAuth->>AuthJS: GET /api/auth/callback/google?code=...
    AuthJS->>DB: Upsert user + account
    AuthJS-->>Web: Set httpOnly session cookie
    Web-->>U: Redirect to /account
    end

    rect rgb(255, 245, 235)
    Note over U,DB: MOBILE FLOW
    U->>Mob: Tap "Sign in with Google"
    Mob->>Mob: expo-auth-session opens browser
    Mob->>AuthJS: /api/auth/signin/google?callbackUrl=ecowoods://auth
    AuthJS->>OAuth: Redirect to consent
    OAuth-->>U: Consent screen
    U->>OAuth: Approve
    OAuth->>AuthJS: Callback with code
    AuthJS->>DB: Upsert user + account
    AuthJS-->>Mob: Redirect to deep link with session token
    Mob->>Mob: Store token in expo-secure-store
    Mob-->>U: Show authenticated tabs
    end

    rect rgb(245, 255, 235)
    Note over U,DB: AUTHENTICATED REQUEST (any client)
    U->>Web: View /account/orders
    Web->>AuthJS: auth() reads session cookie
    AuthJS->>DB: Load session.user
    AuthJS-->>Web: Session object
    Web-->>U: Renders orders (RSC)
    end
```

### Providers configured

| Provider | Status | Notes |
|---|:---:|---|
| Google | Phase 1 | OAuth 2.0 |
| GitHub | Phase 1 | OAuth Apps |
| Email magic link | Phase 1 | Via Resend |
| Microsoft (Entra) | Phase 2 | Multi-tenant |
| Apple | Phase 2 | Required for iOS app review |
| Facebook | Phase 3 | Optional |
| Instagram | Phase 3 | Via Facebook OAuth |
| Passkeys (WebAuthn) | Phase 4 | Auth.js v5 supports natively |

---

## 💳 Payments Flow (Stripe)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant C as Client<br/>(Web or Mobile)
    participant API as /api/stripe/checkout
    participant SP as @ecowoods/payments
    participant Stripe as Stripe API
    participant WH as /api/stripe/webhook
    participant DB as Postgres
    participant N as @ecowoods/notifications

    U->>C: Click "Pay"
    C->>API: POST /api/stripe/checkout<br/>{ cartId }
    API->>SP: createCheckoutSession(cart, user)
    SP->>Stripe: stripe.checkout.sessions.create({...})
    Stripe-->>SP: session { id, client_secret }
    SP-->>API: session
    API-->>C: client_secret

    alt Web
        C->>C: Mount Embedded Checkout<br/>(@stripe/react-stripe-js)
        C->>Stripe: User submits card via iframe
    else Mobile
        C->>C: Initialize PaymentSheet<br/>(@stripe/stripe-react-native)
        C->>Stripe: User submits via native sheet
    end

    Stripe-->>U: Payment succeeds<br/>Stripe shows confirmation
    Stripe->>WH: POST /api/stripe/webhook<br/>type: checkout.session.completed
    WH->>WH: Verify signature with STRIPE_WEBHOOK_SECRET
    WH->>SP: handleStripeEvent(event)
    SP->>DB: orderRepo.markPaid(orderId, stripeSessionId)
    SP->>N: send('order-confirmation', { user, order })
    N->>U: 📧 Order confirmation email
    SP-->>WH: 200 OK
    WH-->>Stripe: 200 OK
```

### Key safety properties

1. **Webhook signature verification is mandatory** — never trust raw POST bodies from Stripe.
2. **Idempotency** — every webhook handler reads `event.id` and checks a `processed_stripe_events` table before mutating state.
3. **One source of truth for prices** — `packages/shared/constants/stripe.ts` holds price IDs; a script (`scripts/seed-stripe-products.ts`) syncs that file to Stripe via API.
4. **Test mode in dev, live mode in prod** — keys are environment-scoped on Vercel.

---

## 📡 The Event Catalog

Every cross-cutting effect (email, push, analytics, realtime fan-out) is triggered by a typed event from `@ecowoods/shared/events`. **Adding a side-effect never means editing the API route that emits the event.** Subscribe to the event instead.

| Event | Emitted by | Subscribed by | Phase |
|---|---|---|:---:|
| `user.created` | Auth.js signup callback | notifications (welcome email), analytics (identify) | 1 |
| `user.session.started` | Auth.js signin callback | analytics | 1 |
| `cart.item.added` | `/api/cart` POST | analytics | 1 |
| `cart.abandoned` | DB cron (24h inactivity) | notifications (email reminder) | 5 (via n8n) |
| `order.created` | `/api/orders` POST | notifications, analytics, admin alert | 1 |
| `order.paid` | Stripe webhook `checkout.session.completed` | notifications (confirmation), analytics (Order Placed) | 1 |
| `order.shipped` | Admin action | notifications (shipping update), realtime fan-out | 4 |
| `order.delivered` | Carrier webhook | notifications (review request 7d later) | 5 |
| `payment.failed` | Stripe webhook `payment_intent.payment_failed` | notifications (retry email), admin alert | 1 |
| `payment.refunded` | Stripe webhook `charge.refunded` | notifications, analytics | 4 |
| `post.created` | `/api/feed` POST | analytics, realtime fan-out to followers | 3 |
| `post.liked` | `/api/posts/[id]/like` | notifications (push to author), analytics | 3 |
| `comment.created` | `/api/posts/[id]/comments` | notifications, analytics | 3 |
| `user.followed` | `/api/users/[id]/follow` | notifications | 3 |
| `product.stock.low` | DB trigger (`stock < threshold`) | admin alert via n8n | 5 |
| `product.published` | Admin action | analytics, search reindex | 4 |

**Rule:** Event names are **append-only**. To change a payload shape, create `order.created.v2`. Old subscribers continue to work.

---

## 🗄 Database Schema (Logical View)

```mermaid
erDiagram
    USERS ||--o{ ACCOUNTS : "has OAuth"
    USERS ||--o{ SESSIONS : "has"
    USERS ||--o{ ADDRESSES : "owns"
    USERS ||--o{ ORDERS : "places"
    USERS ||--o{ CARTS : "has one active"
    USERS ||--o{ POSTS : "creates"
    USERS ||--o{ COMMENTS : "writes"
    USERS ||--o{ LIKES : "gives"
    USERS ||--o{ FOLLOWS : "follows"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : "has"
    PRODUCTS ||--o{ ORDER_ITEMS : "appears in"
    PRODUCTS ||--o{ CART_ITEMS : "appears in"
    PRODUCT_VARIANTS ||--o{ ORDER_ITEMS : "concrete SKU"
    CARTS ||--o{ CART_ITEMS : "contains"
    ORDERS ||--o{ ORDER_ITEMS : "contains"
    ORDERS ||--o{ PAYMENTS : "has"
    POSTS ||--o{ COMMENTS : "receives"
    POSTS ||--o{ LIKES : "receives"

    USERS {
        uuid id PK
        text email UK
        text name
        text image
        text role
        timestamp createdAt
    }
    PRODUCTS {
        uuid id PK
        text slug UK
        text name
        text description
        text category
        jsonb media
        timestamp publishedAt
    }
    PRODUCT_VARIANTS {
        uuid id PK
        uuid productId FK
        text sku UK
        int priceCents
        text currency
        int stock
        jsonb attributes
    }
    ORDERS {
        uuid id PK
        uuid userId FK
        text status
        int totalCents
        text currency
        text stripeSessionId
        timestamp createdAt
    }
    ORDER_ITEMS {
        uuid id PK
        uuid orderId FK
        uuid variantId FK
        int quantity
        int priceCents
    }
    PAYMENTS {
        uuid id PK
        uuid orderId FK
        text stripePaymentIntentId
        text status
        int amountCents
    }
    POSTS {
        uuid id PK
        uuid userId FK
        text caption
        jsonb media
        int likeCount
        int commentCount
        timestamp createdAt
    }
    COMMENTS {
        uuid id PK
        uuid postId FK
        uuid userId FK
        text body
        timestamp createdAt
    }
    LIKES {
        uuid id PK
        uuid postId FK
        uuid userId FK
        timestamp createdAt
    }
```

Schemas live in `packages/db/src/schema/` and are pushed via `drizzle-kit push:pg`. Each table also has a corresponding Zod schema in `packages/shared/src/schemas/` for runtime validation. **The two are kept in sync by code review discipline + integration tests.**

---

## 🛠 Local Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20.11 | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| pnpm | 9.15.x | `corepack enable && corepack prepare pnpm@9.15.0 --activate` |
| Python | 3.11+ | Only needed for Phase 5 backend |
| Docker | Latest | For Phase 5 (FastAPI + n8n locally) |
| Git | Latest | with conventional commits set up |

### 1. Clone and install

```bash
git clone https://github.com/iceccarelli/ecowoods-app.git
cd ecowoods-app
pnpm install
```

### 2. Create third-party accounts (Phase 1)

| Service | Free tier? | What to grab |
|---|:---:|---|
| [Supabase](https://supabase.com) | ✅ | Project URL, Anon key, Service role key, Database URL |
| [Stripe](https://stripe.com) | ✅ test mode | Secret key, Webhook secret, Publishable key |
| [Resend](https://resend.com) | ✅ | API key, verify your sending domain |
| [Google Cloud](https://console.cloud.google.com) | ✅ | OAuth 2.0 Client ID + Secret |
| [GitHub OAuth App](https://github.com/settings/developers) | ✅ | Client ID + Secret |

### 3. Configure environment variables

Copy `.env.example` to `.env.local` (web) and `.env` (root), then fill in:

```bash
cp .env.example .env.local
cp .env.example apps/web/.env.local
```

See [Environment Variables Reference](#-environment-variables-reference) for the full list.

### 4. Push the database schema

```bash
pnpm --filter @ecowoods/db drizzle-kit push
pnpm --filter @ecowoods/db seed   # 5 demo products
```

### 5. Sync Stripe products

```bash
pnpm tsx scripts/seed-stripe-products.ts
```

### 6. Start dev servers

```bash
# Everything (web + later: mobile + backend + n8n)
pnpm dev

# Or filtered
pnpm dev --filter=@ecowoods/web
pnpm dev --filter=@ecowoods/mobile
```

### 7. Test Stripe webhooks locally

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the printed webhook signing secret into .env.local as STRIPE_WEBHOOK_SECRET
```

### 8. Full-stack (Phase 5 only)

```bash
docker compose up -d
# - FastAPI at http://localhost:8000
# - n8n at http://localhost:5678
# - Local Postgres at localhost:5432 (if you opt out of Supabase locally)
```

---

## 🔑 Environment Variables Reference

> ⚠️ **Never commit `.env` files.** Only `.env.example` (with placeholder values) is tracked.

### Root `.env` (shared by all server-side code)

```env
# ---- Database ----
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# ---- Supabase ----
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...        # server-only, never expose

# ---- Auth.js v5 ----
AUTH_SECRET=                                    # openssl rand -base64 32
AUTH_URL=http://localhost:3000                  # in prod: https://ecowoods-app.vercel.app
AUTH_TRUST_HOST=true                            # required on Vercel
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=                            # Phase 2
MICROSOFT_CLIENT_SECRET=                        # Phase 2
APPLE_CLIENT_ID=                                # Phase 2
APPLE_CLIENT_SECRET=                            # Phase 2

# ---- Stripe ----
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ---- Resend ----
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=orders@ecowoods.app

# ---- Observability (Phase 4) ----
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# ---- n8n (Phase 5) ----
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_API_KEY=
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `apps/mobile/.env`

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_AUTH_URL=http://localhost:3000
```

### `backend/.env` (Phase 5)

```env
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_test_...
JWT_SECRET=
N8N_WEBHOOK_URL=http://n8n:5678/webhook
```

---

## 🚀 Deployment

```mermaid
flowchart LR
    subgraph Dev["Developer machine"]
        Commit["git commit"]
    end
    subgraph GH["GitHub"]
        PR["Pull Request"]
        CI["CI workflow<br/>(lint, typecheck, test, build)"]
        Main["main branch"]
    end
    subgraph Vercel["Vercel"]
        Preview["Preview deployment<br/>(per PR)"]
        Prod["Production<br/>(ecowoods-app.vercel.app)"]
    end
    subgraph EAS["Expo EAS"]
        Build["EAS Build<br/>(on git tag)"]
        TestFlight["TestFlight + Play Internal"]
    end
    subgraph Fly["Fly.io / Railway (Phase 5)"]
        BackendDeploy["FastAPI deploy"]
        N8nDeploy["n8n deploy"]
    end

    Commit --> PR
    PR --> CI
    CI -- Pass --> Preview
    PR -- Merge --> Main
    Main --> Prod
    Main -- on tag v* --> Build
    Build --> TestFlight
    Main -- on tag backend-v* --> BackendDeploy
    Main -- on tag n8n-v* --> N8nDeploy
```

### Vercel project settings (web)

| Setting | Value |
|---|---|
| Root Directory | `apps/web` (recommended) **or** repo root (current) |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` (root) **or** `cd ../.. && pnpm turbo build --filter=@ecowoods/web` |
| Output Directory | `apps/web/.next` (if Root = repo root) |
| Node.js version | 20.x |

### `.vercelignore` MUST allow `packages/`

```gitignore
# Other apps and irrelevant trees only
apps/mobile/
apps/admin/                # remove this line in Phase 4
backend/
frontend/
admin-dashboard/
scripts/
.git/
node_modules/
.turbo/
.next/
*.md
!README.md
.env*
!.env.example
```

> **Never put `packages/` in `.vercelignore`.** That was the bug that broke Phase 0 — the entire `@ecowoods/ui` workspace package was being excluded from upload to Vercel.

### Mobile (Expo EAS)

```bash
# One-time
npm install -g eas-cli
eas login
eas build:configure

# Builds
eas build --profile preview --platform ios
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## 🔁 Developer Workflow & Conventions

### Branching

```
main                            # protected, production-deployed
├── feat/short-description       # new features
├── fix/short-description        # bug fixes
├── chore/short-description      # tooling, deps
└── docs/short-description       # docs only
```

### Commit messages (Conventional Commits, enforced by commitlint)

```
feat(web): add embedded stripe checkout
fix(db): handle null variant attributes in product repo
chore(ui): bump tsup to 8.3.0
docs(readme): rewrite phase plan
refactor(payments): extract webhook handlers per event type
```

### Pre-commit hook (Husky + lint-staged)

```mermaid
flowchart LR
    A[git commit] --> B{lint-staged}
    B --> C[eslint --fix]
    B --> D[prettier --write]
    B --> E[typecheck on changed packages]
    C & D & E --> F{All pass?}
    F -- Yes --> G[Commit accepted]
    F -- No --> H[Commit rejected — fix and retry]
```

### Pull request checklist

- [ ] Conventional commit title
- [ ] Description includes **what** and **why** (link to issue/ticket)
- [ ] New types added to `packages/shared` if cross-app
- [ ] New API routes have Zod validation
- [ ] New side effects subscribe to an event (don't fork the emitter)
- [ ] Tests added or updated
- [ ] Vercel preview deployment passes
- [ ] No console.log / no commented-out code
- [ ] No `any` types (use `unknown` + narrowing)
- [ ] CHANGELOG entry via `pnpm changeset` if a package version changes

---

## ✅ Quality Gates & CI/CD

```yaml
# .github/workflows/ci.yml — conceptual
on: [push, pull_request]
jobs:
  install:
    steps: [checkout, setup-node, setup-pnpm, install --frozen-lockfile]
  lint:        { needs: install, run: pnpm turbo lint }
  typecheck:   { needs: install, run: pnpm turbo typecheck }
  test:        { needs: install, run: pnpm turbo test }
  build:       { needs: install, run: pnpm turbo build }
  e2e:         { needs: build,   run: pnpm playwright test }
  security:    { needs: install, run: pnpm audit --prod && codeql }
```

| Gate | Tool | Blocks merge? |
|---|---|:---:|
| Lint | ESLint + Prettier | ✅ |
| Typecheck | `tsc --noEmit` per package | ✅ |
| Unit tests | Vitest | ✅ |
| E2E tests | Playwright (web) | ✅ |
| Build | `turbo build` (all packages + apps) | ✅ |
| Vercel preview | Auto | ✅ |
| Dependency audit | `pnpm audit --prod` | ⚠️ Warn |
| CodeQL security scan | GitHub | ⚠️ Warn |
| Bundle size | `next/bundle-analyzer` | ⚠️ Warn |

---

## 📈 Observability & Operations

### Three pillars

| Pillar | Tool | What it answers |
|---|---|---|
| **Errors** | Sentry | "What broke and where?" |
| **Logs** | pino → Vercel Log Drains → Axiom (optional) | "What happened, in order?" |
| **Product analytics** | PostHog | "How are users behaving?" |
| **Web vitals** | Vercel Analytics | "Is the site fast?" |
| **Uptime** | BetterStack / UptimeRobot | "Is the site up?" |

### Structured logging (one example)

```typescript
// packages/observability/src/logger.ts
import pino from 'pino';
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: { level: (label) => ({ level: label }) },
  base: { app: 'ecowoods-web', env: process.env.VERCEL_ENV },
});

// Usage anywhere
logger.info({ userId, orderId }, 'order.created');
logger.error({ err, orderId }, 'order.create.failed');
```

### Incident runbook (lives in `docs/runbook.md`)

1. Page received → acknowledge in #incidents Slack
2. Identify scope via Sentry + Vercel deployments page
3. If recent deploy → `vercel rollback` to last green
4. Post-mortem within 48h; root-cause + action items in `docs/incidents/YYYY-MM-DD.md`

---

## 🔒 Security Posture

| Concern | Mitigation |
|---|---|
| Auth session theft | httpOnly + Secure + SameSite=Lax cookies; `expo-secure-store` on mobile |
| CSRF | Auth.js CSRF tokens on state-changing routes |
| Webhook spoofing | Stripe signature verification on every webhook |
| SQL injection | Drizzle prepared statements; no raw SQL with user input |
| XSS | React escaping by default; no `dangerouslySetInnerHTML` without sanitization |
| Secrets in repo | git-secrets pre-commit hook; Vercel env vars; `.env*` in `.gitignore` |
| Dependency CVEs | `pnpm audit` on CI; Renovate weekly PRs |
| Rate limiting | `@upstash/ratelimit` in Edge middleware |
| HTTPS-only | HSTS header set in `vercel.json` |
| Cookie scope | All cookies scoped to `.ecowoods.app` domain |
| OWASP Top 10 | Sentry monitoring + quarterly code review |

---

## 🛣 Roadmap & Open Decisions

### Roadmap by phase

```mermaid
gantt
    title EcoWoods Build Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Commerce core              :p1, 2026-05-28, 7d
    section Phase 2
    Mobile + email             :p2, after p1, 14d
    section Phase 3
    Social layer               :p3, after p2, 21d
    section Phase 4
    Admin + observability      :p4, after p3, 14d
    section Phase 5
    Heavy workloads + n8n      :p5, after p4, 28d
```

### Open decisions (need owner + deadline)

| Decision | Options | Owner | Deadline |
|---|---|---|---|
| Mobile component library | NativeWind + custom **vs** Tamagui everywhere | TBD | Before Phase 2 |
| Search engine | Postgres FTS → Typesense → Algolia | TBD | Before Phase 5 |
| Subscription model | One-time only **vs** subscriptions (Stripe Billing) | Product | Before Phase 5 |
| Image CDN | Vercel Image **vs** Cloudinary **vs** Cloudflare Images | TBD | Before Phase 3 |
| Region | Vercel global edge **vs** EU-only (GDPR locked) | Legal | Before Phase 4 |

---

## 🤝 Contributing

1. Fork → feature branch → PR against `main`
2. Run `pnpm lint && pnpm typecheck && pnpm test` locally before pushing
3. Use Conventional Commits
4. Add a `pnpm changeset` if you change a package's public API
5. CI must be green, Vercel preview must build, ≥1 reviewer approval

For larger changes, open an issue first to align on approach. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📜 License

[MIT](LICENSE) © EcoWoods contributors

---

<div align="center">

### **The Promise**

This platform will **feel like Instagram** (social proof), **transact like Amazon** (frictionless checkout), and **operate with the live nerve of n8n** (instant feedback).

Every component shares the same types. Every action triggers the same workflows. Every deployment is identical.

**One codebase. One truth. Infinite scale.**

*Built with obsession for consistency, performance, and developer joy.*

</div>
