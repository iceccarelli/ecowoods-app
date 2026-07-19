#!/usr/bin/env bash
# apply-catalog-button.sh · EcoWoods
# Adds a native "Book your free in-home estimate" CTA under the floor catalog,
# so the #gallery section closes with a conversion action. Idempotent.
set -euo pipefail
[[ -f pnpm-workspace.yaml && -d apps/web ]] || { echo "✗ run from repo root"; exit 1; }
APP=apps/web/app
COMP=$APP/components/FloorCatalog.tsx
CSS=$APP/globals.css
[[ -f "$COMP" ]] || { echo "✗ $COMP not found — run apply-floor-catalog.sh first"; exit 1; }

echo "▸ Adding CTA button to FloorCatalog.tsx"
node - "$COMP" <<'NODE'
const fs=require('fs'); const p=process.argv[2]; let s=fs.readFileSync(p,'utf8');
const anchor='      {mounted && open !== null && (';
const cta=
`      <div className="fc-cta-row">
        <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
      </div>

`;
if(!s.includes('fc-cta-row')){ s=s.replace(anchor, cta+anchor); }
fs.writeFileSync(p,s);
console.log('  → CTA present:', s.includes('fc-cta-row'));
NODE

echo "▸ Adding CTA styles to globals.css"
node - "$CSS" <<'NODE'
const fs=require('fs'); const p=process.argv[2]; let s=fs.readFileSync(p,'utf8');
s=s.replace(/\n?\/\* === EW:FLOOR-CATALOG-CTA START === \*\/[\s\S]*?\/\* === EW:FLOOR-CATALOG-CTA END === \*\/\n?/g,'\n');
const block=`/* === EW:FLOOR-CATALOG-CTA START === */
.fc-cta-row { display: flex; justify-content: center; margin-top: 2.4rem; }
.fc-cta-row .btn { min-width: 300px; }
@media (max-width: 767px) { .fc-cta-row { margin-top: 1.6rem; } .fc-cta-row .btn { width: 100%; min-width: 0; } }
/* === EW:FLOOR-CATALOG-CTA END === */`;
if(!s.endsWith('\n')) s+='\n';
s+='\n'+block+'\n';
fs.writeFileSync(p,s);
console.log('  → CTA CSS present:', s.includes('EW:FLOOR-CATALOG-CTA START'));
NODE
echo "✅ Done. Restart dev if styles don't hot-reload."
