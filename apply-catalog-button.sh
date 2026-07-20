#!/usr/bin/env bash
set -euo pipefail
[[ -f pnpm-workspace.yaml && -d apps/web ]] || { echo "run from repo root"; exit 1; }
COMP=apps/web/app/components/FloorCatalog.tsx
CSS=apps/web/app/globals.css
node - "$COMP" <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
const a='      {mounted && open !== null && (';
const c=`      <div className="fc-cta-row">\n        <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>\n      </div>\n\n`;
if(!s.includes('fc-cta-row'))s=s.replace(a,c+a);
fs.writeFileSync(p,s);console.log('CTA present:',s.includes('fc-cta-row'));
NODE
node - "$CSS" <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
s=s.replace(/\n?\/\* === EW:FLOOR-CATALOG-CTA START === \*\/[\s\S]*?\/\* === EW:FLOOR-CATALOG-CTA END === \*\/\n?/g,'\n');
const b=`/* === EW:FLOOR-CATALOG-CTA START === */\n.fc-cta-row{display:flex;justify-content:center;margin-top:2.4rem;}\n.fc-cta-row .btn{min-width:300px;}\n@media(max-width:767px){.fc-cta-row{margin-top:1.6rem;}.fc-cta-row .btn{width:100%;min-width:0;}}\n/* === EW:FLOOR-CATALOG-CTA END === */`;
if(!s.endsWith('\n'))s+='\n';s+='\n'+b+'\n';fs.writeFileSync(p,s);console.log('CTA CSS present:',s.includes('EW:FLOOR-CATALOG-CTA'));
NODE
echo "Done."
