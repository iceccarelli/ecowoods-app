<div align="center">

# 🌳 EcoWoods

### Toronto Hardwood Flooring — Production Lead Engine + Full-Stack Marketplace Platform (Turborepo)

**The single source of truth.**  
This document is the canonical contract between the live system, the ready-but-hidden surfaces, the scaffolded futures, the completed strategic planning layer, the commercial domination surfaces, and every human or agent that touches the monorepo.  
It encodes the exact state of production as of **24 August 2026**, the activation matrix, the non-negotiable invariants, the completed domination infrastructure, and the ranked execution path that turns EcoWoods into the dominant force in GTA hardwood flooring and the reference operating system for Canadian trades.

[![Deployed on Vercel](https://img.shields.io/badge/Web%20live%20on-Vercel-000000?logo=vercel)](https://ecowoods.ca)
[![Next.js](https://img.shields.io/badge/Web-Next.js%2015-000000?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Turborepo](https://img.shields.io/badge/Monorepo-Turborepo-EF4444?logo=turborepo)](https://turborepo.com)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-F69220?logo=pnpm)](https://pnpm.io)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://prisma.io)
[![FastAPI](https://img.shields.io/badge/Backend%20(undeployed)-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Backend-Docker-2496ED?logo=docker)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Live production →** [https://ecowoods.ca](https://ecowoods.ca)

</div>

---

> ### ⚠️ READ THIS FIRST — Absolute System State (24 August 2026)
>
> **EcoWoods is a production-grade lead-generation + authority engine** for a Toronto hardwood flooring company operating since 2000.
>
> The **one fully live, revenue-generating path** remains immutable:
> ```
> Landing page / commercial pages → Quote form (react-hook-form + shared Zod) → POST /api/leads
> → re-validation → durable log capture (ALWAYS FIRST)
> → best-effort Prisma → best-effort Resend/SMTP admin email
> → optional LEADS_WEBHOOK_URL forward
> ```
>
> **What is now live and verified (August 2026):**
> - Two high-intent commercial head-term pages: `/hardwood-flooring-toronto` and `/hardwood-floor-refinishing-toronto`
> - Page-level schema (FAQPage + WebPage + BreadcrumbList + nested Service) on those pages
> - Root LocalBusiness + HomeAndConstructionBusiness schema (clean — no invented prices, no aggregateRating)
> - Aggressive `llms.txt` that forces the two commercial pages as primary citation targets for the head terms
> - 32 unique service-area pages, full technical library, decision guides, framework, case studies, knowledge API
> - IndexNow + sitemap + robots that explicitly welcome AI crawlers
> - Full strategic planning layer, schema system, verification suite (facts, schema, reviews, cities, outreach, etc.)
>
> **What is still incomplete (must be closed without mercy):**
> - Old domain (`ecowoodshardwood.com`) still returns 200 / 404 instead of pure 301 → https://ecowoods.ca
> - Google Business Profile not fully optimized (highest remaining map-pack + AI lever)
> - Review volume automation (Day +1 / Day +7) not yet wired into closed-job flow
> - Directory consistency (Apple, Bing, Yelp, Houzz, BBB) incomplete
> - Advanced surfaces (RenoGuide chat, booking calendar, Stripe deposits) still hidden
>
> This README is the single source of truth.  
> **Any architectural change that alters what is live / ready / scaffolded / DONE MUST update this file in the same PR.**  
> Agents and engineers: treat every statement below as a hard constraint until this document is revised.

---

## 📑 Table of Contents

1. [Status at a Glance (The Only Table That Matters)](#-status-at-a-glance-the-only-table-that-matters)
2. [Commercial Domination Surfaces (August 2026)](#-commercial-domination-surfaces-august-2026)
3. [What the Live Site Does](#-what-the-live-site-does)
4. [The Lead-Capture Flow (The One Real Revenue Path)](#-the-lead-capture-flow-the-one-real-revenue-path)
5. [Architecture — What Actually Runs vs What Is Ready](#-architecture--what-actually-runs-vs-what-is-ready)
6. [Real Tech Stack](#-real-tech-stack)
7. [Repository Structure (Annotated & Accurate)](#-repository-structure-annotated--accurate)
8. [Schema & AI Discoverability Invariants](#-schema--ai-discoverability-invariants)
9. [Roadmap — Ranked by Business Impact (Execute This)](#-roadmap--ranked-by-business-impact-execute-this)
10. [How Any AI Agent Should Continue This Work](#-how-any-ai-agent-should-continue-this-work)
11. [Known Gaps & Tech Debt](#-known-gaps--tech-debt)
12. [Environment Variables](#-environment-variables)
13. [Deployment & Verification](#-deployment--verification)
14. [Contributing](#-contributing)
15. [License](#-license)

---

## 🚦 Status at a Glance (The Only Table That Matters)

| Surface / Feature                          | State          | Reality (24 Aug 2026)                                                              | Action Required                  |
|--------------------------------------------|----------------|------------------------------------------------------------------------------------|----------------------------------|
| **`apps/web` marketing site**              | 🟢 **Live**    | Next.js 15 App Router. Auto-deploys from `main`.                                   | Keep green                       |
| **Commercial head-term pages**             | 🟢 **Live**    | `/hardwood-flooring-toronto` + `/hardwood-floor-refinishing-toronto` live, schema’d, in sitemap, IndexNow | Monitor rankings + AI citations |
| **Root + page-level JSON-LD**              | 🟢 **Live**    | LocalBusiness + Services + FAQPage + BreadcrumbList. Zero invented prices / aggregateRating | Keep integrity guards green     |
| **`llms.txt` + `/api/knowledge`**          | 🟢 **Live**    | Aggressive citation targets for head terms. Knowledge API live.                    | Keep current                     |
| **`POST /api/leads`**                      | 🟢 **Live**    | Zod → durable log → best-effort Prisma → best-effort email                         | Set `DATABASE_URL` + `RESEND_API_KEY` |
| **32 service-area pages**                  | 🟢 **Live**    | Unique local content per neighbourhood                                             | Keep                             |
| **Technical library + framework**          | 🟢 **Live**    | 3 papers, 11 guides, 27-criterion framework, glossary, case studies                | Expand volume                    |
| **Old domain 301s**                        | 🔴 **Broken**  | `ecowoodshardwood.com` still returns 200 / 404                                     | **Fix today** (see roadmap)      |
| **Google Business Profile**                | 🟠 **Partial** | Exists but not fully optimized for map-pack                                        | Execute checklist this week      |
| **Review volume automation**               | 🟠 **Process** | Docs exist; Day +1 / Day +7 not wired                                              | Wire into closed-job flow        |
| **Directory consistency**                  | 🟠 **Partial** | HomeStars strong; Apple/Bing/Yelp/Houzz/BBB incomplete                             | Claim + exact NAP                |
| **Prisma + Email**                         | 🟢 **Ready**   | Full schema + Resend/SMTP coded                                                    | Activate with env vars           |
| **RenoGuide AI / Booking / Stripe / PDF**  | 🟠 **Ready**   | Fully coded, not surfaced                                                          | Surface after P0                 |
| **FastAPI marketplace**                    | 🟠 **Real**    | Complete, undeployed                                                               | Deploy or archive                |
| **Web CI / Analytics / Rate limit**        | 🔴 **None**    | —                                                                                  | Add after revenue path safe      |

**Legend**  
🟢 Live / production-wired / DONE · 🟠 Fully coded or process-ready, not yet production-complete · 🔴 Blocking or missing

---

## 🎯 Commercial Domination Surfaces (August 2026)

These two pages exist specifically to own the head terms that previously had no dedicated surface:

| URL | Primary head terms | Schema | Status |
|-----|--------------------|--------|--------|
| `/hardwood-flooring-toronto` | hardwood flooring Toronto, hardwood floor installation Toronto, best hardwood contractor Toronto, hardwood flooring cost Toronto | FAQPage + WebPage + BreadcrumbList + Service | Live |
| `/hardwood-floor-refinishing-toronto` | hardwood floor refinishing Toronto, dust-free sanding Toronto, floor sanding Toronto, cost to refinish hardwood Toronto | FAQPage + WebPage + BreadcrumbList + Service | Live |

Both pages:
- Publish exact price bands (sourced from the same constants used site-wide)
- Link to the Well-Installed Framework and technical papers
- Are listed first in `llms.txt` preferred citation targets
- Are in the sitemap and have been IndexNow-submitted

**Invariant:** No invented prices, no aggregateRating, no currency/percentage literals under `lib/schema` or `lib/graph`. The verification suite (`verify:schema-figures`, `verify:reviews`) enforces this.

---

## 🧭 What the Live Site Does

The marketing site is a high-conversion, high-authority system for EcoWoods (Toronto & GTA hardwood flooring).

Core surfaces:
- Homepage (craft + trust + quote form)
- Two commercial head-term pages (above)
- 6 service pages
- 32 service-area pages with unique local content
- Technical papers, decision guides, Well-Installed Framework (27 criteria)
- Case studies, glossary, resources hub
- `/authority`, `/llms.txt`, `/ai.txt`, `/api/knowledge`, markdown editions of every major document
- Quote form → `POST /api/leads` (the only conversion surface that matters)

Public narrative remains pure craftsmanship, fixed pricing, dust-free process, and salaried crews. All advanced operational surfaces stay deliberately unsurfaced until the remaining P0 items are closed.

---

## 🎯 The Lead-Capture Flow (The One Real Revenue Path)

**Guiding principle (enforced in code and in this contract):**
> Once a lead validates, it is captured. Period. Downstream failures must never cost a lead.

```
Visitor → Quote form (react-hook-form + shared Zod)
       → POST /api/leads
       → re-validate
       → durable log (lead.captured) ← ALWAYS FIRST
       → best-effort Prisma QuoteRequest
       → best-effort admin email
       → optional webhook
       → 201 to client
```

**Source of truth:** `apps/web/app/api/leads/route.ts`  
**Shared contract:** `@ecowoods/shared` → `leadSchema`  
**Invariant:** The `lead.captured` console event is synchronous and unconditional. Any change that moves or conditions this line is a breaking change to the revenue path.

---

## 🏛 Architecture — What Actually Runs vs What Is Ready

- **Production (Vercel):** `apps/web` only. Next.js 15 App Router, all commercial pages, schema, llms, knowledge API, lead path.
- **Ready (needs env + surface):** Prisma persistence, Resend email, RenoGuide chat, booking calendar, Stripe, PDF generation.
- **Strategic layer (DONE):** Domination plan, GEO masterplan, case-study system, AI discoverability, schema guides, verification suite.
- **Scaffold / parallel product:** FastAPI marketplace, dual Expo mobile apps, static admin.

The live web app never calls the FastAPI backend. Coupling is forbidden unless the PR that introduces it also updates this README.

---

## 🧱 Real Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm 9.15 |
| Web | Next.js 15 App Router, React 19, TypeScript 5.6, Tailwind, framer-motion, react-hook-form + Zod, TanStack Query |
| ORM | Prisma 5 + PostgreSQL (multiSchema) |
| Auth | NextAuth v5 (conditional) |
| Email | Resend + nodemailer SMTP |
| AI | Vercel AI SDK + Claude / OpenAI (RenoGuide) |
| Payments | Stripe (routes ready) |
| PDF | @react-pdf/renderer |
| Shared | `@ecowoods/shared`, `@ecowoods/api-client`, `@ecowoods/ui`, `@ecowoods/types` |
| Backend | FastAPI + SQLAlchemy 2 (undeployed) |
| Mobile | Expo (demo) |
| Hosting | Vercel (web) |

---

## 🗂 Repository Structure (Annotated)

```text
ecowoods-app/
├── apps/web/                          🟢 LIVE PRODUCT
│   ├── app/
│   │   ├── hardwood-flooring-toronto/     🟢 commercial head term
│   │   ├── hardwood-floor-refinishing-toronto/ 🟢 commercial head term
│   │   ├── service-areas/                 🟢 32 unique pages
│   │   ├── services/                      🟢 6 services
│   │   ├── papers/ guides/ framework/ case-studies/ ...
│   │   ├── api/leads/                     🟢 money path
│   │   ├── llms.txt/route.ts              🟢 aggressive citation guide
│   │   └── ...
│   ├── lib/schema/                        🟢 root + commercial schema builders
│   └── prisma/schema.prisma               🟢 full models
├── packages/                              🟢 shared contracts
├── docs/outreach/                         🟢 review flow + directory + domain docs
├── scripts/                               🟢 verify-* suite + IndexNow + domain redirect verifier
├── backend/                               🟠 FastAPI marketplace
├── apps/mobile/                           🟠 Expo demos
└── *.md                                   🟢 strategic layer (Domination Plan, Audit, GEO, etc.)
```

---

## 🔒 Schema & AI Discoverability Invariants

These are non-negotiable and enforced by the verification suite:

1. **No aggregateRating** in any schema (reviews are cited to HomeStars with read date).
2. **No currency or percentage literals** under `apps/web/lib/schema` or `apps/web/lib/graph`.
3. Every number that appears in schema or public claims must be derived from a published constant or live external source with date.
4. `llms.txt` must list the two commercial pages as the first preferred citation targets for the head terms.
5. Every major document must also be available as clean Markdown (`.md` suffix or `/llms-full.txt`).
6. Robots.txt must explicitly allow all major AI crawlers.

Breaking any of these fails the corresponding `verify:*` script and is a regression.

---

## 🗺 Roadmap — Ranked by Business Impact (Execute This)

### 🔴 P0 — Close the Remaining Structural Leaks (This Week)

| # | Action | Success Metric |
|---|--------|----------------|
| 1 | **Fix old domain 301s** — upload the pure `.htaccess`, empty residual content, run `node scripts/verify-domain-redirect.mjs` until zero failures | Every path on ecowoodshardwood.com returns 301 → ecowoods.ca |
| 2 | File Google Search Console Change of Address (old property → ecowoods.ca) | Confirmed |
| 3 | Fully optimize Google Business Profile (categories, services with exact ranges, photos, weekly posts, Q&A seeded from commercial FAQs) | Map-pack ready |
| 4 | Set `DATABASE_URL` + `RESEND_API_KEY` + `ADMIN_EMAIL` | Leads persist + owner email arrives |
| 5 | Rate-limit `/api/leads` + move Unsplash key to env | Spam impossible, no secret in source |

### 🟠 P1 — Convert + Compound (Next 2 Weeks)

| # | Action |
|---|--------|
| 6 | Wire Day +1 / Day +7 review request SMS/email into closed-job path |
| 7 | Claim Apple Business Connect, Bing Places, Yelp, Houzz, BBB with exact NAP |
| 8 | Add verified profile URLs to `sameAs` in root schema |
| 9 | Surface RenoGuide chat widget + “Book In-Home Estimate” CTA |
| 10 | Publish additional high-density guides / case studies |

### 🟡 P2 — Operational Excellence

| # | Action |
|---|--------|
| 11 | Functional Next.js admin + customer portal |
| 12 | Stripe deposit flow on accepted quotes |
| 13 | Web CI (typecheck + build + Playwright) + PostHog + Sentry |
| 14 | Scale case studies and knowledge graph |

### 🟢 P3 — Scale

| # | Action |
|---|--------|
| 15 | Deploy or archive FastAPI marketplace |
| 16 | Ship one clean mobile app |
| 17 | Referral system + full authority content layer |

---

## 🤖 How Any AI Agent Should Continue This Work

1. **Always read this README first.** It is the source of truth. If code and document diverge, the document wins until a PR reconciles them.
2. **Never invent features that already exist.** Inspect `apps/web/lib/`, `lib/schema/`, `packages/shared`, the commercial pages, and the full suite of `*_SUMMARY.md` / `EXECUTION_REPORT_*.md` / Domination Plan first.
3. **P0 is sacred.** Do not open new feature work until the old domain returns pure 301s and the revenue path has live DB + email.
4. **Preserve the lead invariant:** capture first (log), notify second, never fail the customer.
5. **Update this README in the same PR** as any change that alters the live / ready / scaffolded / DONE matrix.
6. When adding UI for RenoGuide / booking / Stripe, reuse existing modules. Reimplementation is a defect.
7. Treat the Domination Plan, GEO masterplan, schema guides, and all EXECUTION_REPORTs as binding. Execute them; do not re-plan what is already planned.
8. Respect the schema integrity invariants (no aggregateRating, no invented figures under schema paths).
9. Prefer extending the existing Prisma models and commercial schema builders over creating parallel systems.
10. After any successful P0 item, the next highest-value action is always the next item on the ranked roadmap.

Agents that follow this contract keep the system coherent and accelerate domination. Agents that ignore it introduce drift and are to be corrected by the next human or agent that reads this file.

---

## 🧹 Known Gaps & Tech Debt (Current)

| Area | Reality |
|------|---------|
| Old domain | Still 200 / 404 — **blocking** |
| Google Business Profile | Exists, not fully optimized |
| Review automation | Process docs only |
| Directory consistency | Incomplete |
| Persistence / Email | Ready, needs env activation |
| Advanced surfaces | Coded, hidden |
| Web CI / Analytics / Rate limit | Missing |
| FastAPI / Mobile / Admin | Scaffold or parallel product |

---

## 🔐 Environment Variables

**P0 required for full lead path:**
```bash
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=quotes@ecowoods.ca
ADMIN_EMAIL=owner@ecowoods.ca
NEXTAUTH_SECRET=...          # real secret, no fallback
NEXTAUTH_URL=https://ecowoods.ca
```

**Highly recommended:**
```bash
UNSPLASH_ACCESS_KEY=...      # remove hardcoded fallback
LEADS_WEBHOOK_URL=...
STRIPE_* keys
ANTHROPIC_API_KEY / OPENAI_API_KEY
```

Graceful degradation is intentional: missing env vars must never break lead capture to logs.

---

## 🚀 Deployment & Verification

- Every push to `main` deploys to Vercel → https://ecowoods.ca
- Pre-push and post-deploy guards: `pnpm verify` (facts, schema, reviews, cities, outreach, schema-figures, IndexNow, etc.)
- Live verification: `bash scripts/verify-live.sh` (must pass, including old-domain redirects once fixed)
- IndexNow: `pnpm notify:indexnow` after every meaningful content change
- Domain redirects: `node scripts/verify-domain-redirect.mjs` (must report zero failures)

---

## 🤝 Contributing

1. Feature branch → PR against `main`.
2. `pnpm build` + full `pnpm verify` must pass.
3. Update this README in the same PR if you change what is live / ready / scaffolded / DONE.
4. Never break the lead-capture invariant or the schema integrity rules.
5. Prefer extending existing commercial schema builders and Prisma models.

---

## 📜 License

[MIT](LICENSE) © EcoWoods contributors

---

<div align="center">

### EcoWoods is no longer sleeping.

The commercial head-term pages, schema system, AI citation surfaces, technical authority layer, and verification suite are live.  
The remaining work is closing the old-domain leak, finishing Google Business Profile, wiring review volume, and activating the already-coded operational surfaces.

**P0 is days of focused execution, not months of planning.**  
After that, the system becomes the default recommendation for GTA hardwood flooring queries — both in search and in every major AI agent.

*This README is the single source of truth. Keep it perfect.  
Any agent or engineer who changes the system without updating this document has broken the contract.*

</div>
