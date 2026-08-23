# ecowoodshardwood.com → ecowoods.ca — execute

**Measured state, 2026-08-23, by `node scripts/verify-domain-redirect.mjs`:**

| URL | responds |
| --- | --- |
| `https://www.ecowoodshardwood.com/` | **200** — a live page |
| `https://www.ecowoodshardwood.com/services/floor-refinishing` | **404** |
| `https://www.ecowoodshardwood.com/hardwood-flooring-toronto` | **404** |
| `https://www.ecowoodshardwood.com/framework` | **404** |
| `https://www.ecowoodshardwood.com/papers` | **404** |
| `https://www.ecowoodshardwood.com/reviews` | **404** |
| `https://www.ecowoodshardwood.com/service-areas/etobicoke` | **404** |

That is the worst of both worlds and it is costing you right now:

- A **second live homepage** for the same business competes with ecowoods.ca for
  the entity. Every search engine and every AI assistant resolving "who is
  Ecowoods" sees two websites and has to pick one.
- Every other path **404s**. Any link, directory listing, old business card or
  citation pointing at a deep URL on the old domain currently sends a person to
  a dead page and a crawler to nothing.

The redirects in `apps/web/next.config.js` cannot fix this. They only fire if
the domain resolves to this Vercel app, and it does not — it resolves to
whatever is serving that 200.

---

## Step 1 — ANSWERED: it is Apache

```
server: Apache/2.4.68 (Debian)
```

Measured 2026-08-23. **Use `.htaccess`. Skip to Step 2a.**

The identification procedure is kept below because it is the right first move on
any migration, and because a host can change under you.

### The original Step 1 — find out what is serving it. Thirty seconds.

Run this from your machine:

```bash
curl -sI https://www.ecowoodshardwood.com/ | grep -iE '^(server|x-powered-by|x-generator|cf-ray|x-vercel|x-github|location)'
curl -s  https://www.ecowoodshardwood.com/ | grep -oiE 'wp-content|wix|squarespace|shopify|webflow|godaddy|weebly' | sort -u | head
```

Match the answer to a row. **The right file is the only thing that changes.**

| What you see | Host | Use |
| --- | --- | --- |
| `Server: Apache`, or `wp-content` in the body | Apache / cPanel / WordPress | `.htaccess` |
| `Server: nginx` with shell access | nginx | `nginx.conf` |
| `Server: Vercel` / `x-vercel-id` | Vercel | attach the domain — see Step 2b |
| `Server: Netlify` | Netlify | `_redirects` |
| `wix` / `squarespace` / `shopify` / `weebly` in the body | Hosted builder | Step 2c — no file works |
| `cf-ray` present | Behind Cloudflare | Step 2d — do it at Cloudflare, it is the fastest option you have |
| Apache but `.htaccess` is ignored | Locked-down shared host | `index.php`, last resort |

---

## Step 2a — Apache, nginx, Netlify

1. Upload the matching file to the old domain's document root.
2. **Delete everything else in that root.** Old `index.html`, `index.php`,
   `robots.txt`, `sitemap.xml`, the whole previous site. A redirect that sits
   beside a live homepage is one misconfiguration away from serving it again,
   and an old `robots.txt` on the old domain can still be read by a crawler.
3. Keep the TLS certificate for the old domain renewing. An https request to a
   domain with an expired certificate fails at the TLS handshake **before** any
   redirect can be sent — the visitor gets a browser security warning, not your
   new site. This is the most common way a "completed" migration quietly breaks
   a year later.
4. Verify (Step 3).

## Step 2b — it is already on Vercel

Do not create a second project. Vercel → the `ecowoods-app` project → Settings →
Domains → add `ecowoodshardwood.com` and `www.ecowoodshardwood.com`. The rules in
`apps/web/next.config.js` fire on the first request after DNS propagates.

## Step 2c — Wix, Squarespace, Shopify, Weebly

No file you upload will work; these platforms do not read one. Two options:

- **Preferred:** move the domain's DNS to a host that does. Point it at the
  Vercel project (Step 2b) or at any cheap host running Apache with the
  `.htaccess`. You are not moving a website, only a redirect — any host will do.
- Or use the platform's own bulk-301 tool if it has one. Squarespace and Shopify
  both do. Wix's is limited and does not reliably preserve deep paths — check
  the result against Step 3 rather than trusting the interface.

## Step 2d — it is behind Cloudflare

Fastest path, and it needs no hosting at all. Cloudflare → the
`ecowoodshardwood.com` zone → **Rules → Redirect Rules → Create**:

- **When:** `Hostname` `contains` `ecowoodshardwood.com`
- **Then:** Dynamic redirect →
  Expression: `concat("https://ecowoods.ca", http.request.uri.path)`
- **Status:** `301`
- **Preserve query string:** ON

Then set both `ecowoodshardwood.com` and `www` to a proxied (orange-cloud) DNS
record — a redirect rule only runs on proxied traffic. This works even with no
origin server behind it at all.

---

## Step 3 — prove it. Do not skip this.

```bash
node scripts/verify-domain-redirect.mjs
```

It checks three things per path, and all three have to hold:

1. **301, not 302.** A 302 tells a crawler to keep the old URL indexed.
2. **The path survives.** `/services/floor-refinishing` must land on
   `/services/floor-refinishing`, not on `/`. Landing everywhere on the homepage
   is the single most common way this is done badly and it throws away most of
   the value.
3. **One hop.** `http → https → destination` is two, and it is what the naive
   "force HTTPS first" `.htaccess` produces. The files here avoid it by design.

Manual spot check:

```bash
curl -sI https://www.ecowoodshardwood.com/services/floor-refinishing | head -5
# want: HTTP/2 301
#       location: https://ecowoods.ca/services/floor-refinishing
```

---

## Step 4 — tell the search engines it was deliberate

Without this, a whole domain going 301 overnight can read as an outage.

- **Google Search Console:** add `ecowoodshardwood.com` as a property (it may
  already be one), then Settings → **Change of Address** → ecowoods.ca.
  This requires the redirect to already be live and verified.
- **Bing Webmaster Tools:** Site Move, same thing.
- **Directories:** update every listing that still names the old domain. The
  301 handles visitors; the listing itself is a citation and should carry the
  canonical address. See `docs/outreach/DIRECTORY_CONSISTENCY_CHECKLIST.md`.

---

## Never

- **Never remove these redirects.** They are permanent. A 301 that disappears
  turns every inbound link into a 404 years after anyone remembers why it was
  there. Renew the domain registration indefinitely; it costs less per year
  than one lead.
- **Never point the old domain at a marketing landing page.** Matching page, or
  homepage. Nothing else.
- **Never use a canonical tag instead of a redirect.** A canonical is a hint. A
  301 is an instruction. Use the instruction.
- **Never leave the old site "up for now, just in case."** That is the current
  state and it is the thing doing the damage.
