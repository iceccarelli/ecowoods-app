# HANDOFF — ecowoods.ca

**For the next agent picking this up.** Read this once, top to bottom, before
touching anything. It is a handoff, not a tutorial: it says what is true, what
is not done, what will bite you, and what the house rules are.

Last updated: 2026-09-15, after the TRUTH-01 → CRAWL-01 series.

---

## 0. Verify against production, not only the source tree

**Done means production and repository agree — a green guard suite checks the
repository, and that is a different question.**

Sixty-six guards read the source tree, and that coverage is real: it is also,
by construction, blind to anything that only shows up once code is deployed.
Four past defects here are the reason this section exists rather than a
general warning — each passed every guard while live behaviour disagreed with
it:

| | what happened | every guard was green |
|---|---|---|
| F-107 | staleness clock read "0 days ago" forever | yes |
| F-129 | 28 diagrams shipped as code, files left behind — every image a broken icon | yes |
| F-131 | `apps/web/public` has never been served on this host; `/icon-192.png` 404'd for months | yes |
| — | `/quote-check` returned 404 to every visitor for a **week** while a Git integration re-aliased `main` over each CLI deploy | yes |

A green local tree is not, by itself, evidence the live site matches. The
checks that see this class of defect are the ones that fetch the live site —
see §3.

---

## 1. What this is

Turborepo monorepo. Toronto/GTA hardwood flooring platform.

```
apps/web          Next.js 15 App Router — the site. Vercel, deploys from main.
apps/admin        admin surface
apps/mobile       Expo
services/render-api   Fly.io. Renders floor plates server-side. NOT DEPLOYED — see §2.
packages/shared   constants, AI vocabulary, schemas — the source of truth for
                  NAP, price bands, finish/pattern/width options
packages/ui       exists, currently unimported
scripts/          81 verify:* / seo:* guards, plus the live ones
audit/scripts/    10 rendered-output audits (contrast, a11y, theme parity, …)
old-domain/       the ecowoodshardwood.com migration kit — see §2.1
docs/             strategy, geo, floor graph, deploy
```

- pnpm 9, **`--frozen-lockfile`**. One new dependency anywhere breaks installs
  everywhere. Everything added in this series is zero-dependency, deliberately.
- Prisma 5.22 → Supabase (`wxqjbtcnbhymnfqlvbch`, schema `ecowoods`, eu-west-1)
- vitest: **47 files, 852 tests, all passing** as of `c5b565f`

---

## 2. NOT DONE — in priority order

These are the open items. Nothing here is a code bug; every one needs an
access or a decision that an agent does not have.

### 2.1 🟠 Attach the retired domain in the Vercel dashboard

`ecowoodshardwood.com` is the company's earlier domain. This repository
publishes one canonical entity — `https://ecowoods.ca` — and every legacy URL
from the old domain has a path-preserving 301 already written for it.
**Twenty-two of those URLs are individual customer testimonials with real
names**, which is exactly why the redirect map sends each one to `/reviews`
rather than to a generic homepage.

Everything is prepared in the repository. `old-domain/path-map.json` is the
one source; it generates `_redirects`, `index.php`, `nginx.conf` and
`vercel-redirects.json`, and the same rules are declared in `vercel.json`,
host-conditioned on `(www\.)?ecowoodshardwood\.com`. The one step this
repository cannot perform is attaching the domain to the Vercel project — that
happens in a dashboard, not in code:

```bash
vercel whoami                      # must print the account, not "Not authorized"
vercel domains add ecowoodshardwood.com ecowoods-app
vercel domains add www.ecowoodshardwood.com ecowoods-app
```

**Both commands take the project name.** Without it an apex domain is added to
the *team* and attached to nothing — it prints `Success!` and changes nothing —
and the `www` subdomain is refused outright.

Read `old-domain/EXECUTE.md` fully first. Once the domain is attached, run
`pnpm verify:domain` and only file a Google change of address after it reports
zero failures.

### 2.2 🔴 Shop prices are placeholders, and the checkout is live

17 active `Product` rows. **Every `basePrice` matches the placeholder seed
exactly.** `/mypage` sells from those rows and `/api/shop/checkout` creates a
Stripe session from them.

Nothing has been bought — the 7 PENDING orders from 2026-07-20 have no
`stripePaymentIntentId`, and the 3 COMPLETED payments ($11,695.50) are against
**Invoices**, not shop Orders. So this has cost nothing yet. It is a loaded gun,
not a wound.

The **write** path is now gated: `prisma/seed-products.ts` refuses without
`SHOP_PRICES_ARE_REAL=1`. Rows already in the database are data, and changing
somebody's live prices is not a script's decision. Two exits, both in
`apps/web/prisma/README-SHOP-PRICES.md`:

- set real per-sq-ft numbers in the seed, then `SHOP_PRICES_ARE_REAL=1 npx tsx prisma/seed-products.ts`
- or `update ecowoods."Product" set active = false;` and take the shop down until they are real

**An agent must not pick.** Ask.

### 2.3 🟠 render-api is not deployed

`services/render-api` is built and tested (`node scripts/render-api-test.mjs` →
ALL PASSED) and has never been deployed. Needs `RENDER_API_KEYS` set and
`fly deploy`. The site does not depend on it — `/design` renders client-side —
so this is upside, not breakage.

Note: it needs Node ≥ 22.6 for `--experimental-strip-types`. The devcontainer
pins `node:20-bookworm`, so `pnpm test:render-api` **cannot run in the
Codespace** and correctly refuses rather than reporting a false pass. The
deployed image is `node:24-slim`, so production is unaffected. Raising the
devcontainer to `node:22-bookworm` is a change to everyone's environment —
a decision, not a side effect.

### 2.4 🟠 14 unpriced leads

In the database. Business action.

### 2.5 🟡 Known and deliberately left alone

- `RelatedContent.tsx` / `CountUp.tsx` are orphaned. **Not deleted** — another
  agent may be mid-work on them.
- `@ecowoods/ui` is unimported. Removing it edits the lockfile. Don't.
- `BookingPanel` has no calendar sync. Set `NEXT_PUBLIC_BOOKING_URL` to a
  Cal.com/Calendly link and it becomes the primary path with the built-in
  scheduler as fallback. Unset today, deliberately — no half-wired integration.
- Legal pages are unreviewed by a lawyer. Disclosed in-file.
- `apps/web/public` is **not served on this host**. Known, stated as fact in
  `verify-live.sh` rather than rediscovered.

---

## 3. How to verify. Both halves, every time.

### Half one — the repository

```bash
pnpm install --frozen-lockfile
node scripts/verify-all.mjs      # 66 guards, must be 66/66
pnpm test:web                    # 47 files, 852 tests, must be 852/852
node audit/scripts/parse-scan.mjs
```

`pnpm test:web`, **not** `pnpm vitest run <path>` from the repo root. The only
vitest config is `apps/web/vitest.config.ts`; run it from the root and there is
no `@/` alias and suites fail to load looking like real failures.

### Half two — production. Do not skip this.

`verify-all` silently skips 15 network scripts. **These are the ones that catch
the F-107/F-129/F-131 class**, and they had not been run for weeks when this
series started:

```bash
bash scripts/verify-live.sh             ; echo "exit=$?"
node scripts/verify-live-routes.mjs     ; echo "exit=$?"   # every route the source defines, fetched
node scripts/verify-live-images.mjs     ; echo "exit=$?"   # a REAL rendered _next/image URL
node scripts/verify-domain-redirect.mjs ; echo "exit=$?"   # 0 once the domain is attached in Vercel — §2.1
node scripts/verify-stale-hosts.mjs     ; echo "exit=$?"   # passing
node scripts/crawl-site.mjs             ; echo "exit=$?"   # 104 URLs, link/canonical/JSON-LD
```

Use `;` not `&&` — you want every result, not a stop at the first.

Current state: stale-hosts ✓, crawl ✓ (after CRAWL-01), domain redirects implemented in-repo — pending the Vercel dashboard step in §2.1.

---

## 4. House rules. These are the owner's, not suggestions.

1. **One `.patch` file at a time**, plus the exact Codespaces terminal
   commands. He runs GitHub operations himself. Give commands; do not instruct
   him on what to click.
2. **Never sacrifice truth for a green score.** A guard that cannot run has not
   passed — say so. Report what you could not verify, explicitly, rather than
   implying coverage you do not have.
3. **Do not invent** local customers, jobs, reviews, addresses, offices or
   employees. See the `honesty-kernel` skill.
4. **Do not add or tighten guards that would block his other AI agents.** Only
   *widening* edits to existing guards, and disclose every one.
   - The nuance that matters: a guard whose *premise* has become false is not
     protected by this rule. HANDOFF-01 inverted an assertion because the fact
     it asserted was gone — and it came back covering strictly more than
     before. CRAWL-01 did the same. Inverting a stale guard into a stronger one
     is fine. Loosening a live one to get green is not.
5. **Be ruthless; do not sabotage your own tests.** Say plainly what is still
   broken.
6. Keep working in steps. Do not stop after one fix.

---

## 5. The delivery loop, and the trap in it

Uploading a `.patch` through the GitHub web UI **commits the file to `main` on
the remote** instead of applying it, and ignores `.gitignore`. This has eaten
entire verification runs — tests report green against code that never changed.
`scripts/patch-apply.sh` exists because it happened five times.

```bash
cd /workspaces/ecowoods-app && \
git pull --rebase && \
ls -la ECOWOODS_<NAME>.patch && \
bash scripts/patch-apply.sh --am ECOWOODS_<NAME>.patch && \
grep -c "<a string the patch adds>" <file it adds it to> && \
node scripts/verify-all.mjs && \
pnpm test:web && \
git push
```

Why each piece:

- **`--rebase`, not `--ff-only`.** The web upload puts a commit on the remote
  that the Codespace does not have; `--ff-only` aborts with `Not possible to
  fast-forward` once local also has commits.
- **`ls`** fails loudly if the file never reached the Codespace.
- **`grep -c` must print `1`** before a single test runs. This is the guard
  against the failure above — proof the patch is in the tree, not just that a
  command exited 0.
- **`&&` throughout**, so nothing downstream runs on a false premise.
- `--am` applies with commit messages, then untracks and deletes the envelope
  in its own hygiene commit. `verify:hygiene` then passes by itself.

Always verify the patch replays: clone, reset, apply through the upload path,
and compare `git rev-parse HEAD^{tree}` to yours. They must be identical.

---

## 6. Sandbox limits you will hit

Say these out loud rather than working around them.

| limit | consequence |
|---|---|
| npm registry **403** (direct *and* through the proxy) | no `node_modules`. `verify:css` fails here and only here; React cannot be installed, so component-rendering suites cannot be executed |
| `git push` / `git fetch` **403** — "not in this session's authorized repository set" | cannot push. `origin/main` is frozen at the clone commit, so the unpushed-commits hook is permanently wrong. **The fix is to add the repo to the session's sources** — then patches stop being necessary entirely |
| `curl https://ecowoods.ca` → **403 CONNECT** | the live scripts in §3 cannot run in the sandbox. `WebFetch` works and is the sanctioned way to check production |
| Vercel MCP returns `teams: []` | not linked to the Vercel org; deployment state must be checked via the live site |

Useful workaround, used throughout this series: TS modules can be run directly
with `node --experimental-strip-types` plus a small resolver hook mapping `@/`
→ `apps/web` and `@ecowoods/shared` → `packages/shared`, with stubs for
`gray-matter`, `marked` and static image imports (mirroring
`vitest.config.ts`'s `imageStub`). That is how `llms.txt` was measured at
exactly the 33,066 the failing test reported — same number, so the measurement
was authoritative, not approximate.

---

## 7. Skills, plugins and connectors available here

**Product law — read the relevant one before editing.** These encode decisions
you would otherwise re-litigate:

- `anthropic-skills:ecowoods` — **the one for this repo.** Floor Studio,
  estimates, reviews, NAP, JSON-LD, llms.txt, `/api` knowledge, verify scripts.
- `anthropic-skills:honesty-kernel` — claim-and-evidence law. Use for any
  public number, capacity claim, review count, certification or AI capability
  claim. Non-negotiable here.
- `anthropic-skills:grimaldi-stack` — shared Next/Tailwind/Vercel/Supabase/
  Stripe/Resend/Playwright conventions across his products.

**Output formats** — research first, read the skill second, build third. Never
open a format skill before the facts are gathered; it anchors you on document
mechanics before you have anything correct to put in the document.
`docx`, `pptx`, `xlsx`, `pdf`, `dataviz` (read before *any* chart),
`artifact-design` / `artifact-diagramming` / `artifact-capabilities`,
`design` (canvas mockups), `skill-creator`.

**Connectors**: Supabase (live DB — `execute_sql`, `get_advisors`,
`list_migrations`), Stripe, Vercel, Slack. Supabase is the one that earns its
keep here: the shop-price finding in §2.2 came from querying the live database
rather than reading the seed file.

Two habits worth keeping:

- **`get_advisors`** on Supabase for security/performance findings — it has not
  been run in this series.
- Search the MCP registry before assuming a capability is missing.

---

## 8. Where the bodies are buried

Hard-won, non-obvious, and each one cost hours:

- **The texture pipeline** (`scripts/textures/build-grain.py`) is the most
  defect-dense code here. Six arithmetic defects stood between having
  photographs of real floors and using them. Read the header before changing
  anything; every decision has a measured reason. The last one: two of six
  tiles were spending ~75% of their contrast on a lighting ramp that repeated
  as a horizontal band across every board — invisible in a contact sheet,
  obvious the moment tiles are rendered at **true floor scale with board seams
  drawn**. Do that, not equal-pixel contact sheets.
- **Scoring functions pick figured wood.** Twice a crop search's top-scoring
  candidate was the *worst* to look at — coherence rewards broad smooth swirls
  that read as burl veneer. Always render the top few at floor scale and look.
- **`tsconfig` says `"jsx": "preserve"`**, so esbuild falls back to the classic
  runtime under vitest. `esbuild: { jsx: 'automatic' }` in `vitest.config.ts`
  is what makes component rendering work. Without it a throw at *collection*
  time kills the whole file and vitest prints `(0)` — a suite of ~60
  assertions silently absent for weeks.
- **A test that can only see one file goes stale invisibly.** `does not send a
  width, because nothing reads one` was correct when written and inverted
  underneath by a later commit that gave `/design` a width control. Assert both
  ends.
- **`llms.txt` has two budgets**: curated core < 30,000, whole file < 64,000.
  If the core crosses, **prune the core** — do not move the number. The FAQ was
  moved below `## Optional` for exactly this.
- The `/r` route is noindex on purpose. See CRAWL-01.

---

## 9. Definition of done

Not "the tests pass". This:

1. `node scripts/verify-all.mjs` → 66/66
2. `pnpm test:web` → 852/852
3. All six live checks in §3 green — **including `verify:domain`, which reports
   zero failures once the retired domain is attached in Vercel (§2.1)**
4. `git fetch origin && git log --oneline -1 origin/main` shows your commit —
   reading the remote, not the local tree. A push that reports success and
   moves nothing is the failure that made that habit exist.
5. Production re-fetched and confirmed to serve the change.

Ship in that order. Never claim a step you did not run.
