/**
 * scripts/lib/area-overlap.mjs — the service-area content-overlap metric.
 *
 * Pure functions, no I/O, so the metric can be tested on fixtures and the
 * verifier can feed it the real registries.
 *
 * THE METRIC
 *
 * A page is a list of sections. Each section is either
 *
 *   · `local: true`  — copy that is supposed to be about THIS place (the opening
 *                      answer, the local intro, the housing note, the local
 *                      consideration, the placement sentence), or
 *   · `local: false` — a legitimate shared component (hero promise, service
 *                      cards, "why Ecowoods" bullets, FAQ, contact block, CTAs).
 *
 * Only local sections are compared. Shared components are not "overlap": every
 * page is meant to carry the company's NAP and the same estimate call to action.
 * But shared text also leaks INTO local sections (the opening answer restates
 * the company's years in business, hours and price promise), so every shingle
 * that occurs in a shared component is subtracted from the local text before it
 * is compared. What remains is the page's substantive copy.
 *
 * Steps, per page:
 *   1. lowercase; replace the page's own place names with one token, so two
 *      sentences that differ only in the location name are IDENTICAL;
 *   2. split into word tokens (letters/digits; punctuation and markup ignored);
 *   3. take every run of K consecutive tokens (a K-word shingle) as a set;
 *   4. subtract the shared-component shingles.
 *
 * Per pair of pages: Jaccard similarity of the two substantive shingle sets,
 * |A ∩ B| / |A ∪ B|, in [0, 1]. Order-free, so route ordering cannot change it;
 * set-based, so repeating a sentence does not change it; and symmetric.
 *
 * A page whose substantive text is shorter than MIN_WORDS words is `thin`. It
 * is not compared (two near-empty sets would score 0 or 1 by accident), and is
 * reported and ratcheted separately — thinness is its own defect, not overlap.
 *
 * Summary: mean over all pairs of non-thin pages, the maximum pair, and for
 * every page the worst partner it has.
 */

export const METRIC = Object.freeze({ version: 1, shingleWords: 4, minWords: 40 });

const PLACE = 'zzplace';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lowercase tokens; own place names collapse to one token; markup and punctuation vanish. */
export function tokenize(text, placeNames = []) {
  let t = String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[‘’]/g, "'")
    .toLowerCase();
  const names = [...new Set(placeNames.map((n) => String(n).toLowerCase().trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  for (const n of names) {
    t = t.replace(new RegExp(`(?<![a-z0-9])${escapeRe(n)}(?![a-z0-9])`, 'g'), ` ${PLACE} `);
  }
  return t.match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? [];
}

export function shingles(tokens, k = METRIC.shingleWords) {
  const out = new Set();
  if (tokens.length < k) {
    if (tokens.length) out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i + k <= tokens.length; i++) out.add(tokens.slice(i, i + k).join(' '));
  return out;
}

const union = (sets) => {
  const out = new Set();
  for (const s of sets) for (const x of s) out.add(x);
  return out;
};

/**
 * @param {{ slug: string, names: string[], sections: { id: string, text: string, local: boolean }[] }[]} pages
 * @param {{ k?: number, minWords?: number }} [opts]
 */
export function profilePages(pages, { k = METRIC.shingleWords, minWords = METRIC.minWords } = {}) {
  const prepared = pages.map((p) => ({
    ...p,
    sections: p.sections.map((s) => ({ ...s, tokens: tokenize(s.text, p.names) })),
  }));
  const shared = union(
    prepared.flatMap((p) => p.sections.filter((s) => !s.local).map((s) => shingles(s.tokens, k))),
  );
  return prepared
    .map((p) => {
      const sections = {};
      let words = 0;
      for (const s of p.sections.filter((x) => x.local)) {
        const own = new Set([...shingles(s.tokens, k)].filter((x) => !shared.has(x)));
        sections[s.id] = (sections[s.id] ?? new Set());
        for (const x of own) sections[s.id].add(x);
        words += s.tokens.length;
      }
      const all = union(Object.values(sections));
      return { slug: p.slug, words, sections, shingles: all, thin: words < minWords || all.size === 0 };
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const round = (n) => Math.round(n * 10000) / 10000;

/** Compare every pair of non-thin pages. Deterministic: depends only on content. */
export function measure(pages, opts) {
  const profiles = profilePages(pages, opts);
  const live = profiles.filter((p) => !p.thin);
  const pairs = [];
  const worst = Object.fromEntries(live.map((p) => [p.slug, 0]));
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const o = jaccard(live[i].shingles, live[j].shingles);
      pairs.push({ a: live[i].slug, b: live[j].slug, overlap: o });
      if (o > worst[live[i].slug]) worst[live[i].slug] = o;
      if (o > worst[live[j].slug]) worst[live[j].slug] = o;
    }
  }
  const mean = pairs.length ? pairs.reduce((s, p) => s + p.overlap, 0) / pairs.length : 0;
  pairs.sort((x, y) => y.overlap - x.overlap || (x.a + x.b < y.a + y.b ? -1 : 1));
  const bySlug = new Map(profiles.map((p) => [p.slug, p]));
  /** Which sections the two pages share substance in — the "exact sections involved". */
  const sectionsOf = (a, b) => {
    const pa = bySlug.get(a);
    const pb = bySlug.get(b);
    return Object.keys(pa.sections)
      .map((id) => ({
        section: id,
        shared_shingles: [...pa.sections[id]].filter((x) => pb.sections[id]?.has(x)).length,
        overlap: round(jaccard(pa.sections[id], pb.sections[id] ?? new Set())),
      }))
      .filter((s) => s.shared_shingles > 0)
      .sort((x, y) => y.shared_shingles - x.shared_shingles);
  };
  return {
    metric: { ...METRIC, ...opts },
    pages: profiles.length,
    compared_pages: live.length,
    pairs: pairs.length,
    thin: profiles.filter((p) => p.thin).map((p) => p.slug),
    mean: round(mean),
    max: round(pairs[0]?.overlap ?? 0),
    worst_by_page: Object.fromEntries(Object.entries(worst).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, v]) => [k, round(v)])),
    top_pairs: pairs.slice(0, 10).map((p) => ({ a: p.a, b: p.b, overlap: round(p.overlap), sections: sectionsOf(p.a, p.b) })),
    pairsOver: (threshold) => pairs.filter((p) => p.overlap > threshold).map((p) => ({ a: p.a, b: p.b, overlap: round(p.overlap), sections: sectionsOf(p.a, p.b) })),
  };
}

export const TOLERANCE = 0.005;

/**
 * The ratchet. `baseline` is the committed floor; `current` is `measure()`.
 * Returns the list of violations (empty = pass). Improvements never violate.
 */
export function compare(current, baseline, tolerance = TOLERANCE) {
  const problems = [];
  const m = baseline.metric ?? {};
  if (m.version !== METRIC.version || m.shingleWords !== current.metric.shingleWords || m.minWords !== current.metric.minWords) {
    problems.push({ kind: 'metric-changed', detail: `baseline was measured with ${JSON.stringify(m)}, current metric is ${JSON.stringify(current.metric)}; re-measure with --rebaseline in a reviewed change` });
    return problems;
  }
  if (current.mean > baseline.mean + tolerance) problems.push({ kind: 'mean', detail: `mean pairwise overlap ${current.mean} > baseline ${baseline.mean} + ${tolerance}` });
  if (current.max > baseline.max + tolerance) problems.push({ kind: 'max', detail: `maximum pair overlap ${current.max} > baseline ${baseline.max} + ${tolerance}` });
  const newThin = current.thin.filter((s) => !(baseline.thin ?? []).includes(s));
  if (newThin.length) problems.push({ kind: 'thin', detail: `substantive copy fell below ${current.metric.minWords} words: ${newThin.join(', ')}` });
  for (const [slug, w] of Object.entries(current.worst_by_page)) {
    const floor = baseline.worst_by_page?.[slug] ?? baseline.max;
    if (w > floor + tolerance) problems.push({ kind: 'page', slug, detail: `${slug}: worst-partner overlap ${w} > baseline ${floor} + ${tolerance}` });
  }
  return problems;
}
