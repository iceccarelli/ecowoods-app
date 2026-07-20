#!/usr/bin/env bash
# apply-hide-species.sh · EcoWoods
# Hides "The Detail" (SpecsCoverage / #species) from the page WITHOUT deleting it —
# the component, data, and render line are all kept (commented) for easy re-enable.
# Also comments the now-dead "Species" nav link so it doesn't scroll to nothing.
# Idempotent.
set -euo pipefail
[[ -f pnpm-workspace.yaml && -d apps/web ]] || { echo "X run from repo root"; exit 1; }
P=apps/web/app/page.tsx
H=apps/web/app/components/Header.tsx

echo ">> Hiding SpecsCoverage render in page.tsx"
node - "$P" <<'NODE'
const fs=require('fs'); const p=process.argv[2]; let s=fs.readFileSync(p,'utf8');
const live='      <SpecsCoverage species={speciesList} areas={serviceAreas} />';
const hidden='      {/* SpecsCoverage ("The Detail") intentionally hidden — kept for later.\n'
  + '          Re-enable by uncommenting the next line. */}\n'
  + '      {/* <SpecsCoverage species={speciesList} areas={serviceAreas} /> */}';
if (s.includes(live)) { s=s.replace(live, hidden); console.log('   -> section hidden'); }
else if (s.includes('intentionally hidden')) console.log('   -> already hidden (no change)');
else console.log('   ! render line not found — check manually');
fs.writeFileSync(p,s);
NODE

echo ">> Commenting the dead Species nav link in Header.tsx"
node - "$H" <<'NODE'
const fs=require('fs'); const p=process.argv[2]; let s=fs.readFileSync(p,'utf8');
const live="  { label: 'Species', href: '#species' },";
const off ="  // { label: 'Species', href: '#species' }, // hidden with The Detail section";
if (s.includes(live)) { s=s.replace(live, off); console.log('   -> Species nav link commented'); }
else if (s.includes('hidden with The Detail')) console.log('   -> already commented (no change)');
else console.log('   ! nav line not found — check manually');
fs.writeFileSync(p,s);
NODE
echo "OK  Done. rm -rf apps/web/.next && pnpm --filter web dev"
