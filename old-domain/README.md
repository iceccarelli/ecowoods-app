# old-domain/ — the redirect, for whatever is hosting the old site

**Identified 2026-08-23:** `server: Apache/2.4.68 (Debian)`.
**The file you need is `.htaccess`.** Everything else here is for other stacks.

## Measured 2026-08-24 — this is worse than the line below it recorded

`www.ecowoodshardwood.com/` answers **200**, and so does
`www.ecowoodshardwood.com/services`. Not a leftover homepage: a **complete,
navigating website for this business**, with its own About, Services,
Testimonials and Blog sections, the same phone number as ecowoods.ca, and
titles written to rank:

| URL | title it is competing on |
| --- | --- |
| `/` | Portfolio \| Hardwood Floor **Repair** in Toronto, Vaughan, Markham |
| `/services` | Hardwood Floor Installation, Refinishing in Toronto, Hamilton ON |

Four consequences, in descending order of how much they cost:

1. **Two live sites for one business.** Google has to choose which is the
   entity, and it is being handed contradictory evidence by both.
2. **The old one is competing on the highest-intent cluster.** Its homepage
   title targets *hardwood floor repair* — the exact query family
   `/hardwood-floor-problems-toronto` was written for.
3. **It publishes no prices.** An answer engine that lands there learns this is
   a company that does not publish pricing, which is the opposite of the entire
   positioning of ecowoods.ca, and it is one of the two pages an agent is most
   likely to reach from an old citation.
4. **Every inbound link, directory entry and citation pointing at it passes
   nothing** to ecowoods.ca.

**The earlier measurement below is stale and reading it will mislead you.** It
recorded "every deep path answers 404", which suggested the migration was nearly
done and only the homepage was left. Deep paths serve. Nothing about this has
been fixed since 2026-08-23; it has been re-measured and it is bigger than it
looked.

`node scripts/verify-domain-redirect.mjs` reports every one of these correctly
and has never been run from a machine with open egress. Run it.

---

### Superseded — measured 2026-08-23

`www.ecowoodshardwood.com/` answers **200** — a second live homepage for this
business — and every deep path answers **404**.

| file | for |
| --- | --- |
| **`.htaccess`** | **Apache, cPanel, most WordPress hosting — this one** |
| `nginx.conf` | nginx with shell access |
| `_redirects` | Netlify |
| `index.php` | last resort, where a host ignores config files |
| — | Cloudflare: a Redirect Rule, no file and no hosting needed — `EXECUTE.md` §2d |
| — | Wix / Squarespace / Shopify: **no uploaded file works.** DNS must move — §2c |

`EXECUTE.md` has the full runbook: upload, empty the document root, keep the TLS
certificate renewing, then the Search Console and Bing change-of-address filings
without which a whole domain going 301 reads as an outage.

## There is no vercel.json here, on purpose

If the old domain ever goes onto Vercel, **do not create a second project.** Add
it to the existing `ecowoods-app` project — Settings → Domains — and it is
already handled twice: the repo-root `vercel.json` carries host-scoped edge
redirects, and `apps/web/next.config.js` carries the same rules as a fallback.

A standalone `vercel.json` used to sit in this folder and it was deleted, because
it is a loaded gun. Its rule is:

```json
{ "source": "/:path*", "destination": "https://ecowoods.ca/:path*", "permanent": true }
```

Correct in a project serving only the old domain. **Catastrophic pasted into the
main project's `vercel.json`** — with no host condition it matches every request
on ecowoods.ca and redirects the site to itself. A 301 loop is cached by browsers
and CDNs, so it outlives the rollback that fixes it.

`scripts/verify-vercel-config.mjs` fails the build on exactly that paste.

## Prove it, always

```bash
pnpm verify:domain
```

301, path preserved, one hop — all three, on every path. Until it reports zero
failures, do not file a change of address: telling Google a move happened while
the old site still answers 200 is worse than saying nothing.
