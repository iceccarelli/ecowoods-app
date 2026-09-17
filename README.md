# Ecowoods

Canonical entity site + agentic API + Floor Studio + review flywheel for
Ecowoods Hardwood Flooring Inc.

Live site — https://ecowoods.ca

## NAP field sheet

| Field | Value |
|---|---|
| Business name | Ecowoods |
| Phone | (647) 244-5156 |
| Address | 32 Norfield Crescent, Toronto, ON M9W 1X6 |
| Hours | Mon–Sat 8 AM–7 PM, Sun 10 AM–4 PM (America/Toronto) |
| Website | https://ecowoods.ca |

## Stack

pnpm + turbo monorepo. `apps/web` is Next.js 15.5 (App Router), React 19.1,
Prisma, Auth.js, Resend, Stripe, Supabase, and the Vercel AI SDK. `apps/mobile`
is Expo. Deployed on Vercel.

## Running it

```bash
pnpm install
pnpm dev          # apps/web dev server
pnpm build        # apps/web production build
pnpm verify       # all repository guards
```

## Source of truth

- `packages/shared/constants/index.ts` — business identity, hours, review/profile links
- `apps/web/content/constants/pricing.ts` — published pricing bands
- `ECOWOODS_AUTONOMOUS_EXECUTION_PROTOCOL.md` — execution law
- `docs/FLOOR_STUDIO.md` — Floor Studio constraints
