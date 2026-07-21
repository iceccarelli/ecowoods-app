// Post-deploy IndexNow submission. Reads both child sitemaps from the LIVE
// site and submits every URL, so it self-updates as service areas grow.
// Requires env: INDEXNOW_KEY (must match public/<key>.txt), optional SITE_URL.
const SITE = process.env.SITE_URL ?? "https://ecowoods.ca";
const KEY = process.env.INDEXNOW_KEY;

if (!KEY) {
  console.error("INDEXNOW_KEY not set; skipping.");
  process.exit(0);
}

const sitemaps = [`${SITE}/sitemap/0.xml`, `${SITE}/sitemap/1.xml`];
const urls = [];

for (const sm of sitemaps) {
  try {
    const res = await fetch(sm);
    if (!res.ok) { console.error(`WARN ${sm} -> ${res.status}, skipping`); continue; }
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].trim());
  } catch (e) {
    console.error(`WARN failed to fetch ${sm}: ${e.message}`);
  }
}

if (urls.length === 0) {
  console.error("No URLs found in sitemaps; skipping.");
  process.exit(0);
}

const host = new URL(SITE).host;
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host,
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList: urls,
  }),
});

console.log(`IndexNow: submitted ${urls.length} URLs -> HTTP ${res.status}`);
if (!res.ok) process.exit(1);
