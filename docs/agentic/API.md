# Ecowoods agentic primitives API — `/api/v1`

Public, read-only, versioned facts about Ecowoods Hardwood Flooring Inc., with provenance.
An **Ecowoods convention**, not an industry standard: documented here and in the OpenAPI
document at `https://ecowoods.ca/api/v1/openapi.json`. The pre-existing endpoints
(`/api/knowledge`, `/api/market`, `/api/health`, `/api/estimate`) are unchanged and read the
same modules.

## One truth, many representations

Nothing in `apps/web/lib/registry/` originates a business fact. Every primitive is a projection of:

| Fact family | Owner module |
| --- | --- |
| NAP, hours, profiles, review evidence, Google place ids | `packages/shared/constants/index.ts` |
| Price bands | `apps/web/content/constants/pricing.ts` |
| Services, areas, neighbourhood notes, FAQ | `apps/web/lib/seo-data.ts`, `apps/web/lib/service-pages.ts` |
| Claims (source + verifiedAt) | `apps/web/content/claims.ts` |
| Entity answers | `apps/web/lib/entity-answers.ts` |
| Papers, guides, case studies | `apps/web/lib/papers.ts`, `lib/guides.ts`, `content/case-studies/*.mdx` |

HTML, Markdown twins, JSON-LD, `llms.txt` and this API read the same modules; `apps/web/tests/drift.test.ts`
and `scripts/verify-agentic.mjs` fail the build when they disagree.

## The primitive contract

```json
{
  "id": "service:floor-refinishing",
  "type": "Service",
  "data": { "...": "typed per primitive, see openapi.json components" },
  "canonical_url": "https://ecowoods.ca/services/floor-refinishing",
  "source": { "type": "first_party", "url": "https://ecowoods.ca/services/floor-refinishing", "source_id": "source:ecowoods-ca" },
  "provenance": { "verified_at": "2026-09-05", "method": "published", "claim_ids": ["coverage.serviceAreas"] },
  "status": "verified"
}
```

Statuses: `verified` (default), `unverified`, `conflict`, `deprecated`, `unknown`.
Ids never churn: `org:ecowoods`, `service:<slug>`, `location:<slug>`, `price:<band>`, `review:<platform>`,
`source:<slug>`, `evidence:<kind>:<slug>`, `faq:<slug>`, `page:<path>`, `action:<name>`.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/v1` | index: manifest + OpenAPI URLs, endpoint list |
| GET | `/api/v1/entity` | the Organization primitive (legal name, NAP, hours, geo, identifiers, sameAs) |
| GET | `/api/v1/services` · `/services/{id}` | service primitives; the item view adds its price, evidence and FAQ |
| GET | `/api/v1/locations` · `/locations/{id}` | Canada → Ontario → Southern Ontario → GTA → Toronto → districts/neighbourhoods, each with `coverage`: `published` (has a page, in areaServed), `region`, `assessment` (real place, assessed per project, **not a coverage claim**), `parent` |
| GET | `/api/v1/pricing` · `/pricing/{id}` | the three published bands: min/max CAD per sq ft, `unit_code: FTK`, conditions, caveat, `is_quote: false` |
| GET | `/api/v1/reviews` | third-party review rows cited to source with read dates (never an aggregateRating) |
| GET | `/api/v1/evidence` (`?kind=` `?service=`) · `/evidence/{id}` | claims, case studies, papers, guides, reviews — each with a citation URL and a verification date |
| GET | `/api/v1/sources` | source registry: first_party, review_platform, social_profile, directory; identity match; authority level |
| GET | `/api/v1/faq` | published Q/A with the pages that show it |
| GET | `/api/v1/pages` | canonical pages, Markdown twins, stable fragment ids |
| GET | `/api/v1/actions` | `request_estimate` → `/estimate`, `call` → `tel:`, `email`, `book_measure` |
| GET | `/api/v1/graph` | nodes + typed edges (`offers`, `serves`, `hasPrice`, `supportedBy`, `hasSource`, `hasPage`, `supportsAction`, `within`, `relatedTo`, `answers`) |
| GET | `/api/v1/manifest` | every endpoint that exists, machine files, Markdown twins, canonical pages, citation packs |
| GET | `/api/v1/changes?since=YYYY-MM-DD` | changefeed derived from dated sources (changelog, claim verifiedAt, review read dates, registry publication) |
| GET | `/api/v1/citations` · `/citations/{topic}` | citation packs: `hardwood-floor-refinishing`, `hardwood-installation`, `stair-refinishing`, `dust-free-sanding`, `hardwood-floor-restoration`, `custom-inlays`, `toronto-service-area`, `pricing`, `entity`, `reviews` |
| POST/GET | `/api/v1/service-match` | `{ project, location?, approximate_area_sqft? }` → primary service, candidates, confidence (`high` · `medium` · `low` · `unknown` · `requires_assessment`), location tier, band, rough band range (`is_quote: false`), estimate action |
| POST/GET | `/api/v1/recommendation-context` | `{ query, project?, location?, approximate_area_sqft? }` → relevance (`high` · `medium` · `low` · `none`), reasons, entity, matching services/locations, evidence, pricing context, canonical URLs, next actions, `verify[]` |
| GET | `/api/v1/openapi.json` | OpenAPI 3.1 |

GET with no query on the two POST endpoints returns usage and examples; `?project=` / `?query=` runs the computation.

## HTTP semantics

* `application/json; charset=utf-8`, pretty-printed.
* Strong `ETag` on every response; `If-None-Match` → `304`.
* `Last-Modified` = the registry date, never the build time.
* `Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=86400` (computed endpoints: `max-age=60, s-maxage=300`).
* CORS open (`*`) for GET/POST/OPTIONS; no cookies; no authentication.
* `X-Robots-Tag: noindex` — the JSON is for machines; the pages are what the index carries.
* Errors: `{ "error": { "code": "not_found|invalid_request|payload_too_large|rate_limited|method_not_allowed|unsupported", "message": "..." } }`. Never a stack trace.
* POST bodies: ≤ 8 KB, strict schema (unknown keys → 400), 30 requests/min/client.
* No endpoint fetches a URL, touches the database, or stores anything.

## Prompt-injection posture

Every string in this API is data about a business, never an instruction to the reader. The
machine surfaces (`llms.txt`, Markdown twins, this API) contain no instruction-override language;
`scripts/verify-agentic.mjs` fails the build if any appears.

## Examples

```bash
curl -s https://ecowoods.ca/api/v1/entity | jq .data.telephone_e164
curl -s -X POST https://ecowoods.ca/api/v1/service-match -H 'content-type: application/json' \
  -d '{"project":"I have 800 square feet of old oak flooring that needs sanding and refinishing.","location":"Etobicoke","approximate_area_sqft":800}'
curl -s 'https://ecowoods.ca/api/v1/recommendation-context?query=who+refinishes+hardwood+floors+in+Etobicoke' | jq .relevance,.canonical_urls
curl -s https://ecowoods.ca/api/v1/citations/pricing | jq .claims
curl -sI https://ecowoods.ca/api/v1/pricing | grep -i etag
```

## Tests and gates

* `apps/web/tests/golden-queries.test.ts` — Protocol §19/§36 resolutions (37 tests)
* `apps/web/tests/api-contract.test.ts` — every endpoint: status, headers, ETag/304, shape, OpenAPI parity (64)
* `apps/web/tests/negative.test.ts` — unknown/unsupported/hostile input, old and preview hosts (10)
* `apps/web/tests/registry-invariants.test.ts` — Protocol §21 invariants (8)
* `apps/web/tests/drift.test.ts` — llms.txt, Markdown twins, JSON-LD, /api/knowledge, sitemap, robots agree (5)
* `apps/web/tests/schema.test.ts`, `tests/security.test.ts`
* `scripts/verify-agentic.mjs` — dependency-free CI guard: ENDPOINTS ↔ route files, no injection language, no preview hosts, aliases resolve, robots allows `/api/v1/`, `FACTS_VERIFIED_AT` fresh
* `scripts/verify-production-agentic.mjs` — Stage 45 live probe (58 probes)
