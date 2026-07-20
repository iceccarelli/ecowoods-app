#!/usr/bin/env bash
# apply-section-order.sh · EcoWoods
# Reorders the homepage so the DOM matches the nav bar's promised sequence:
#   Services → Species → Gallery → Process → Reviews → FAQ → Quote
# Moves <SpecsCoverage> (the #species "Detail" block) up to just after
# #services, so #gallery sits at its nav position (03) and scroll-spy is
# correct. Idempotent & safe to re-run.
set -euo pipefail
[[ -f pnpm-workspace.yaml && -d apps/web ]] || { echo "✗ run from repo root"; exit 1; }
PAGE=apps/web/app/page.tsx
[[ -f "$PAGE" ]] || { echo "✗ $PAGE not found"; exit 1; }

echo "▸ Reordering sections in page.tsx to match nav order"
node - "$PAGE" <<'NODE'
const fs = require('fs');
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');

const specsLine = '      <SpecsCoverage species={speciesList} areas={serviceAreas} />';
const galleryMark = 'id="gallery"';

const gi = s.indexOf(galleryMark);
const si = s.indexOf('<SpecsCoverage');
if (si !== -1 && gi !== -1 && si < gi) {
  console.log('  → already in nav order (Species before Gallery) — no change');
  process.exit(0);
}
if (!s.includes(specsLine)) {
  console.error('  ✗ could not find the SpecsCoverage line to move — aborting, no changes made');
  process.exit(1);
}

// 1. remove SpecsCoverage from its current spot (keep ConfiguratorSection where it is)
s = s.replace(specsLine + '\n', '');

// 2. insert it right before the gallery section, after #services closes
const anchor = '      {/* 5 · RESULTS — curated proof */}';
const inject =
  '      {/* THE DETAIL — species & coverage. Placed here so on-page order matches\n' +
  '             the nav (Services → Species → Gallery → …) and scroll-spy stays in sync. */}\n' +
  specsLine + '\n\n';
if (!s.includes(anchor)) {
  console.error('  ✗ could not find the gallery section anchor — aborting'); process.exit(1);
}
s = s.replace(anchor, inject + anchor);

fs.writeFileSync(p, s);

// report resulting order
const order = [];
for (const m of s.matchAll(/id="(services|species|gallery|process|reviews|faq|quote)"/g)) order.push(m[1]);
console.log('  → new section order:', order.join(' → '));
NODE
echo "✅ Done. Restart dev to see the reordered page."
