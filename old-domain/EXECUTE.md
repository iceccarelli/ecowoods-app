# Old domain — operational checklist

1. Point the retired domain's DNS (apex + `www`) at this Vercel project and
   attach both domains in Vercel → Settings → Domains. Then run `pnpm seo:domain`
   until it reports 0 failures. `old-domain/path-map.json` is the source; do
   not hand-edit `.htaccess`, `nginx.conf`, `_redirects` or `index.php` —
   regenerate them with `pnpm domain:build` and `pnpm domain:check`.

2. Update every directory listing's website field (YellowPages, 411.ca,
   TrustedPros, Bing Places, etc.) to `https://ecowoods.ca`.

3. Google Business Profile: confirm name, category, phone, website
   (`https://ecowoods.ca`), hours, services and photos are present, and that
   there is no duplicate listing.

4. Confirm the retired Vercel preview project is deleted or returns 404.
