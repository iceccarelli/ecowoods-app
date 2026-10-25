# Ecowoods — project instructions

Hardwood flooring contractor based in Etobicoke, Toronto. Active service markets, as declared in `apps/web/content/geo/markets.ts`: Toronto and the GTA, the listed Southern Ontario markets, and the listed Western New York markets (owner-confirmed, with cross-border licensing and crew work authorization in hand; the confirmation date lives in that file; New York work is priced in US dollars). Production: https://ecowoods.ca. This file is the short version; procedures live in `docs/` (see `docs/VERIFY.md`, `docs/DEPLOY.md`, `docs/FLOOR_STUDIO.md`).

## Architecture

pnpm + turbo monorepo (`pnpm@9.15`, Node 22).

- `apps/web` — the product: Next.js 15 App Router, React 19, Prisma 5 (PostgreSQL, schema `ecowoods`), Auth.js, Stripe, Resend, Vercel AI SDK. Tests: vitest.
- `backend/` — FastAPI + Alembic service. Separate from the web app; do not bridge or duplicate its APIs from Next.
- `apps/mobile` (Expo), `apps/admin` — separate apps.
- `packages/shared` — constants and zod schemas shared by web and backend clients.
- `scripts/` — dependency-free guards (`verify-*.mjs`, run by `pnpm verify`) and their self-tests (`*.test.mjs`).
- Deploy: Vercel from `main` (`vercel.json`). The build copies `apps/web/public` into repo-root `public/`, which is what production serves.

## Where each fact is owned (change it there, never on a page)

| Fact | Source |
|---|---|
| Legal name, address, phone, email, hours, founded year, profile links, review figures | `packages/shared/constants/index.ts` (`BUSINESS_NAP`, `HOURS_LINE`, `PROFILE_LINKS`, `REVIEW_EVIDENCE`) |
| Published price bands (CAD and USD) | `apps/web/content/constants/pricing.ts` |
| Claims and their public provenance | `apps/web/content/claims.ts` (`publicSource`/`publicNote` are published; `source`/`note` are internal) |
| Services, service areas, FAQ, city content | `apps/web/lib/seo-data.ts`, `apps/web/lib/service-pages.ts` |
| Markets, corridors, coverage truth and its confirmation date | `apps/web/content/geo/` |
| Machine-readable entity (`/api/v1`, schema, llms*.txt, markdown twins) | `apps/web/lib/registry/`, `lib/schema/`, `lib/markdown-export.ts`, `app/llms*.txt`, `app/ai.txt` |
| Lead acquisition (channel set, validation, labels; stored in the separate `LeadAcquisition` table, best-effort) | `apps/web/lib/acquisition.ts`, `lib/lead-acquisition.ts` |
| Funnel ledger and report | `apps/web/lib/funnel-ledger.ts`, `lib/funnel-report.ts`, `/admin/funnel` |
| Market census facts (Statistics Canada 2021, Canadian municipalities only) | `apps/web/content/geo/sourced-facts.json` (each fact carries table, URL, vintage, retrieval date, geography code and name), `geography-map.json`, derived `market-inputs.generated.ts` (`pnpm geo:ingest -- --write`; `pnpm verify:geodata` fails on drift). Used only for the internal market order and the one cited local line on a municipality's page (`lib/geo/public-facts.ts`); districts and New York never get a line, and no score or ranking is published |
| Credits, checkout, payments | `apps/web/lib/` credit, Stripe and payment-reconciliation modules; do not change prices or eligibility casually |

Business facts that must stay consistent everywhere: legal name Ecowoods Hardwood Flooring Inc.; public name Ecowoods; one organization identity `https://ecowoods.ca/#organization`; one NAP; six published services; the published service-area list (Ontario and Western New York) is the only coverage claim: never "all of Canada", never "nationwide", never a market that is not in the registry, never an unapproved expansion. Western New York is an active service market, but the showroom, phone, hours and review figures remain Toronto facts: no second address or phone on a New York page (`pnpm verify:geo`), and no claim of a US office. Stated review figures are read from `REVIEW_EVIDENCE` with their read date and are never blended or turned into `aggregateRating`.

## Rules

- No invented projects, reviews, credentials, awards, prices, dates or coverage. If a fact is missing, say what owner decision or source is needed. Superlatives only with a real source.
- Public surfaces carry customer language only: no audit references (`F-123`), engineering status words, or internal notes (`pnpm verify:wording`).
- Do not make a stale date look fresh. Owner-confirmation dates change only when the owner re-confirms.
- Lead attribution stores a closed-set channel slug and a plain landing path only: never search text, query strings, tokens or private routes. `NULL` (not captured) is different from `no_referrer`.
- Database: forward-only, backward-compatible Prisma migrations. Never run `prisma migrate dev` or `db push` against production, never change customer data, and apply a migration to production only when the owner has authorised it, by the procedure in `docs/DEPLOY.md` (Database migrations). Deploys do not apply migrations, so code must work whether or not a new migration has run: prefer a new table read and written only by code that catches its own failure over new columns on a table that is read everywhere (Prisma selects every column).
- Preserve auth boundaries, durable rate limits, assistant access controls, Renovation Credits, Stripe and payment reconciliation, idempotency. Do not weaken guards or tests to get green.
- `/assistant` and `/floor-studio` behaviour is preserved unless a task is explicitly about them.
- Market scores need sourced inputs (`apps/web/content/geo/market-inputs.ts`, `pnpm verify:inputs`). Leave unavailable inputs unavailable.
- Secrets, DNS and production data are out of scope for code changes.

## Commands

```
pnpm verify                         # every guard (scripts/verify-all.mjs); the list derives from package.json
pnpm test:scripts                   # guard self-tests
pnpm --filter @ecowoods/web test    # vitest (Postgres integration tests need RUN_POSTGRES_INTEGRATION=1)
pnpm typecheck && pnpm lint         # turbo
pnpm build                          # web build (prisma generate + next build)
```

CI (`.github/workflows/web.yml`) runs Guards, Typecheck & Build (typecheck, lint, vitest, build) and a real-Postgres job. `concurrency` cancels an in-flight run when a newer push arrives, so a cancelled run is not a failure and not a pass.

## Workflow

1. Fetch `origin`; `origin/main` is authoritative. Inspect before editing; reuse existing implementations.
2. `main` is the only long-lived branch. Commit coherent milestones and push once per milestone; avoid tiny pushes that cancel CI.
3. Run focused checks while working; run `pnpm verify` before committing; rely on CI for the full suite.
4. Review the diff (and `/code-review`, `/security-review` where available) before promoting; investigate large deletions and any change to migrations, payments, auth or public routes.
5. Report only CI results that belong to the exact pushed SHA.
6. Never use `git reset --hard`, `git clean`, force-push or mass branch deletion. No new status or audit Markdown files in the repo.
