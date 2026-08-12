#!/usr/bin/env node
/**
 * scripts/verify-tokens.mjs
 *
 * Fails the build when a component rule paints with a PRIMITIVE token.
 *
 * WHY THIS EXISTS
 *
 * audit/DESIGN_SYSTEM.md §1.1 has said since patch 00:
 *
 *     primitive   --walnut-*  --oak-*  --cream-*  --maple-*
 *                 raw pigment. Never referenced by a component rule.
 *     semantic    --bg --surface --ink --muted --line --on-dark --copper-text …
 *                 the ONLY layer a component rule may reference.
 *
 * Primitives do not flip between themes. Semantic tokens do. So a component
 * rule that paints with a primitive is correct in one theme and wrong in the
 * other — and it is wrong *silently*, because the light theme looks fine.
 *
 * The rule was written down and nothing enforced it, so the SAME violation was
 * found four separate times, each by a full measurement cycle:
 *
 *   F-05  cream-on-copper           10 components at 2.97:1
 *   F-33  .tlx-* text               17 declarations, --walnut-950 at 1.11:1 dark
 *   F-36  .tlx-* surfaces            8 declarations, the text fix made them worse
 *   F-42  .tlx-card                  the card the previous pass could not see
 *
 * Each pass fixed what it could see. A grep would have found all four at once.
 *
 * HOW IT BEHAVES
 *
 * A codebase this size cannot go from 48 violations to zero in one commit, so
 * this is a RATCHET, not a wall:
 *
 *   - `scripts/token-baseline.json` records the violations that existed when
 *     the lint was introduced. Those pass.
 *   - Any violation NOT in the baseline fails the build.
 *   - A baseline entry that no longer exists is reported as removable, so the
 *     baseline shrinks and never silently grows.
 *
 * Entries are keyed by selector + property + token, never by line number, so
 * ordinary edits to globals.css do not churn the baseline.
 *
 *   node scripts/verify-tokens.mjs            check (used by pnpm verify)
 *   node scripts/verify-tokens.mjs --update   rewrite the baseline deliberately
 *   node scripts/verify-tokens.mjs --list     show every violation, baselined or not
 */
import fs from 'node:fs';
import path from 'node:path';

const CSS = path.resolve('apps/web/app/globals.css');
const BASELINE = path.resolve('scripts/token-baseline.json');

/** Tokens that are raw pigment. A component rule may not paint with these. */
const PRIMITIVE = /var\(\s*(--(?:walnut|oak|cream|maple)-[\w-]+)/;
/** Properties that put colour on the screen. */
const PAINT = /^(color|background|background-color|border-color|border-top-color|border-bottom-color|border-left-color|border-right-color|fill|stroke|outline-color)$/;

if (!fs.existsSync(CSS)) {
  console.error(`verify-tokens: ${CSS} not found — run from the repo root.`);
  process.exit(2);
}
const css = fs.readFileSync(CSS, 'utf8');

/* ---- flatten every rule, carrying its @media context ---- */
const rules = [];
(function walk(text, offset, media) {
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(text))) {
    const sel = m[1].trim().replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let i = m.index + m[0].length - 1, d = 0;
    const s = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') d++;
      else if (text[i] === '}') { d--; if (d === 0) break; }
    }
    const body = text.slice(s + 1, i);
    if (/^@(media|supports|container|layer)/.test(sel)) walk(body, offset + s + 1, sel);
    else if (!/^@/.test(sel)) {
      rules.push({ sel, body, media, line: css.slice(0, offset + m.index).split('\n').length });
    }
    re.lastIndex = i + 1;
  }
})(css, 0, null);

/* ---- the two places primitives are DEFINED and may be referenced ---- */
const isTokenBlock = (sel) => sel === ':root' || /^html\[data-theme=/.test(sel);

const violations = [];
for (const r of rules) {
  if (isTokenBlock(r.sel)) continue;
  const body = r.body.replace(/\/\*[\s\S]*?\*\//g, '');   // ignore commented-out code
  for (const d of body.split(';')) {
    const c = d.indexOf(':');
    if (c < 0) continue;
    const prop = d.slice(0, c).trim();
    const value = d.slice(c + 1);
    if (!PAINT.test(prop)) continue;
    const m = value.match(PRIMITIVE);
    if (!m) continue;
    violations.push({ key: `${r.sel}|${prop}|${m[1]}`, sel: r.sel, prop, token: m[1], line: r.line });
  }
}

const baseline = fs.existsSync(BASELINE)
  ? new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).allowed)
  : new Set();

const isNew = (v) => !baseline.has(v.key);
const fresh = violations.filter(isNew);
const seen = new Set(violations.map((v) => v.key));
const stale = [...baseline].filter((k) => !seen.has(k));

if (process.argv.includes('--update')) {
  const allowed = [...new Set(violations.map((v) => v.key))].sort();
  fs.writeFileSync(BASELINE, JSON.stringify({
    note: 'Primitive-token uses that predate scripts/verify-tokens.mjs. This list may shrink, never grow. See audit/DESIGN_SYSTEM.md §1.1.',
    allowed,
  }, null, 2) + '\n');
  console.log(`verify-tokens: baseline rewritten with ${allowed.length} entries.`);
  process.exit(0);
}

if (process.argv.includes('--list')) {
  for (const v of violations) {
    console.log(`  ${isNew(v) ? 'NEW ' : 'base'}  globals.css:${String(v.line).padStart(4)}  ${v.sel.slice(0, 52).padEnd(52)} ${v.prop}: ${v.token}`);
  }
  console.log(`\n${violations.length} total, ${fresh.length} new, ${baseline.size} baselined.`);
  process.exit(0);
}

if (stale.length) {
  console.log(`✓ ${stale.length} baselined primitive use(s) no longer exist — run \`node scripts/verify-tokens.mjs --update\` to shrink the baseline:`);
  for (const k of stale.slice(0, 10)) console.log(`    ${k}`);
  if (stale.length > 10) console.log(`    … and ${stale.length - 10} more`);
}

if (fresh.length) {
  console.error(`\n✗ ${fresh.length} component rule(s) paint with a PRIMITIVE token.\n`);
  for (const v of fresh) {
    console.error(`  globals.css:${v.line}  ${v.sel}`);
    console.error(`      ${v.prop}: var(${v.token})\n`);
  }
  console.error('Primitives do not flip between themes; semantic tokens do. A rule like this');
  console.error('is correct in one theme and silently wrong in the other.');
  console.error('');
  console.error('  text        --ink  --ink-soft  --muted  --muted-soft  --on-dark  --on-dark-muted');
  console.error('  surfaces    --bg  --surface  --surface-1  --surface-2  --surface-deep');
  console.error('  lines       --line  --line-strong  --on-dark-line');
  console.error('  copper      --copper-text (text)  --copper-surface + --on-copper (filled)');
  console.error('');
  console.error('See audit/DESIGN_SYSTEM.md §1.1. If this really is a surface that is dark in');
  console.error('BOTH themes, the correct pair is --walnut-950 with --on-dark — and it belongs');
  console.error('in the baseline deliberately, not by accident.');
  process.exit(1);
}

console.log(`✓ tokens verified — ${violations.length} primitive use(s), all baselined, 0 new`);
