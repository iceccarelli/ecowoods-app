#!/usr/bin/env node
/**
 * scripts/verify-manifests.mjs
 *
 * Fails when a manifest array contains a hole.
 *
 * WHY THIS EXISTS
 *
 * F-159. A patch added five decision guides to `lib/guides.ts` and left one
 * stray character behind:
 *
 *     pillars: ['containment'],
 *   },
 *   ,                              ← this
 *
 *     { slug: 'hardwood-flooring-cost-toronto', ...
 *
 * A bare comma between two elements of an array literal is not a syntax error.
 * It is a **sparse array** — legal JavaScript, legal TypeScript, and completely
 * invisible to every tool this repository runs:
 *
 *   · `node audit/scripts/parse-scan.mjs` parses it. It is valid.
 *   · `tsc --noEmit` typechecks it. `Guide[]` permits a hole.
 *   · `next build` compiles it.
 *   · Fourteen guards read it and see the right number of guides, because
 *     `.filter()` and `.map()` silently SKIP holes.
 *
 * And then it breaks, at the one place that does not skip:
 *
 *     for (const g of guides) out.push(guideToMarkdown(g));
 *     // TypeError: Cannot read properties of undefined
 *
 * That is `corpusToMarkdown()`, so the failure lands during the build of
 * /llms-full.txt. `JSON.stringify` on the same array emits `null` into
 * /api/knowledge. `guides.length` counts the hole, so /llms.txt would advertise
 * one more guide than exists.
 *
 * One character. Invisible to the parser, the typechecker, the compiler and
 * every existing guard, and it takes out the machine-readable corpus.
 *
 * WHAT IT DOES
 *
 * Reads each manifest, strips comments and strings, and looks for the two
 * shapes that produce a hole: `,` followed by `,`, and `[` followed by `,`.
 * A trailing comma before `]` is fine — that is normal style and creates no
 * hole.
 *
 *   node scripts/verify-manifests.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

/** Every file that carries a hand-edited array the rest of the site is built from. */
const MANIFESTS = [
  'apps/web/lib/papers.ts',
  'apps/web/lib/guides.ts',
  'apps/web/lib/glossary.ts',
  'apps/web/lib/framework.ts',
  'apps/web/lib/figures.ts',
  'apps/web/lib/standards.ts',
  'apps/web/lib/changelog.ts',
  'apps/web/lib/market.ts',
  'apps/web/lib/images.ts',
  'apps/web/lib/service-pages.ts',
  'apps/web/lib/seo-data.ts',
  'apps/web/lib/schema/root-schema.ts',
  'packages/shared/constants/index.ts',
];

/**
 * Neutralise comments and string literals while preserving offsets, so a comma
 * inside a sentence — "belt, edger, planetary" — cannot be mistaken for a hole.
 *
 * Comments become spaces. Strings become RUNS OF 'x', quotes included, and that
 * distinction is the whole correctness of this file. The first version blanked
 * strings to spaces too, which turned `['a', 'b']` into `[   ,    ]` — the
 * elements vanished and every comma in every manifest suddenly looked like a
 * hole. It reported 532 of them, all false. A guard is not finished when it
 * fires; it is finished when it fires only on the thing it is named for.
 */
const blank = (src) => {
  const out = src.split('');
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      for (let k = i; k < stop; k++) if (out[k] !== '\n') out[k] = ' ';
      i = stop;
      continue;
    }
    if (two === '//') {
      let k = i;
      while (k < src.length && src[k] !== '\n') out[k++] = ' ';
      i = k;
      continue;
    }
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      let k = i + 1;
      while (k < src.length) {
        if (src[k] === '\\') { k += 2; continue; }
        if (src[k] === c) break;
        k++;
      }
      // 'x', not ' ' — the literal must still read as a value sitting between
      // its commas, or the commas around it become a false hole.
      for (let j = i; j <= Math.min(k, src.length - 1); j++) if (out[j] !== '\n') out[j] = 'x';
      i = k + 1;
      continue;
    }
    i++;
  }
  return out.join('');
};

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

const problems = [];
let checked = 0;

for (const rel of MANIFESTS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  checked += 1;
  const raw = fs.readFileSync(abs, 'utf8');
  const src = blank(raw);

  //  `,` … `,`  with only whitespace between → a hole between two elements.
  for (const m of src.matchAll(/,\s*,/g)) {
    problems.push({
      where: `${rel}:${lineOf(src, m.index)}`,
      detail:
        'two commas with nothing between them. This is a sparse array — legal syntax, ' +
        'invisible to tsc and to the build, and it puts an undefined into a manifest ' +
        'every page is generated from.',
    });
  }

  //  `[` … `,` → a hole at the front.
  for (const m of src.matchAll(/\[\s*,/g)) {
    problems.push({
      where: `${rel}:${lineOf(src, m.index)}`,
      detail: 'array opens with a comma — a hole at index 0.',
    });
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} hole(s) in a manifest array:\n`);
  for (const p of problems) console.error(`  · ${p.where}\n      ${p.detail}\n`);
  console.error(
    '  .filter() and .map() skip holes silently, so the guards will keep passing.\n' +
      '  `for...of` does not, and neither does JSON.stringify. See F-159.\n',
  );
  process.exit(1);
}

console.log(`✓ manifests verified — ${checked} file(s), no array holes`);
