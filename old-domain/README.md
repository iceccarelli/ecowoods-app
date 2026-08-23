# old-domain/ — the redirect, for whatever is hosting the old site

**Identified 2026-08-23:** `server: Apache/2.4.68 (Debian)`.
**The file you need is `.htaccess`.** Everything else here is for other stacks.

Measured state at the same moment: `www.ecowoodshardwood.com/` answers **200** —
a second live homepage for this business — and every deep path answers **404**.

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
