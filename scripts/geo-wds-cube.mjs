#!/usr/bin/env node
/**
 * scripts/geo-wds-cube.mjs — print a Statistics Canada cube's dimensions and
 * members from the official Web Data Service, so ingestion filters are written
 * against the real member names and not remembered ones. Read-only.
 *
 *   node scripts/geo-wds-cube.mjs 98100060 98100240 98100257
 */
const WDS = 'https://www150.statcan.gc.ca/t1/wds/rest';

export function summariseCube(meta, cap = 60) {
  const o = meta.object;
  const dims = (o.dimension ?? []).map((d) => ({
    id: d.dimensionPositionId,
    name: d.dimensionNameEn,
    members: (d.member ?? []).length,
    sample: (d.member ?? []).slice(0, cap).map((m) => `${m.memberId}:${m.memberNameEn}`),
  }));
  return { productId: o.productId, title: o.cubeTitleEn, start: o.cubeStartDate, end: o.cubeEndDate, dims };
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => /^\d{8}$/.test(a));
  if (!ids.length) throw new Error('give one or more 8-digit product ids');
  for (const id of ids) {
    const res = await fetch(`${WDS}/getCubeMetadata`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'user-agent': 'ecowoods-geo-ingest/1.0 (+https://ecowoods.ca)' },
      body: JSON.stringify([{ productId: Number(id) }]),
    });
    if (res.status !== 200) throw new Error(`getCubeMetadata ${id}: HTTP ${res.status}`);
    const body = await res.json();
    if (body[0]?.status !== 'SUCCESS') throw new Error(`getCubeMetadata ${id}: ${JSON.stringify(body[0]).slice(0, 200)}`);
    const s = summariseCube(body[0]);
    console.log(`\n=== ${s.productId} ${s.title} (${s.start}..${s.end})`);
    for (const d of s.dims) {
      console.log(`  [${d.id}] ${d.name} — ${d.members} member(s)`);
      if (!/geography/i.test(d.name)) for (const m of d.sample) console.log(`      ${m}`);
    }
  }
}
if (process.argv[1] === new URL(import.meta.url).pathname) await main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
