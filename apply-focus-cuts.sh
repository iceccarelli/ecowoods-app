#!/usr/bin/env bash
# apply-focus-cuts.sh — homepage focus cuts (2026-08-01)
# 1) The Craft section removed (message folded into The Ecowoods Standard)
# 2) Content Library promo slimmed to 2 article cards and moved BELOW Pricing
# Run from repo root: bash apply-focus-cuts.sh
# Then: pnpm --filter web build (green route table REQUIRED before deploy)
set -euo pipefail
cd "$(dirname "$0")"
echo "== EcoWoods focus cuts =="

node << 'NODE_FOC_EOF_2e7c9'
const fs = require('fs');
const f = 'apps/web/app/home-client.tsx';
let s = fs.readFileSync(f, 'utf8');

// 1a. drop MachineCatalog import
const imp = "import MachineCatalog from './components/MachineCatalog';\n";
if (s.includes(imp)) { s = s.replace(imp, ''); console.log('removed MachineCatalog import'); }
else console.log('skip: import already gone');

// 1b. delete The Craft section
const craftRe = /      \{\/\* THE CRAFT — educational machine & tool gallery \*\/\}\n      <section className="section" id="craft">[\s\S]*?<\/section>\n\n/;
if (craftRe.test(s)) { s = s.replace(craftRe, ''); console.log('removed The Craft section'); }
else console.log('skip: Craft section already gone');

// 1c. fold the crew/equipment claim into the Standard intro
const stdFrom = `              Installation, refinishing, sanding, stairs, inlays, and commercial — every service,
              one shop, one accountable name — since 1998.`;
const stdTo = `              Installation, refinishing, sanding, stairs, inlays, and commercial — every service,
              one shop, one accountable name — since 1998. Our own salaried craftsmen on
              professional-grade equipment, dust-free by default.`;
if (s.includes(stdTo)) console.log('skip: Standard intro already enriched');
else if (s.includes(stdFrom)) { s = s.replace(stdFrom, stdTo); console.log('enriched Standard intro'); }
else throw new Error('Standard intro anchor not found');

// 2. move promo below Pricing
const promoFrom = `      {/* 5b · CONTENT LIBRARY — technical authority and proof */}
      {contentPromo}

      {/* 5c · PRICING — transparent range before the ask */}

      <PricingSection />
`;
const promoTo = `      {/* 5c · PRICING — transparent range before the ask */}

      <PricingSection />

      {/* 5d · CONTENT LIBRARY — for the researcher, after the price is on the
             table. Two article cards; never a detour before the ask. */}
      {contentPromo}
`;
if (s.includes(promoTo)) console.log('skip: promo already below Pricing');
else if (s.includes(promoFrom)) { s = s.replace(promoFrom, promoTo); console.log('moved promo below Pricing'); }
else throw new Error('promo/pricing anchor not found');

fs.writeFileSync(f, s);

// 3. Header nav: drop The Craft item
const h = 'apps/web/app/components/Header.tsx';
let hs = fs.readFileSync(h, 'utf8');
const navItem = "  { label: 'The Craft', href: '#craft' },\n";
if (hs.includes(navItem)) { fs.writeFileSync(h, hs.replace(navItem, '')); console.log('removed Craft nav item'); }
else console.log('skip: nav item already gone');

// 4. service-areas: retarget the dead #craft link
const sa = 'apps/web/app/service-areas/[city]/page.tsx';
let ss = fs.readFileSync(sa, 'utf8');
const linkFrom = 'and <Link href="/#craft">the machines behind the finish</Link>.';
const linkTo = 'and <Link href="/technical-library">the standards behind the finish</Link>.';
if (ss.includes(linkTo)) console.log('skip: service-area link already retargeted');
else if (ss.includes(linkFrom)) { fs.writeFileSync(sa, ss.replace(linkFrom, linkTo)); console.log('retargeted service-area link'); }
else throw new Error('service-area link anchor not found');
NODE_FOC_EOF_2e7c9

cat > apps/web/app/components/ContentLibraryPromo.tsx << 'FOC_EOF_2e7c9'
/**
 * ContentLibraryPromo — compact homepage strip surfacing the technical
 * library, rendered BELOW pricing: it serves the researcher after the
 * price is on the table, never as a detour before the ask.
 * Server component; styled with site tokens (.tlx-card / .clp-more).
 */
import Link from 'next/link';
import { getArticles } from '@/lib/content/loader';
import { formatDate } from '@/lib/content/utils';

export async function ContentLibraryPromo() {
  const articles = await getArticles();
  if (articles.length === 0) return null;

  const featured = articles.filter((a) => a.featured);
  const display = (featured.length > 0 ? featured : articles).slice(0, 2);

  return (
    <section className="section-tight paper-texture">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '640px' }}>
          <span className="eyebrow">Still researching?</span>
          <h2>
            The science behind <span className="serif-italic">the price.</span>
          </h2>
          <p>
            Moisture testing, finish chemistry, dust-free methodology — the technical standards
            the estimate is built on, documented from the job site.
          </p>
        </div>

        <div className="tlx-grid" style={{ marginTop: '2rem' }}>
          {display.map((article) => (
            <Link key={article.slug} href={`/blog/${article.slug}`} className="tlx-card">
              <span className="tlx-card-tag">
                {article.category ? article.category.replace(/-/g, ' ') : 'Article'}
              </span>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <span className="tlx-card-data">
                <span>{formatDate(article.publishedAt)}</span>
                {article.readingTimeMinutes ? <span>{article.readingTimeMinutes} min read</span> : null}
              </span>
            </Link>
          ))}
        </div>

        <Link href="/technical-library" className="clp-more">
          Browse the full technical library <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
FOC_EOF_2e7c9
echo "wrote ContentLibraryPromo.tsx (2 article cards, no case-study column)"

echo "== done — REQUIRED: pnpm --filter web build (green route table before deploy) =="
