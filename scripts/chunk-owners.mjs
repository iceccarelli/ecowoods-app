#!/usr/bin/env node
/**
 * Prints which client modules own a given JS chunk, from the production build's
 * client-reference manifests, so a heavy chunk named in the Lighthouse summary
 * (e.g. "9061-487aa46cc6cb2bc3.js") can be traced to source files.
 *
 *   node scripts/chunk-owners.mjs apps/web/.next 9061 18
 *
 * Reads .next/server/app/**\/*client-reference-manifest.js, whose clientModules
 * map each client module's path to the chunk files it needs.
 */
import fs from 'node:fs';
import path from 'node:path';

const [dir = 'apps/web/.next', ...ids] = process.argv.slice(2);
const root = path.join(dir, 'server', 'app');

function* manifests(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* manifests(p);
    else if (e.name.endsWith('client-reference-manifest.js')) yield p;
  }
}

const owners = new Map(ids.map((id) => [id, new Set()]));
let read = 0;
for (const file of manifests(root)) {
  const src = fs.readFileSync(file, 'utf8');
  // globalThis.__RSC_MANIFEST["/page"]={...} — the object runs to the end of the file.
  const head = /__RSC_MANIFEST\["[^"]*"\]\s*=\s*/.exec(src);
  if (!head) continue;
  let manifest;
  try {
    manifest = JSON.parse(src.slice(head.index + head[0].length).replace(/;\s*$/, ''));
  } catch (e) {
    console.log(`could not parse ${path.relative(dir, file)}: ${e.message}`);
    continue;
  }
  read++;
  for (const [modPath, mod] of Object.entries(manifest.clientModules ?? {})) {
    for (const chunk of mod.chunks ?? []) {
      for (const id of ids) if (path.basename(String(chunk)).startsWith(`${id}-`)) owners.get(id).add(modPath.replace(/^.*\/apps\/web\//, ''));
    }
  }
}
console.log(`client-reference manifests read: ${read}`);
for (const [id, set] of owners) {
  console.log(`chunk ${id}-*.js is needed by ${set.size} client module(s):`);
  for (const m of [...set].sort().slice(0, 40)) console.log(`  ${m}`);
}
