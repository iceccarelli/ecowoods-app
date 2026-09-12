# AUDIT #2 — THE TREE, THE IMAGES, AND THE AI

Four questions, answered by measuring rather than asserting.

**Baseline:** `main` after AUDIT-01 + NAV-03.
**Method:** every number below comes from a script run against the source. Where
a question can only be settled against production, the probe is given rather
than the answer.

---

## Q1. "Are there two similar web pages inside ecowoods.ca?"

**Measurably, no — and I looked hard.**

Prose was extracted from all 58 public route templates (page file plus its
siblings), normalised, and compared as 4-word shingles, Jaccard:

| Pair | Overlap |
|---|---|
| `/guides/[slug]` ↔ `/services/[slug]` | **12.6%** |
| everything else | below 12% |

12.6% between two *templates* is shared chrome — breadcrumb, CTA, next-step
rail — not shared content. **No pair of pages on this site tells the same story.**

- Identical `<title>`: none, except the `notFound()` fallback on two dynamic routes.
- Identical meta description: **none**.

### But the tree had a wing the navigation never named

The real risk was never duplicate prose. It is two pages doing one job — which
is the thing you have caught twice already (`/floor-studio` vs `/design`, and
the three geography-shaped pages). One more was hiding:

| Page | What it says it is | Where it appeared |
|---|---|---|
| `/resources` | *"Everything we publish, organised by what you are trying to do"* | the **Reference** column of the Library menu |
| `/technical-library` | *"The engineering reference behind our work"* | **no menu at all** |

They are not duplicates — a front door and a wing. But:

- `ArticleLayout.tsx:29` makes `/technical-library` the **breadcrumb parent of
  every article on the site**
- `sitemap.ts:150` gives it **priority 0.95**
- `/resources` links *down* to it as a sub-item, and it links back to nothing
- and the navigation named neither the relationship nor the page

So a visitor who followed a breadcrumb up from any article landed on a page the
menu could not show them the position of. **Fixed:** the Reference column now
names both, with notes that say which is which — the same fix UI-NAV-02 made for
`/floor-studio` and `/design`, for the same reason: the labels alone read as
duplicates, the notes do not.

### The tree, as it now stands

- 58 public routes, every one within **3 clicks** of the homepage (`verify:navigation`)
- **55 destinations** in the chrome, projected from one module into the desktop
  panels, the mobile drawer and ⌘K
- orphans — reachable from no other page and no menu: **3**, all correct:
  `/design/spec` (reached in-flow from the configurator), `/r` (a short link),
  `/verify-email` (an email flow)

---

## Q2. "Are all the images displayed where they are supposed to be?"

**Now yes. Five were not, and they were the five that mattered most.**

`verify:images` passed at the baseline, and it was right about what it checks:
no slot is declared, bundled and sitemapped without a page drawing it. What it
does not check is the **share card** — the image a page hands to WhatsApp,
iMessage, Slack, LinkedIn and every AI crawler that reads Open Graph.

Measured across all 55 public routes: **24 declared their own `openGraph.images`;
31 did not.** Most of the 31 are correct to inherit the site default. Five were
not:

| Page | What it is | Card it served |
|---|---|---|
| `/hardwood-flooring-toronto` | the installation head term | site default |
| `/hardwood-floor-refinishing-toronto` | the refinishing head term | site default |
| `/hardwood-stairs-toronto` | the stairs head term | site default |
| `/hardwood-floor-problems-toronto` | the problems head term | site default |
| `/floor-studio` | the flagship feature | site default |

Each carried a full `openGraph` block — title, description, type, url — and no
`images` key. So sharing the single most commercially valuable page on this site
produced a card **identical to sharing the privacy policy**.

**Fixed.** Five new cards, drawn in the same flat schematic language as the nine
VIS-01 added — cream field `#FAF7EF`, the brand's dark/green/copper, subject in
the left forty percent, right third left empty because the platform lays its own
title over it:

| Slot | One idea |
|---|---|
| `og-installation` | five courses of plank with staggered end joints, the starting course in copper |
| `og-refinishing` | three abrasive passes coarse → fine, then one clean finish bar |
| `og-stairs` | a four-step section with treads picked out from risers |
| `og-problems` | five board cross-sections, five failures, one subfloor line under all of them |
| `og-floor-studio` | a floor plane in perspective with chevron laid into it and a handle at each corner |

`verify:images` — **162 slots, 162 on disk, 0 pending, 0 orphans.**

Structurally checked by brace depth on all five: `images` is a direct child of
`openGraph`, never nested. That is the VIS-01a bug and it cost a build once.

---

## Q3. "Are the AI and camera features accessible to all customers?"

Partly. This is the honest column, and AUDIT-01 already established most of it.

| Capability | Reaches | Note |
|---|---|---|
| EcowoodsGuide chat | **every page** | `layout.tsx:185`, `<ChatWidgetLoader />` |
| ⌘K, with the whole corpus | **every page** | NAV-03; it reached almost nothing before |
| Floor Studio | **every page** | header + footer + Start-here column, depth 0 |
| Native camera capture | **phones** | `capture="environment"` on a file input — real camera on iOS/Android, a silent file picker on desktop |
| Live camera preview / AR | **nobody** | no `getUserMedia` exists in this repository |
| Segmentation, depth, surface normals | **nobody** | no model, no weights, no inference |
| Recommendations with reasons | **every visitor** | `match.ts` — no score without a sentence under it |
| Live installed range | **every visitor** | one price source (GEO-005) |
| Priced in the visitor's currency | **Canadians only** | GC-026 — 26 New York markets get CAD |

Two things are worth naming plainly rather than counting as "accessible":

- **The occlusion defect (AV-01) reaches everyone who uploads a photo.** Six of
  fourteen tested objects are painted over completely, including a person's leg,
  a light-coloured dog and a jute rug.
- **`measured` is claimed where it is not true (AV-02)** — 72% error in a room
  with a rug, which is most rooms.

Neither is a reachability problem. Both are in the fix queue, and neither is
made better by more people finding the feature.

---

## Q4. "Is it the best proposition, the best suggestions, the best price ranges?"

The parts that are structurally right, and are unusual in this market:

- **One price source.** Every figure on every surface — the studio, `/design`,
  `/pricing`, the chat's estimate tool, the API — comes from
  `content/constants/pricing.ts`, enforced by `verify-pricing-source`.
- **No number without a sentence.** Every match percentage carries the reasons
  that produced it and the caveats against it.
- **Nothing is called a quote.** The figure is a labelled range on every screen
  it appears on, and the fixed price is written after the measure.
- **It refuses to estimate what it cannot measure**, and says why next to the
  field it asks instead.

What stops this being "the best in the world" today is three named defects, not
a missing feature: **AV-01**, **AV-02**, **GC-026**. Each is in the queue with a
patch attached.

---

## The probes — run these against production

These need egress this session does not have.

```bash
# 1. the five new share cards are distinct and live
for u in /hardwood-flooring-toronto /hardwood-floor-refinishing-toronto \
         /hardwood-stairs-toronto /hardwood-floor-problems-toronto /floor-studio; do
  printf '%-38s %s\n' "$u" \
    "$(curl -sS https://ecowoods.ca$u | grep -o 'og:image[^>]*content="[^"]*"' | head -1 | grep -o '[^/]*\.webp')"
done
# expect five DIFFERENT filenames, none of them the site default

# 2. no page shares a card with another
node scripts/crawl-site.mjs && node -e "
const c=require('./audit/site-crawl.json');
const m=new Map(); for(const p of c.pages||[]) if(p.ogImage) m.set(p.ogImage,[...(m.get(p.ogImage)||[]),p.url]);
for(const [img,us] of m) if(us.length>3) console.log(us.length, img);
"

# 3. the whole tree, as a crawler sees it
node scripts/crawl-site.mjs --strict
```
