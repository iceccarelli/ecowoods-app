/**
 * lib/registry/intents.ts — the service intent ontology (Protocol v2, Stage 6).
 *
 * Customer phrasings, mapped onto the six stable service ids in
 * lib/seo-data.ts SERVICES. The matcher in ./match.ts reads only this table;
 * nothing else in the repository decides what "sand and refinish" means.
 *
 * Rules for this file:
 *   · Every alias resolves to a slug that exists in SERVICES. tests/golden-queries
 *     and scripts/verify-agentic.mjs fail the build otherwise.
 *   · An alias is a phrase a real customer types, not a keyword permutation.
 *   · `signal` weights are relative, not probabilities: 3 = names the service,
 *     2 = names the work, 1 = a cue that leans toward it.
 *   · No prices, no counts, no places here. Places live in ./locations.ts.
 */

export type ServiceAlias = {
  phrase: string;
  service: string;
  signal: 1 | 2 | 3;
  /** The published price band this phrasing implies, where narrower than the service's default. */
  band?: 'screenAndRecoat' | 'fullSandAndFinish' | 'newInstall';
};

/**
 * Ordered longest-phrase-first at runtime, so "screen and recoat" wins over
 * "recoat" and "stair refinishing" is credited to stairs before "refinishing"
 * is credited to floors.
 */
export const SERVICE_ALIASES: ServiceAlias[] = [
  /* ── floor refinishing (full sand & finish, or screen & recoat) ────────── */
  { phrase: 'hardwood floor refinishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'hardwood refinishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'floor refinishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinish', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinished', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinishes', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinisher', service: 'floor-refinishing', signal: 3 },
  { phrase: 'refinishers', service: 'floor-refinishing', signal: 3 },
  { phrase: 'sands', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'resand', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 're-sand', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'sand and refinish', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'sand and finish', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'full sand', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'sanding and refinishing', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'hardwood finishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'floor finishing', service: 'floor-refinishing', signal: 3 },
  { phrase: 'finishing', service: 'floor-refinishing', signal: 2 },
  { phrase: 'hardwood sanding', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'floor sanding', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'sanding', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'needs sanding', service: 'floor-refinishing', signal: 3, band: 'fullSandAndFinish' },
  { phrase: 'sanded', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 're-stain', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'restain', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'stain my floors', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'change the colour', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'change the color', service: 'floor-refinishing', signal: 2, band: 'fullSandAndFinish' },
  { phrase: 'screen and recoat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'screen & recoat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'recoat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'buff and coat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'buffing', service: 'floor-refinishing', signal: 2, band: 'screenAndRecoat' },
  { phrase: 'buff', service: 'floor-refinishing', signal: 2, band: 'screenAndRecoat' },
  { phrase: 'polishing', service: 'floor-refinishing', signal: 2, band: 'screenAndRecoat' },
  { phrase: 'polish', service: 'floor-refinishing', signal: 2, band: 'screenAndRecoat' },
  { phrase: 'maintenance coat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'pre-list recoat', service: 'floor-refinishing', signal: 3, band: 'screenAndRecoat' },
  { phrase: 'old oak', service: 'floor-refinishing', signal: 2 },
  { phrase: 'old floors', service: 'floor-refinishing', signal: 2 },
  { phrase: 'old hardwood', service: 'floor-refinishing', signal: 2 },
  { phrase: 'existing hardwood', service: 'floor-refinishing', signal: 2 },
  { phrase: 'existing floors', service: 'floor-refinishing', signal: 2 },
  { phrase: 'original floors', service: 'floor-refinishing', signal: 2 },
  { phrase: 'original hardwood', service: 'floor-refinishing', signal: 2 },
  { phrase: 'worn', service: 'floor-refinishing', signal: 1 },
  { phrase: 'scratched', service: 'floor-refinishing', signal: 1 },
  { phrase: 'scratches', service: 'floor-refinishing', signal: 1 },
  { phrase: 'dull', service: 'floor-refinishing', signal: 1 },
  { phrase: 'faded', service: 'floor-refinishing', signal: 1 },
  { phrase: 'tired', service: 'floor-refinishing', signal: 1 },
  { phrase: 'greying', service: 'floor-refinishing', signal: 1 },
  { phrase: 'graying', service: 'floor-refinishing', signal: 1 },
  { phrase: 'pet stains', service: 'floor-refinishing', signal: 1 },

  /* ── dust-free sanding ─────────────────────────────────────────────────── */
  { phrase: 'dust-free sanding', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dust free sanding', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dustless sanding', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dustless refinishing', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dust-free refinishing', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dust free refinishing', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dustless', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dust-free', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'dust free', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'without dust', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'no dust', service: 'dust-free-sanding', signal: 3 },
  { phrase: 'hepa', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'occupied home', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'living in the house', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'stay in the house', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'stay home during', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'while we live', service: 'dust-free-sanding', signal: 2 },
  { phrase: 'containment', service: 'dust-free-sanding', signal: 2 },

  /* ── installation ──────────────────────────────────────────────────────── */
  { phrase: 'hardwood flooring installation', service: 'hardwood-installation', signal: 3 },
  { phrase: 'hardwood floor installation', service: 'hardwood-installation', signal: 3 },
  { phrase: 'hardwood installation', service: 'hardwood-installation', signal: 3 },
  { phrase: 'floor installation', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installation', service: 'hardwood-installation', signal: 3 },
  { phrase: 'install', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installs', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installed', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installing', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installer', service: 'hardwood-installation', signal: 3 },
  { phrase: 'installers', service: 'hardwood-installation', signal: 3 },
  { phrase: 'new hardwood', service: 'hardwood-installation', signal: 3 },
  { phrase: 'new floors', service: 'hardwood-installation', signal: 3 },
  { phrase: 'new floor', service: 'hardwood-installation', signal: 3 },
  { phrase: 'replace my floors', service: 'hardwood-installation', signal: 3 },
  { phrase: 'replace the floor', service: 'hardwood-installation', signal: 3 },
  { phrase: 'engineered hardwood', service: 'hardwood-installation', signal: 2 },
  { phrase: 'engineered', service: 'hardwood-installation', signal: 1 },
  { phrase: 'solid hardwood', service: 'hardwood-installation', signal: 2 },
  { phrase: 'white oak', service: 'hardwood-installation', signal: 1 },
  { phrase: 'herringbone', service: 'hardwood-installation', signal: 2 },
  { phrase: 'chevron', service: 'hardwood-installation', signal: 2 },
  { phrase: 'parquet', service: 'hardwood-installation', signal: 1 },
  { phrase: 'wide plank', service: 'hardwood-installation', signal: 2 },
  { phrase: 'carpet to hardwood', service: 'hardwood-installation', signal: 3 },
  { phrase: 'remove carpet', service: 'hardwood-installation', signal: 2 },
  { phrase: 'over concrete', service: 'hardwood-installation', signal: 2 },
  { phrase: 'concrete slab', service: 'hardwood-installation', signal: 2 },
  { phrase: 'condo', service: 'hardwood-installation', signal: 1 },
  { phrase: 'glue down', service: 'hardwood-installation', signal: 2 },
  { phrase: 'glue-down', service: 'hardwood-installation', signal: 2 },
  { phrase: 'nail down', service: 'hardwood-installation', signal: 2 },
  { phrase: 'nail-down', service: 'hardwood-installation', signal: 2 },
  { phrase: 'floating floor', service: 'hardwood-installation', signal: 2 },
  { phrase: 'supply and install', service: 'hardwood-installation', signal: 3 },

  /* ── restoration ───────────────────────────────────────────────────────── */
  { phrase: 'hardwood floor restoration', service: 'floor-restoration', signal: 3 },
  { phrase: 'floor restoration', service: 'floor-restoration', signal: 3 },
  { phrase: 'restoration', service: 'floor-restoration', signal: 3 },
  { phrase: 'restore', service: 'floor-restoration', signal: 3 },
  { phrase: 'restored', service: 'floor-restoration', signal: 3 },
  { phrase: 'restores', service: 'floor-restoration', signal: 3 },
  { phrase: 'restoring', service: 'floor-restoration', signal: 3 },
  { phrase: 'water damage', service: 'floor-restoration', signal: 3 },
  { phrase: 'water damaged', service: 'floor-restoration', signal: 3 },
  { phrase: 'flood', service: 'floor-restoration', signal: 3 },
  { phrase: 'flooded', service: 'floor-restoration', signal: 3 },
  { phrase: 'leak', service: 'floor-restoration', signal: 2 },
  { phrase: 'cupping', service: 'floor-restoration', signal: 2 },
  { phrase: 'cupped', service: 'floor-restoration', signal: 2 },
  { phrase: 'crowning', service: 'floor-restoration', signal: 2 },
  { phrase: 'buckled', service: 'floor-restoration', signal: 2 },
  { phrase: 'buckling', service: 'floor-restoration', signal: 2 },
  { phrase: 'board replacement', service: 'floor-restoration', signal: 3 },
  { phrase: 'replace boards', service: 'floor-restoration', signal: 3 },
  { phrase: 'replace damaged boards', service: 'floor-restoration', signal: 3 },
  { phrase: 'repair', service: 'floor-restoration', signal: 2 },
  { phrase: 'repairs', service: 'floor-restoration', signal: 2 },
  { phrase: 'patch', service: 'floor-restoration', signal: 2 },
  { phrase: 'heritage', service: 'floor-restoration', signal: 2 },
  { phrase: 'century home', service: 'floor-restoration', signal: 1 },
  { phrase: 'victorian', service: 'floor-restoration', signal: 1 },
  { phrase: 'edwardian', service: 'floor-restoration', signal: 1 },
  { phrase: 'gaps', service: 'floor-restoration', signal: 1 },
  { phrase: 'squeak', service: 'floor-restoration', signal: 1 },
  { phrase: 'squeaky', service: 'floor-restoration', signal: 1 },
  { phrase: 'colour match', service: 'floor-restoration', signal: 2 },
  { phrase: 'color match', service: 'floor-restoration', signal: 2 },
  { phrase: 'match new to old', service: 'floor-restoration', signal: 2 },
  { phrase: 'feathering', service: 'floor-restoration', signal: 2 },

  /* ── stairs ────────────────────────────────────────────────────────────── */
  { phrase: 'stair refinishing', service: 'stair-refinishing', signal: 3 },
  { phrase: 'refinish stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'refinish my stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'refinish the stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'refinishes stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'hardwood stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'staircase', service: 'stair-refinishing', signal: 3 },
  { phrase: 'stairs', service: 'stair-refinishing', signal: 3 },
  { phrase: 'stair', service: 'stair-refinishing', signal: 3 },
  { phrase: 'treads', service: 'stair-refinishing', signal: 3 },
  { phrase: 'risers', service: 'stair-refinishing', signal: 3 },
  { phrase: 'nosings', service: 'stair-refinishing', signal: 3 },
  { phrase: 'nosing', service: 'stair-refinishing', signal: 2 },
  { phrase: 'stair treads', service: 'stair-refinishing', signal: 3 },
  { phrase: 'stair runner removed', service: 'stair-refinishing', signal: 2 },
  { phrase: 'carpet off the stairs', service: 'stair-refinishing', signal: 3 },

  /* ── custom inlays & borders ───────────────────────────────────────────── */
  { phrase: 'custom inlays', service: 'custom-inlays', signal: 3 },
  { phrase: 'custom inlay', service: 'custom-inlays', signal: 3 },
  { phrase: 'inlays', service: 'custom-inlays', signal: 3 },
  { phrase: 'inlay', service: 'custom-inlays', signal: 3 },
  { phrase: 'borders', service: 'custom-inlays', signal: 3 },
  { phrase: 'border', service: 'custom-inlays', signal: 2 },
  { phrase: 'medallion', service: 'custom-inlays', signal: 3 },
  { phrase: 'medallions', service: 'custom-inlays', signal: 3 },
  { phrase: 'feature strip', service: 'custom-inlays', signal: 3 },
  { phrase: 'feature strips', service: 'custom-inlays', signal: 3 },
  { phrase: 'decorative', service: 'custom-inlays', signal: 1 },
  { phrase: 'pattern floor', service: 'custom-inlays', signal: 1 },
];

/**
 * Work this business does not do. A query that names one of these and no
 * hardwood service resolves to `unsupported`, never to the nearest hardwood
 * service — a wrong lead costs both sides.
 */
export const UNSUPPORTED_ALIASES: { phrase: string; label: string }[] = [
  { phrase: 'vinyl plank', label: 'vinyl plank flooring' },
  { phrase: 'luxury vinyl', label: 'luxury vinyl flooring' },
  { phrase: 'lvp', label: 'vinyl plank flooring' },
  { phrase: 'lvt', label: 'vinyl tile flooring' },
  { phrase: 'vinyl', label: 'vinyl flooring' },
  { phrase: 'laminate', label: 'laminate flooring' },
  { phrase: 'carpet install', label: 'carpet installation' },
  { phrase: 'carpeting', label: 'carpet installation' },
  { phrase: 'new carpet', label: 'carpet installation' },
  { phrase: 'ceramic', label: 'tile flooring' },
  { phrase: 'porcelain', label: 'tile flooring' },
  { phrase: 'tile floor', label: 'tile flooring' },
  { phrase: 'tiles', label: 'tile flooring' },
  { phrase: 'epoxy', label: 'epoxy floor coating' },
  { phrase: 'polished concrete', label: 'polished concrete' },
  { phrase: 'deck', label: 'exterior decking' },
  { phrase: 'decking', label: 'exterior decking' },
  { phrase: 'fence', label: 'fencing' },
  { phrase: 'kitchen cabinets', label: 'cabinetry' },
  { phrase: 'cabinet refacing', label: 'cabinetry' },
  { phrase: 'roof', label: 'roofing' },
  { phrase: 'plumbing', label: 'plumbing' },
];

/**
 * Generic hardwood phrasings. They confirm the query is about this trade but
 * do not pick a service; the matcher then returns the two most common
 * services as candidates with `requires_assessment`.
 */
export const GENERIC_HARDWOOD_PHRASES: string[] = [
  'hardwood flooring',
  'hardwood floors',
  'hardwood floor',
  'hardwood',
  'wood floors',
  'wood floor',
  'wood flooring',
  'oak floors',
  'oak flooring',
  'maple floors',
  'walnut floors',
  'flooring contractor',
  'floor contractor',
  'flooring company',
];

/** Text-normalisation shared by the matcher and the tests. */
export const normalise = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9'\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
