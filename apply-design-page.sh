#!/usr/bin/env bash
# apply-design-page.sh — move the floor configurator off the landing page (2026-08-01)
# Run from the repo root: bash apply-design-page.sh
# Then: pnpm --filter web build   (green route table REQUIRED before deploy)
set -euo pipefail
cd "$(dirname "$0")"
echo "== EcoWoods: configurator -> /design =="

mkdir -p apps/web/app/design
cat > apps/web/app/design/page.tsx << 'DSG_EOF_8b1e4'
import type { Metadata } from 'next';
import Link from 'next/link';
import ConfiguratorSection from '../components/ConfiguratorSection';

export const metadata: Metadata = {
  title: 'Design Your Floor | EcoWoods',
  description:
    'Pick species, finish, pattern, and size — and see a live installed-price range built from the same numbers our estimator carries in the truck. Toronto & GTA.',
  alternates: { canonical: 'https://ecowoods.ca/design' },
  openGraph: {
    title: 'Design Your Floor — EcoWoods',
    description:
      'Configure your hardwood floor and see a live installed-price range. A range, not a quote — the fixed price is written after we measure your subfloor.',
    type: 'website',
    url: 'https://ecowoods.ca/design',
  },
};

export default function DesignPage() {
  return (
    <div className="tlx-page">
      <header className="tlx-hero">
        <div className="shell">
          <nav className="tlx-crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden>/</span>
            <span>Design Your Floor</span>
          </nav>
          <h1 className="tlx-title">The floor designer</h1>
          <p className="tlx-lede">
            Take your time here. When a combination feels right, one tap books the free
            in-home measure — or hands your exact configuration to RenoGuide. No retyping.
          </p>
        </div>
      </header>
      <ConfiguratorSection />
    </div>
  );
}
DSG_EOF_8b1e4
echo "wrote apps/web/app/design/page.tsx"

node << 'NODE_DSG_EOF_8b1e4'
const fs = require('fs');
const edit = (f, from, to, opt) => {
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes(to)) { console.log('skip (already applied):', f); return; }
  if (!s.includes(from)) {
    if (opt) { console.log('skip (anchor absent):', f); return; }
    throw new Error('ANCHOR NOT FOUND in ' + f + ': ' + JSON.stringify(from.slice(0, 60)));
  }
  fs.writeFileSync(f, s.replace(from, to));
  console.log('spliced:', f);
};

// 1. home-client: dynamic import out, teaser in
{
  const f = 'apps/web/app/home-client.tsx';
  let s = fs.readFileSync(f, 'utf8');
  const importRe = /const ConfiguratorSection = dynamic\(\(\) => import\('\.\/components\/ConfiguratorSection'\), \{[\s\S]*?\}\);\n/;
  if (importRe.test(s)) { s = s.replace(importRe, ''); console.log('spliced: removed dynamic import'); }
  const sectionFrom = `      {/* 5b · DESIGN YOUR FLOOR — sits between "look what we did" and "here are the
             specs". The gallery creates the want; the configurator lets them act on
             it while it is still warm, and hands the whole configuration to RenoGuide. */}
      <ConfiguratorSection />`;
  const sectionTo = `      {/* 5b · DESIGN YOUR FLOOR — teaser only. The full configurator lives at
             /design so the landing page stays short; researchers click through,
             buyers keep scrolling toward pricing and the estimate. */}
      <section className="section-tight" id="design">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '640px' }}>
            <span className="eyebrow">Design your floor</span>
            <h2>
              See it before we <span className="serif-italic">build it.</span>
            </h2>
            <p>
              Pick species, finish, and pattern — with a live installed-price range built from
              the same numbers our estimator carries in the truck.
            </p>
            <Link href="/design" className="btn btn-copper">
              Open the floor designer <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>`;
  if (s.includes(sectionTo)) { console.log('skip (teaser already in place)'); }
  else {
    if (!s.includes(sectionFrom)) throw new Error('configurator section anchor not found in home-client.tsx');
    s = s.replace(sectionFrom, sectionTo);
    console.log('spliced: teaser section');
  }
  if (!/import Link from 'next\/link';/.test(s)) {
    s = s.replace("import dynamic from 'next/dynamic';", "import dynamic from 'next/dynamic';\nimport Link from 'next/link';");
    console.log('spliced: Link import');
  }
  fs.writeFileSync(f, s);
}

// 2. ReadingProgress — configurator no longer a homepage waypoint
edit('apps/web/app/components/ReadingProgress.tsx',
  "  { id: 'configurator', label: 'Design Your Floor' },\n", '', true);

// 3. CommandPalette — navigate to /design
edit('apps/web/app/components/CommandPalette.tsx',
  "run: go('configurator')",
  "run: () => { close(); window.location.assign('/design'); }", true);

// 4. sitemap — /design as base page
edit('apps/web/app/sitemap.ts',
  `    {
      url: \`\${SITE_URL}/technical-library\`,`,
  `    {
      url: \`\${SITE_URL}/design\`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.85,
    },
    {
      url: \`\${SITE_URL}/technical-library\`,`);

console.log('splices done');
NODE_DSG_EOF_8b1e4

echo "== done — REQUIRED: pnpm --filter web build (route table must include /design) =="
