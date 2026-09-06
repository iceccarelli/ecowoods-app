# Environment variables (Stage 43)

Values are never committed or printed. `pnpm env:check` reports which are set without showing values.
`next build` must succeed with the placeholders in `.github/workflows/web.yml`; nothing below is needed to build.

| Name | Purpose | Required | Where | Sensitivity |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for every machine surface, JSON-LD, sitemap, Link headers | prod: yes (`https://ecowoods.ca`); dev: optional | build + runtime | public |
| `DATABASE_URL`, `DIRECT_URL` | Prisma (leads, quotes, appointments, projects) | prod: yes; build: placeholder | runtime | secret |
| `NEXTAUTH_SECRET` (`AUTH_SECRET`), `NEXTAUTH_URL`, `AUTH_TRUST_HOST` | next-auth v5 sessions for /admin and /mypage | prod: yes; build: placeholder | runtime | secret |
| `AUTH_GOOGLE_ID/SECRET`, `AUTH_FACEBOOK_ID/SECRET`, `AUTH_TWITTER_ID/SECRET`, `AUTH_APPLE_*` | OAuth providers (optional) | optional | runtime | secret |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_EMAIL` | Lead, review-request and referral email | prod: yes | runtime | secret |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Fallback mailer | optional | runtime | secret |
| `CRON_SECRET` | Bearer for `/api/cron/*`; now also accepted by `/api/indexnow` | prod: yes | runtime | secret |
| `INDEXNOW_KEY` | IndexNow key (falls back to the key-file route `app/<key>.txt`); GitHub secret for `.github/workflows/indexnow.yml` | optional | runtime + CI | low (public by protocol design) |
| `LEADS_WEBHOOK_URL`, `PILOT_LEADS_WEBHOOK_URL` | CRM forward of captured leads — must be public **https**, non-IP, non-private (validated in `lib/outbound-webhook.ts`, redirects refused, 3 s timeout) | optional | runtime | secret |
| `ERROR_WEBHOOK_URL`, `ERROR_WEBHOOK_TIMEOUT_MS` | Error-reporting forward (`lib/error-reporting.ts`) | optional | runtime | secret |
| `ANTHROPIC_API_KEY` | `/api/chat` assistant (validated messages, origin-checked, rate-limited) | optional (route degrades) | runtime | secret |
| `OPENAI_API_KEY` | Admin-side drafting (`lib/ai.ts`), gated by `settings.aiEnabled` | optional | runtime | secret |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Invoices/checkout | optional | runtime | secret |
| `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Document storage; document fetches are allow-listed to the blob host / canonical host | optional | runtime | secret |
| `UNSPLASH_ACCESS_KEY` | `/api/backgrounds` (rate-limited, own-theme keys only) | optional | runtime | secret |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 after consent; conversion events | optional (README §6: pending) | runtime | public |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_BING_SITE_VERIFICATION` | Search Console / Bing Webmaster verification meta | optional | build | public |
| `NEXT_PUBLIC_BOOKING_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_YOUTUBE_PROCESS_ID`, `NEXT_PUBLIC_SOCIAL_*` | Optional UI links | optional | build | public |
| `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` | Set by Vercel; used in error reports | automatic | runtime | public |

Sandbox-only (never set in CI or production): `PRISMA_QUERY_ENGINE_LIBRARY`, `PRISMA_SCHEMA_ENGINE_BINARY`,
`PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING`, `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` — used only where engine and
font downloads are blocked, to typecheck and build locally.

## Database migrations

**NOT REQUIRED** — this change adds no Prisma model or column. `scripts/verify-migrations.mjs` passes unchanged.
