#!/usr/bin/env bash
set -euo pipefail
[[ -f pnpm-workspace.yaml && -d apps/web ]] || { echo "run from repo root"; exit 1; }
node - apps/web/app/page.tsx <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
const line='      <SpecsCoverage species={speciesList} areas={serviceAreas} />';
const gi=s.indexOf('id="gallery"'),si=s.indexOf('<SpecsCoverage');
if(si!==-1&&gi!==-1&&si<gi){console.log('already in nav order — no change');process.exit(0);}
if(!s.includes(line)){console.error('SpecsCoverage line not found — aborting');process.exit(1);}
s=s.replace(line+'\n','');
const a='      {/* 5 · RESULTS — curated proof */}';
const inject='      {/* THE DETAIL — moved up so on-page order matches the nav (Species → Gallery). */}\n'+line+'\n\n';
if(!s.includes(a)){console.error('gallery anchor not found — aborting');process.exit(1);}
s=s.replace(a,inject+a);fs.writeFileSync(p,s);
console.log('reordered: Services → Species → Gallery → Process → Reviews → FAQ');
NODE
