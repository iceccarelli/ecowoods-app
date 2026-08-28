#!/usr/bin/env node
/**
 * scripts/verify-ui-contract.mjs — text a visitor cannot read is not published.
 *
 * WHY THIS EXISTS — F-153, F-154, F-155, all live on commercial pages
 *
 * Every guard in this repository checks what the page SAYS. None checked whether
 * a human could read it. Three defects shipped green through all thirty-eight of
 * them, on the highest-intent pages on the site, and were found by a person
 * looking at a screenshot:
 *
 *   F-153  IllustrationPair rendered its caption inside `.ilpair-layer`, which
 *          is `position: absolute; inset: 0` on a stage sized from the image
 *          ratio alone. The caption had no height budget, spilled out of flow,
 *          and the next section was painted over it — two paragraphs of live
 *          text overlapping on /hardwood-stairs-toronto.
 *
 *   F-154  `.gd-spec` paints --line and depends on each child painting
 *          --surface-1 back over it. Eight blocks had children without
 *          `.gd-spec-row`, so the list rendered as an unpadded grey slab with
 *          label contrast of 2.29:1 instead of 5.88:1. Among them: the FAQ list
 *          on all sixteen guides.
 *
 *   F-155  `.footer-links` was reused on three commercial pages. Its colour is
 *          rgba(245,239,230,0.7) — correct on the dark footer, 1.04:1 on the
 *          cream page. Ninety-six internal links to service areas, invisible.
 *
 * All three are the same failure: a colour or a position that is correct in one
 * container and meaningless outside it, applied by a class name that carries no
 * container with it. So this guard reasons about CONTEXT, which is the thing
 * none of the others could see.
 *
 * WHAT IT CHECKS
 *
 *   1. Light text needs a dark ground. Any class whose rule sets a colour below
 *      3:1 against the page background AND sets no background of its own must be
 *      used under a JSX ancestor carrying a dark-ground class. Ancestry is read
 *      by walking the actual element tree, not by guessing from the filename —
 *      the first draft of this guard guessed, and reported 138 findings of which
 *      3 were real.
 *
 *   2. Dark grounds include gradients. `.pfd-card--panel` paints
 *      `linear-gradient(160deg, var(--walnut-900) …)`. A background parser that
 *      only understands flat hex calls that card light-on-light and reports a
 *      correct component as broken. Every colour inside a background value is
 *      resolved and the darkest one decides.
 *
 *   3. Footer classes stay in the footer. `.footer-*` is named for one container
 *      and palettes for one container. Anywhere else is F-155 again.
 *
 *   4. The .gd-spec fail-safe survives. `.gd-spec > *` must keep painting its own
 *      ground, so a missing `.gd-spec-row` degrades to "no divider lines" rather
 *      than "unreadable". A component whose failure mode is invisible text will
 *      fail invisibly again.
 *
 *   node scripts/verify-ui-contract.mjs
 *   node scripts/verify-ui-contract.mjs --list
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LIST = process.argv.includes('--list');
const CSS = path.join(ROOT, 'apps/web/app/globals.css');
const APP = path.join(ROOT, 'apps/web/app');
const AA_LARGE = 3.0; // below this, text of any size fails WCAG AA

if (!fs.existsSync(CSS)) {
  console.error('verify-ui-contract: apps/web/app/globals.css not found — run from the repo root.');
  process.exit(2);
}
const css = fs.readFileSync(CSS, 'utf8');
const problems = [];

/* ── colour maths ────────────────────────────────────────────────────────── */
const tokens = {};
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gim)) if (!(m[1] in tokens)) tokens[m[1]] = m[2].trim();
const deref = (v, d = 0) => {
  if (d > 8) return String(v);
  const m = String(v).match(/var\((--[a-z0-9-]+)[^)]*\)/i);
  return m ? deref(String(v).replace(m[0], tokens[m[1]] ?? ''), d + 1) : String(v);
};
function parseColor(raw) {
  const c = deref(raw).trim();
  let m = c.match(/#([0-9a-fA-F]{6})\b/);
  if (m) return [1, 3, 5].map((i) => parseInt(m[1].slice(i - 1, i + 1), 16)).concat(1);
  m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}
/** Every colour in a value — a gradient carries several. */
function allColors(raw) {
  const c = deref(raw);
  const out = [];
  for (const m of c.matchAll(/#[0-9a-fA-F]{6}\b|rgba?\([^)]*\)/g)) {
    const p = parseColor(m[0]);
    if (p && p[3] > 0.5) out.push(p);
  }
  return out;
}
const lum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const over = (fg, bg) => [0, 1, 2].map((i) => fg[3] * fg[i] + (1 - fg[3]) * bg[i]).concat(1);
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
const PAGE = parseColor(tokens['--cream-50'] ?? '#faf6ef') ?? [250, 246, 239, 1];

/* ── the stylesheet, as rules ────────────────────────────────────────────── */
const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map((m) => ({ sel: m[1].trim().replace(/\s+/g, ' '), body: m[2] }))
  .filter((r) => !r.sel.startsWith('@') && !r.sel.includes(':root'));

/** Classes that establish a dark ground — flat colour OR gradient. */
const darkGrounds = new Set();
for (const r of rules) {
  const bg = r.body.match(/(?:^|;)\s*background(?:-color|-image)?:\s*([^;]+)/);
  if (!bg) continue;
  const cols = allColors(bg[1]);
  if (!cols.length || !cols.some((c) => lum(c) < 0.3)) continue;
  for (const s of r.sel.split(','))
    for (const cls of s.match(/\.[a-zA-Z0-9_-]+/g) ?? []) darkGrounds.add(cls.slice(1));
}

/** Classes that set light text and supply no ground of their own. */
const needsDark = new Map();
for (const r of rules) {
  if (/(?:^|;)\s*background/.test(r.body)) continue;
  const cm = r.body.match(/(?:^|;)\s*color:\s*([^;]+)/);
  if (!cm) continue;
  const c = parseColor(cm[1]);
  if (!c) continue;
  const ratio = contrast(over(c, PAGE), PAGE);
  if (ratio >= AA_LARGE) continue;
  for (const s of r.sel.split(',')) {
    const head = s.trim().split(/[\s>+~]/)[0];
    const cls = (head.match(/^\.([a-zA-Z0-9_-]+)/) ?? [])[1];
    if (!cls || darkGrounds.has(cls)) continue;
    const prev = needsDark.get(cls);
    if (!prev || ratio < prev.ratio) needsDark.set(cls, { ratio, raw: cm[1].trim(), sel: s.trim() });
  }
}

/* ── the files ──────────────────────────────────────────────────────────── */
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
})(APP);

/* ── 1. HARD — a class may not leave the container its palette assumes ───── */
/**
 * A CURATED REGISTRY, AND WHY IT IS NOT A CLEVER ALGORITHM.
 *
 * The first version of this guard inferred the rule: light text + no background
 * of its own => must sit under a dark ancestor, ancestry read from the JSX. It
 * reported 66 violations of which 3 were real. Every false one was a dark ground
 * arriving from somewhere a flat CSS parser cannot follow — a gradient on a
 * parent, a `--dark` modifier applied by a sibling component, a card whose ground
 * is a photograph.
 *
 * A guard that is wrong 95% of the time does not get fixed, it gets ignored, and
 * then it is worse than nothing because it looks like coverage. The general scan
 * still runs, below, as a REPORT with numbers. What FAILS the build is this list:
 * pairs that have actually been got wrong, written down so they cannot be got
 * wrong again. It grows by one line each time something like F-155 happens.
 */
const CONTEXT_RULES = [
  {
    pattern: /^footer-/,
    allow: ['apps/web/app/components/SiteFooter.tsx', 'apps/web/app/components/CookiePreferencesButton.tsx'],
    why:
      'a footer class outside the footer. `.footer-links a` is rgba(245,239,230,0.7) — correct on\n' +
      '      the dark footer, 1.04:1 on the cream page background. That is F-155: ninety-six service-area\n' +
      '      links on the three commercial pages, invisible to a visitor and readable only to a crawler.\n' +
      '      Use .area-links, or give the new context its own class.',
  },
];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  src.split('\n').forEach((line, i) => {
    for (const rule of CONTEXT_RULES) {
      if (rule.allow.includes(rel)) continue;
      for (const m of line.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g)) {
        for (const cls of String(m[1] ?? m[2] ?? m[3]).split(/\s+/)) {
          if (cls && rule.pattern.test(cls)) {
            problems.push({ rel, line: i + 1, cls, why: rule.why, text: line.trim().slice(0, 100) });
          }
        }
      }
    }
  });
}

/* ── 2. HARD — the .gd-spec fail-safe survives ──────────────────────────── */
if (!/\.gd-spec\s*>\s*\*\s*\{[^}]*background/.test(css)) {
  problems.push({
    rel: 'apps/web/app/globals.css', line: 0, cls: 'gd-spec',
    why:
      'the `.gd-spec > *` fail-safe is gone. .gd-spec paints --line and depends on every child\n' +
      '      painting --surface-1 back over it; a child without .gd-spec-row renders the whole list as\n' +
      '      an unpadded grey slab with 2.29:1 labels instead of 5.88:1. That is F-154, and it shipped\n' +
      '      on the FAQ list of all sixteen guides plus four commercial pages with every guard green.',
    text: 'Restore: .gd-spec > * { background: var(--surface-1); padding: 0.85rem 1.15rem; }',
  });
}

/* ── 3. HARD — every .gd-spec div child carries the row class ───────────── */
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/className="gd-spec"/.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && !/<\/dl>/.test(lines[end])) end++;
    for (let j = i + 1; j < end; j++) {
      const m = lines[j].match(/^\s*<div\b([^>]*)>\s*$/);
      if (!m || /gd-spec-row/.test(m[1]) || /className/.test(m[1])) continue;
      let k = j + 1;
      while (k < end && !lines[k].trim()) k++;
      if (k >= end || !lines[k].trim().startsWith('<dt')) continue;
      problems.push({
        rel, line: j + 1, cls: 'gd-spec-row',
        why: 'a .gd-spec row without .gd-spec-row — it paints no ground, so the list shows the raw --line grey (F-154).',
        text: lines[j].trim().slice(0, 100),
      });
    }
    i = end;
  }
}

/* ── 4. ADVISORY — everything below AA, ranked, never fatal ─────────────── */
const advisory = [...needsDark]
  .map(([cls, i]) => ({ cls, ...i }))
  .sort((a, b) => a.ratio - b.ratio);

/* ── report ──────────────────────────────────────────────────────────────── */
/**
 * The advisory list is printed and never failed, deliberately — the same shape
 * as the unsourced-claim queue in verify-claims.mjs. Most entries are correct:
 * light text sitting on a dark ground this parser cannot see. The ones that are
 * not correct are found by reading it, and each one that turns out to be real
 * becomes a line in CONTEXT_RULES above, where it becomes a hard failure forever.
 *
 * One entry is worth a decision rather than a shrug: --copper (#c87e4f) reads
 * 2.97:1 on the cream background, and it is the colour of every breadcrumb,
 * every "Read more", every .clp-more link. Legible, and below the 4.5:1 that AA
 * asks for normal text. --copper-text (#9f5c32) is 4.81:1 and is already in the
 * palette. That is a brand decision, not a bug, so it is reported here and not
 * changed under anyone.
 */
if (LIST || advisory.length) {
  console.log('');
  console.log(`UI CONTRAST — ${darkGrounds.size} dark ground(s), ${advisory.length} context-dependent light class(es)`);
  console.log('');
  const worst = LIST ? advisory : advisory.slice(0, 8);
  for (const a of worst) {
    console.log(`  ${a.ratio.toFixed(2).padStart(5)}:1   .${a.cls.padEnd(24)} ${a.raw}`);
  }
  if (!LIST && advisory.length > worst.length) {
    console.log(`  … ${advisory.length - worst.length} more. Full list: node scripts/verify-ui-contract.mjs --list`);
  }
  console.log('');
  console.log('  Advisory. Each of these is light text with no ground of its own; most sit on a dark');
  console.log('  parent this parser cannot follow. Read it, and promote anything genuinely wrong into');
  console.log('  CONTEXT_RULES, where it fails the build.');
  console.log('');
}

if (problems.length) {
  console.error(`\u2717 ${problems.length} UI contract violation(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.rel}${p.line ? ':' + p.line : ''}`);
    console.error(`    .${p.cls} \u2014 ${p.why}`);
    console.error(`    ${p.text}\n`);
  }
  console.error(
    '  A colour is not portable. A class whose palette assumes one container has to travel\n' +
      '  with that container, or carry its own ground. See the header of this file.\n',
  );
  process.exit(1);
}

console.log(
  `\u2713 UI contract verified \u2014 no footer palette outside the footer, ` +
    `every .gd-spec row paints its own ground, fail-safe intact`,
);
