# Consolidating ecowoodshardwood.com into ecowoods.ca

**Status as measured 2026-09-09: not done.** `pnpm verify:domain` reports
**35 failures, 0 correct.** Every one of those URLs returns HTTP 200 — a second
live website for this business, competing with ecowoods.ca for the same entity,
served by `Apache/2.4.68 (Debian)`.

Twenty-two of them are individual customer testimonials with real names. They
are the largest stranded reputation asset this business has, and they are
currently doing nothing except splitting the entity.

This file is the mechanical procedure. `docs/outreach/DOMAIN_CONSOLIDATION.md`
is why it is being done this way.

---

## Choose a route

The redirects are already generated, from one source (`old-domain/path-map.json`)
into four targets. You are choosing where they get executed, not what they say.

| | Route A — Vercel | Route B — Apache |
|---|---|---|
| Needs | Vercel access | shell/FTP on the old host |
| Rules already deployed | **yes**, in `vercel.json` | no — upload `.htaccess` |
| Changes DNS | yes | no |
| Old host afterwards | can be shut off | keeps running |

**Route A is the one to take** unless somebody wants the old server kept alive.
The rules are already in `vercel.json`, host-conditioned on
`(www\.)?ecowoodshardwood\.com`, and they are already deployed. They do nothing
today for exactly one reason: the domain is not attached to the project, so no
request for it ever reaches them.

---

## Route A — attach the domain to this Vercel project

```bash
vercel whoami                      # must print your account, not "Not authorized"
vercel domains ls
vercel domains add ecowoodshardwood.com
vercel domains add www.ecowoodshardwood.com
```

Vercel prints the DNS records to set. Set them at the registrar for
`ecowoodshardwood.com`. This is the step that takes the old Apache box out of
the path, so do not do it while anything else you care about is served from
that host — check first:

```bash
curl -sI https://www.ecowoodshardwood.com/ | head -5
```

Propagation is usually minutes. Then verify (next section). Nothing needs
deploying: the redirect rules shipped with the last build.

If `vercel domains add` refuses because the domain is attached to another
Vercel project or team, remove it there first — a domain lives in one project.

## Route B — upload the Apache config

The old host answers as `Apache/2.4.68 (Debian)`, so `.htaccess` is the file.

```bash
# from the repository root
scp old-domain/.htaccess <user>@<old-host>:<docroot>/.htaccess
```

Then confirm on that host that `AllowOverride` permits it and `mod_rewrite` is
loaded — an `.htaccess` in a directory with `AllowOverride None` is silently
inert, which looks identical to not having uploaded it:

```bash
ssh <user>@<old-host> 'apache2ctl -M | grep rewrite'
```

`old-domain/nginx.conf` and `old-domain/_redirects` are the same map for nginx
and for Netlify, if the host ever changes. `old-domain/index.php` is the
last-resort version for a host that allows neither.

**Never hand-edit any of those four.** They are generated:

```bash
pnpm domain:build      # regenerate from old-domain/path-map.json
pnpm domain:check      # fails the build if they have drifted
```

---

## Verify — this is the only thing that counts

```bash
pnpm verify:domain
```

It fetches all 36 old URLs and asserts each lands on the path
`old-domain/path-map.json` says it should, in **one** 301 hop.

```
✓ 36 correct, 0 failure(s)
```

Spot-check by hand, and note `-I` follows nothing, so you see the hop itself:

```bash
curl -sI "https://www.ecowoodshardwood.com/blogs/testimonials/172376--audrey-in-toronto" | head -3
# HTTP/1.1 301 Moved Permanently
# Location: https://ecowoods.ca/reviews
```

Three things to check on that output, all of which have gone wrong on other
migrations:

1. **301, not 302.** A 302 tells a crawler to keep the old URL indexed, which is
   the opposite of consolidating.
2. **One hop.** If it lands on an http URL that then redirects to https, that is
   two hops and it dilutes what is passed. The generated config forces the
   scheme in the same rule for this reason.
3. **The destination is not a 404.** Path-preserving redirects would send every
   one of these to a 404 on ecowoods.ca, because the two sites share no paths.
   That is the entire reason `path-map.json` exists.

---

## After it reports zero failures

Only then, and in this order:

1. **Google Search Console → Change of address**, from the old property to
   `ecowoods.ca`. Filing this while the old site still answers 200 is worse than
   filing nothing: it tells Google a move happened that measurably has not.
2. **Bing Webmaster Tools → Site Move.**
3. Submit `https://ecowoods.ca/sitemap.xml` under the new property if it is not
   already there.
4. Leave the redirects in place permanently. A 301 is not a task that completes;
   links to those URLs exist in other people's pages, and in Google's index, for
   years.

Do not delete the old DNS zone or the old hosting for at least twelve months.
The redirect is the only thing carrying that equity across.

---

## What "done" looks like

```bash
pnpm verify:domain          # ✓ 36 correct, 0 failure(s)
pnpm verify:live            # the "old domain consolidation" section stops warning
```

Both are also part of `pnpm seo:live`, which is the post-deploy check.
