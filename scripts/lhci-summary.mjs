#!/usr/bin/env node
/**
 * Prints what a Lighthouse CI run actually measured, from the raw reports in
 * .lighthouseci/lhr-*.json, so it can be read in the job log: the reports are
 * uploaded to temporary public storage, which is not reachable from every
 * environment, and the assertion output only names failed thresholds.
 *
 *   node scripts/lhci-summary.mjs [dir]     (default .lighthouseci)
 *
 * Per URL it takes the run with the median performance score and prints the
 * LCP value and element, total transfer weight, the heaviest requests, the
 * scripts with the most execution time and any render-blocking resources.
 */
import fs from 'node:fs';
import path from 'node:path';

export function summarise(lhr) {
  const a = lhr.audits ?? {};
  const items = (id) => a[id]?.details?.items ?? [];
  const kb = (n) => `${Math.round((n ?? 0) / 1024)} kB`;
  const short = (u) => String(u).replace(/^https?:\/\/[^/]+/, '').slice(0, 90);
  const lcpNode =
    items('largest-contentful-paint-element')[0]?.items?.[0]?.node ??
    findNode(a['lcp-breakdown-insight']?.details) ??
    findNode(a['lcp-discovery-insight']?.details);
  return {
    url: lhr.finalDisplayedUrl ?? lhr.requestedUrl,
    performance: lhr.categories?.performance?.score ?? null,
    lcp_ms: Math.round(a['largest-contentful-paint']?.numericValue ?? 0),
    tbt_ms: Math.round(a['total-blocking-time']?.numericValue ?? 0),
    cls: Number((a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
    lcp_element: lcpNode ? `${lcpNode.nodeLabel ?? ''} ${lcpNode.snippet ?? ''}`.trim().slice(0, 160) : null,
    total_transfer: kb(a['total-byte-weight']?.numericValue),
    heaviest_requests: items('network-requests')
      .filter((r) => r.transferSize)
      .sort((x, y) => y.transferSize - x.transferSize)
      .slice(0, 8)
      .map((r) => `${kb(r.transferSize)}  ${short(r.url)}`),
    script_time: items('bootup-time')
      .slice(0, 8)
      .map((r) => `${Math.round(r.total)} ms (script ${Math.round(r.scripting ?? 0)})  ${short(r.url)}`),
    failed_requests: countRepeats(
      items('network-requests')
        .filter((r) => r.statusCode >= 400)
        .map((r) => `${r.statusCode}  ${short(r.url)}`),
    ),
    lcp_phases: lcpPhases(a['lcp-breakdown-insight']?.details),
    failing_audits: failingAudits(lhr),
    render_blocking: items('render-blocking-resources').map((r) => `${kb(r.totalBytes)}  ${short(r.url)}`),
  };
}

/** First DOM node described anywhere inside an audit's details (the report layout differs by Lighthouse version). */
function findNode(v) {
  if (!v || typeof v !== 'object') return undefined;
  if (v.type === 'node' && (v.nodeLabel || v.snippet)) return v;
  for (const child of Array.isArray(v) ? v : Object.values(v)) {
    const hit = findNode(child);
    if (hit) return hit;
  }
  return undefined;
}

/** The LCP time split into its phases, where the report carries it. */
function lcpPhases(details) {
  const rows = (details?.items ?? []).flatMap((i) => (i?.type === 'table' ? i.items ?? [] : [i]));
  const parts = rows
    .filter((r) => r && typeof r === 'object' && r.label && typeof r.duration === 'number')
    .map((r) => `${r.label}: ${Math.round(r.duration)} ms`);
  return parts.length ? parts : null;
}

/** Performance audits that did not pass, worst first, with Lighthouse's own estimate of what fixing each saves. */
function failingAudits(lhr) {
  const refs = lhr.categories?.performance?.auditRefs ?? [];
  return refs
    .map((ref) => ({ id: ref.id, audit: lhr.audits?.[ref.id] }))
    .filter(({ audit }) => audit && audit.score !== null && audit.score !== undefined && audit.score < 0.9 && audit.scoreDisplayMode !== 'informative')
    .map(({ id, audit }) => {
      const sav = audit.metricSavings ?? {};
      const saved = ['LCP', 'TBT'].filter((k) => sav[k]).map((k) => `${k} -${Math.round(sav[k])}`).join(', ');
      return { id, weight: (sav.LCP ?? 0) + (sav.TBT ?? 0), line: `${id}${audit.displayValue ? ` (${audit.displayValue})` : ''}${saved ? `  saves ${saved}` : ''}` };
    })
    .sort((x, y) => y.weight - x.weight)
    .slice(0, 10)
    .map((x) => x.line);
}

/** One line per distinct failure, with a count when it repeats ("429  /x  ×94"). */
function countRepeats(lines) {
  const counts = new Map();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts].map(([l, n]) => (n > 1 ? `${l}  ×${n}` : l));
}

export function pickMedian(lhrs) {
  const sorted = [...lhrs].sort((x, y) => (x.categories?.performance?.score ?? 0) - (y.categories?.performance?.score ?? 0));
  return sorted[Math.floor(sorted.length / 2)];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? '.lighthouseci';
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)) : [];
  if (!files.length) {
    console.log(`no lhr-*.json in ${dir}`);
    process.exit(0);
  }
  const byUrl = new Map();
  for (const f of files) {
    const lhr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const k = lhr.requestedUrl;
    byUrl.set(k, [...(byUrl.get(k) ?? []), lhr]);
  }
  for (const [, runs] of byUrl) console.log(JSON.stringify(summarise(pickMedian(runs)), null, 2));
}
