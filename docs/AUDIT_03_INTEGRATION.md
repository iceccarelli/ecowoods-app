# AUDIT #3 — IS EVERYTHING REACHABLE, CALLABLE, AND ACTUALLY USED?

**Baseline:** `7678b10` (LIVE-01), live and verified.
**Method:** measured from source and from the shipped prompt. Where only
production can settle it, the probe is given rather than the answer.

> The instruction: *"be ruthless and cold blooded about this, do not hold back
> and do not sabotage your tests."*

---

## 0. WHAT THIS FOUND

Navigation, images and machine surfaces came back clean — NAV-03 and VIS-02 did
that work and the guards hold it. **Two real defects, both in the chatbot, and
one of them is the largest gap on the platform.**

| # | Finding | Class |
|---|---|---|
| **AS-01** | The assistant's 6,230-character system prompt names **zero** pages on this site, and not one of its five tools can hand a visitor one | **BROKEN** |
| **AS-02** | A page the assistant did recommend arrived as **inert text** — the bubble has no renderer, so the homeowner was told where to go and had to retype it | **BROKEN** |
| **AS-03** | On a phone under 379px wide, **the site search cannot be opened at all** | **BROKEN** |
| **AS-04** | `splitReply` would have rendered `ecowoods.ca.evil.example.com` with this company's name as a link | **BROKEN — caught by its own test before shipping** |

All four are closed in ASSIST-01.

---

## 1. AS-01 — the assistant did not know the website existed

### Measured against the shipped prompt

```
Floor Studio 0 · camera 0 · /design 0 · /pricing 0 · /quote-check 0 ·
framework 0 · service-areas 0 · corridors 0 · papers 0 · glossary 0 ·
samples 0 · photo triage 0            — 6,230 characters, zero paths
```

Its five tools — `get_company_context`, `estimate_project`, `get_availability`,
`book_measure`, `create_quote_request` — are every one of them transactional.
**Not one could return a page.**

So a homeowner who asked *"can I see what walnut would look like in my living
room"* got the six services and an offer of a measure — from a company whose
site will render walnut into a photograph of their living room, live, from their
phone camera, for free, and has since LIVE-01.

The prompt is not careless. It is 6,230 characters of genuinely good
instruction about voice, price honesty, prompt injection, and closing every
reply on something Ecowoods does. It was simply never told what had been built
around it. That is the gap between a booking bot and a front door.

### What closed it

`apps/web/lib/assistant-site.ts`, derived from `lib/navigation.ts` — the same
module the desktop panels, the mobile drawer and ⌘K read:

- **`siteCapabilitiesBlock()`** is appended to the system prompt at request
  time. `packages/shared` is upstream of `apps/web` and cannot import a route
  table, so the app appends what it knows rather than the prompt hard-coding it.
- **`find_on_site`**, a sixth tool. It searches the same destination set and
  returns real paths with the menu's own labels and notes. It **cannot** return
  a path the navigation does not carry, and cannot describe a page differently
  from the panel that links it.
- The headline features are **hrefs plus a trigger**, never labels — the words
  come from the navigation, so a page renamed in a menu is renamed in the
  assistant's mouth the same commit.

The live camera leads, and the block carries the honesty with it: *"it is
rendering, not generation, and that is why the price under it means
something."* One recommendation per reply, so a reply stays a reply.

---

## 2. AS-02 — a recommendation you had to retype

`ChatWidget.tsx` rendered `{m.content}` as a raw text node. The system prompt
forbids markdown, correctly — the bubble is 392px with no renderer, so `[a](b)`
arrives as literal brackets. Nobody followed that through to the consequence:
**a path the assistant named was inert.**

The widget now links the one shape the assistant is told to write,
`ecowoods.ca/<path>`, and nothing else. The parsing is a pure function in
`assistant-site.ts` so it can be held to a test, including the full stop:

```
'The bands are at ecowoods.ca/pricing.'
  → [{text: 'The bands are at '}, {path: '/pricing'}, {text: '.'}]
```

Without that trim the href is `/pricing.` — a 404, from the most common thing a
model writes.

---

## 3. AS-04 — the test that earned its keep

The first version of the matcher was:

```
/\b(?:https?:\/\/)?(?:www\.)?ecowoods\.ca(\/[\w\-._~\/#]*)?/g
```

Its own test — written to assert that no other domain becomes clickable — failed
on `ecowoods.ca.evil.example.com/pricing`. The href stayed internal, so it was
not an open redirect; what it did was **render this company's name as a link in
the middle of somebody else's hostname, inside this company's own chat window.**

A trailing `(?![A-Za-z0-9\-.])` fixes it: anything that could continue a
hostname means this is not our URL and no link is made. The case is asserted by
name and will fail if anyone loosens it.

---

## 4. AS-03 — search was unreachable on a small phone

| Width | Search trigger |
|---|---|
| ≥ 1460px | icon + "Search" + ⌘K badge |
| ≥ 1380px | icon + "Search" |
| ≥ 380px | icon only |
| **< 380px** | **`display: none`** |

An iPhone SE is 375px. A phone has no ⌘. The drawer listed the four top links,
two accordions, service areas, a price CTA and login — **no search**. So the
one control that reaches all 55 destinations had no way in on the handsets a
large share of this site's visitors use.

Fixed: a "Search this site" row in the drawer, opening the palette through a
window event rather than a ref threaded through a hamburger. AWS puts search in
the drawer for the same reason.

---

## 5. WHAT WAS MEASURED AND CAME BACK CLEAN

Recorded because an audit that only lists faults is not an audit.

| Question | Answer | Evidence |
|---|---|---|
| Every public route reachable? | **Yes, within 3 clicks** | `verify:navigation` — 56 routes, chrome 44, depth-3 count 0 |
| Orphans? | **3, all correct** | `/design/spec` in-flow, `/r` a short link, `/verify-email` an email flow |
| Every link lands where it claims? | **Yes** | `verify:destinations` — 643 links, 0 404s, 0 redirect hops, 0 retired domains |
| Every declared image on its page and serving? | **Yes** | `verify:images` 162/162 · live check 162 delivering |
| Two pages doing one job? | **No** | AUDIT-02: highest prose overlap between any two pages 12.6%, and that is shared chrome |
| Every API endpoint real? | **Yes** | `verify:agentic` — 36 endpoints ↔ 34 route files, 50 machine surfaces clean |
| Machine editions? | **20 surfaces, all serving** | `verify:markdown` · live check, bytes returned for each |
| Price stated twice anywhere? | **No** | `verify-pricing-source` — and it caught a price literal in *this audit's own test file*, which was removed rather than marked allowed |
| Header/footer/drawer agree? | **Yes, by construction** | one module, `lib/navigation.ts`, projected into all three plus ⌘K |

---

## 6. WHERE IT STANDS AGAINST aws.amazon.com

| AWS pattern | Here |
|---|---|
| Mega-panel showing the tree, not a link to a hub | **Yes** — two panels, hover bridge, close delay, click-to-pin, Escape, real anchors |
| Panel collapses to drawer accordions on mobile | **Yes** — same data, UI-NAV-01 |
| Search in the chrome, everywhere | **Yes, now** — header trigger + drawer row + ⌘K (AS-03) |
| A persistent primary CTA | **Yes** — phone pill + quote CTA, with the mobile sticky CTA taking over under 767px |
| Footer as a full sitemap | **Yes** — 43 links |
| Account / portal entry | **Yes** — login, My Page, Admin |
| Docs surface for machines | **Beyond it** — 20 markdown twins, llms.txt, ai.txt, `/api/knowledge`, 36 agentic endpoints |
| Region selector | **Yes, as of GEO-006** — the studio says which published bands it is pricing against, and the city pages link it with their own |

---

## 7. THE HONEST GRADE

**A. GC-026 is closed by GEO-006, and it was the last one.**

When this audit was written the grade was A−, and the missing grade had one
name: a homeowner in Amherst read a United States band on their city page and
was one tap from a tool that priced their floor in Canadian dollars. The studio
carries a region now — asked for and carried, never inferred — the 89 city pages
link it with their own, and the share code and the estimate handoff both take it
with them.

Every structural question in this audit answers yes, and the contradiction that
held the grade is gone. What remains is not a defect but a debt, recorded in the
log rather than hidden: the estimate fields are still named `…Cad` while
carrying whatever currency their band did. The values and every rendered figure
are correct — `currency` says which — and renaming them crosses `packages/shared`,
the chat tool, the estimate API and the lead schema, which is a patch of its own.

Open, and none of them a contradiction: GC-021 (job cards keyed by display
name) and GC-023 (cache windows). Domain consolidation is a repository-side
solved problem (redirect map, generated configs, live guards); attaching
`ecowoodshardwood.com` to the Vercel project is a dashboard step, not a commit.

---

## 8. PROBES FOR PRODUCTION

```bash
# the assistant now names pages — ask it something it used to have no answer for
curl -sS https://ecowoods.ca/api/chat -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"can I see what walnut looks like in my living room?"}]}' | tail -40
# expect: floor-studio named, with a path

# search reaches the corpus on a phone-width viewport
#   open https://ecowoods.ca on a 375px device, tap the hamburger,
#   expect a "Search this site" row, tap it, type "buffalo"

# the machine editions, one more time
for u in /floor-studio.md /design.md /pricing.md /corridors.md; do
  printf '%-20s %s\n' "$u" "$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' https://ecowoods.ca$u)"
done
```
