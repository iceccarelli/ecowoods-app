# Stage 2 — Domain and canonical forensics (live, 2026-09-05)

| Host / URL | Observed | Final | Verdict |
| --- | --- | --- | --- |
| https://ecowoods.ca | 200, canonical self, HSTS `max-age=63072000; includeSubDomains; preload` | — | canonical |
| https://www.ecowoods.ca/reviews | redirect | https://ecowoods.ca/reviews (title confirmed) | 301 per vercel.json host rule — OK |
| http://ecowoods.ca, http://www.ecowoods.ca | not directly observable from this environment (browser HSTS-upgrades; cloud egress blocks the host). HSTS preload header is served on the apex; vercel.json carries the www→apex 301. | — | expected 301/308 → https; verify with `curl -sI http://ecowoods.ca/` from an open-egress machine (scripts/agentic/07 does this via `pnpm seo:hosts`) |
| https://www.ecowoodshardwood.com/pages/home | **200**, `Flooring Company in Toronto…`, canonical `https://www.ecowoodshardwood.com/pages/home`, `robots: index, follow`, 0 links to ecowoods.ca | itself | **P0: duplicate indexable web entity on the retired domain.** Same phone. Fix is owner-side: DNS → Vercel (repo already carries 15 host-scoped 301s in vercel.json) or upload `old-domain/.htaccess`. Then `pnpm seo:domain` must report 0 failures. |
| https://ecowoods-app.vercel.app | (README 2026-09-04: 200 with a superseded build; not re-probed here — host not reachable from the sandbox and not in the desktop browser allow-list) | — | owner: delete/re-point the alias in the Vercel team that owns it; `pnpm seo:hosts` watches it |
| sitemap.xml | 126→129 URLs (adds /pricing, /estimate, /contact after deploy); every `<loc>` on https://ecowoods.ca | — | OK |
