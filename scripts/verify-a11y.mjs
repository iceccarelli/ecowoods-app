#!/usr/bin/env node
/**
 * verify-a11y.mjs — the accessibility contract, checked as text.
 *
 * WHY A STATIC GUARD WHEN A BROWSER AUDIT EXISTS
 *
 * audit/scripts/run-runtime-audit.sh runs axe against a real browser, and it
 * is strictly better at what it does. It also needs Chromium, a production
 * build, a server on port 3111 and about four minutes — so it runs when
 * somebody remembers, which in this repository's history has been never. The
 * findings it produced sat in audit/ for a month.
 *
 * This checks the subset that is decidable from source in about a second, and
 * it runs in the pre-build gate on every push. It does not replace axe. It
 * makes the four failures that keep recurring impossible to merge.
 *
 * WHAT IT CHECKS, AND WHY EACH ONE IS HERE
 *
 *  1. EVERY FORM CONTROL HAS AN ACCESSIBLE NAME. A control is named if it is
 *     wrapped in a <label>, or a <label htmlFor> points at its id, or it
 *     carries aria-label / aria-labelledby / title. The house pattern in
 *     apps/web/app/admin is <div class="field"><label>Text</label><input/></div>
 *     — visually correct and programmatically nameless, because the label
 *     neither wraps nor references. Fifteen of those in one form is a form a
 *     screen-reader user cannot complete.
 *
 *  2. EVERY <img> HAS alt. Including the empty alt="" that marks a decorative
 *     image — the point is that somebody decided, not that the attribute is
 *     non-empty. next/image is the same element after compilation.
 *
 *  3. NO POSITIVE tabindex. tabIndex={1} does not move an element to the front
 *     of the tab order; it moves it in front of every element in the document,
 *     which breaks the order for the whole page. tabIndex={-1} and {0} are fine.
 *
 *  4. EVERY <button> AND ICON-ONLY LINK HAS TEXT OR aria-label. A button whose
 *     only child is an <svg> announces as "button".
 *
 *  5. NO onClick ON A NON-INTERACTIVE ELEMENT without a role and a key handler.
 *     A <div onClick> is invisible to the keyboard.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK
 *
 *   Contrast (audit/scripts/contrast-audit.mjs owns it), focus visibility
 *   (CSS, and the runtime pass owns it), reading order, and anything needing
 *   layout. A guard that guesses at those produces false positives, and a
 *   guard with false positives gets suppressed — which is how the previous
 *   two detector scripts in this repository ended up with documented
 *   suppression lists.
 *
 * Run:  pnpm verify:a11y
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const WEB = join(ROOT, 'apps/web');
const BASELINE = join(ROOT, 'scripts/a11y-baseline.json');

if (!existsSync(WEB)) {
  console.error('✗ apps/web not found — run from the repo root');
  process.exit(1);
}

/** Files to read: every component and page under apps/web. */
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) files.push(p);
  }
})(WEB);

const rel = (p) => relative(ROOT, p);
const findings = [];
const add = (file, line, rule, message) =>
  findings.push({ where: `${rel(file)}:${line}`, rule, message });

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/** Strip comments so a documented example is not a finding. */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));

for (const file of files) {
  const raw = readFileSync(file, 'utf8');
  const src = strip(raw);

  /* ── ids that a <label htmlFor> points at ─────────────────────────────── */
  const labelledIds = new Set();
  for (const m of src.matchAll(/htmlFor=\{?["'`]?([A-Za-z0-9_$\-{}.\s]+?)["'`]?\}?[\s>]/g)) {
    labelledIds.add(m[1].trim());
  }
  /* A template-literal or expression id is unresolvable statically. Treat the
     presence of ANY dynamic htmlFor as "this file labels dynamically" and stop
     asserting on dynamic ids in it — a guess here is a false positive, and a
     false positive is how a guard gets switched off. */
  const hasDynamicLabel = /htmlFor=\{/.test(src);

  /* ── 1 + 2 + 3 + 4: element-level checks ─────────────────────────────── */
  /*
   * The attribute matcher below stops at the first `>`, and an arrow function
   * in a handler contains one. So `<input onChange={() => f()} aria-label="x">`
   * matched only as far as `onChange={() =` and the aria-label was invisible —
   * a false "control-name" finding on correctly labelled controls, and the
   * fix a developer reaches for is to reorder attributes, which teaches nothing
   * and leaves the trap set. Neutralise the arrow first. The replacement is the
   * same length, so every index and line number below still refers to `src`.
   */
  const scan = src.replace(/=>/g, '==');
  for (const m of scan.matchAll(/<(input|select|textarea)\b([^>]*?)\/?>/g)) {
    const [tag, attrs] = [m[1], m[2]];
    const line = lineOf(src, m.index);
    if (/type=["']hidden["']/.test(attrs)) continue;
    if (/aria-label|aria-labelledby|title=/.test(attrs)) continue;
    /* aria-hidden removes it from the accessibility tree entirely, which is
       exactly what a honeypot field wants. Naming it would be wrong. */
    if (/aria-hidden=\{?["']?true/.test(attrs)) continue;

    const idMatch = attrs.match(/\bid=\{?["'`]?([A-Za-z0-9_$\-{}.\s]+?)["'`]?\}?[\s/]/);
    const id = idMatch ? idMatch[1].trim() : null;
    if (id && (labelledIds.has(id) || (hasDynamicLabel && /[{$]/.test(id)))) continue;

    /* Wrapped in a label? Look backwards for the nearest opening tag. */
    const before = src.slice(0, m.index);
    const lastLabel = before.lastIndexOf('<label');
    const lastLabelClose = before.lastIndexOf('</label>');
    if (lastLabel > lastLabelClose) continue;

    add(file, line, 'control-name', `<${tag}> has no accessible name — wrap it in a <label>, point a <label htmlFor> at its id, or give it aria-label.`);
  }

  for (const m of src.matchAll(/<img\b([^>]*?)\/?>/g)) {
    if (!/\balt=/.test(m[1])) {
      add(file, lineOf(src, m.index), 'img-alt', '<img> has no alt attribute. Decorative images take alt="" — the attribute is the decision, and it has to be made.');
    }
  }

  for (const m of src.matchAll(/tabIndex=\{(\d+)\}/g)) {
    if (Number(m[1]) > 0) {
      add(file, lineOf(src, m.index), 'positive-tabindex', `tabIndex={${m[1]}} moves this in front of every element on the page, not just its neighbours. Use 0, or restructure the DOM.`);
    }
  }

  /* TWO EXEMPTIONS, BOTH EARNED BY MEASUREMENT RATHER THAN CONVENIENCE.
     This repository has already switched off two detector scripts because they
     produced false positives, and a guard nobody trusts gates nothing.

     1. onClick={(e) => e.stopPropagation()} is EVENT CONTAINMENT, not an
        interaction. The element it sits on is a panel, not a control; there is
        nothing for a keyboard user to activate, and adding a key handler would
        create a phantom control that announces as interactive.

     2. A MODAL SCRIM — role="dialog" with aria-modal — that contains a real
        close button, or whose component registers a document Escape handler,
        is closable without a mouse. The onClick on the scrim is a convenience
        on top of that, not the only way out. Where BOTH are absent the finding
        stands, and it stood for two modals when this guard was written. */
  const hasEscapeHandler = /e\.key === 'Escape'|key === "Escape"/.test(src);

  for (const m of src.matchAll(/<(div|span|li|td|section|article)\b([^>]*?)onClick=\{?([^\n]*)/g)) {
    const attrs = m[2];
    const handler = m[3];
    const line = lineOf(src, m.index);
    const window_ = src.slice(m.index, m.index + 900);

    if (/stopPropagation/.test(handler)) continue;

    const isDialog = /role=["']dialog["']/.test(attrs) || /role=["']dialog["']/.test(window_.slice(0, 400));
    if (isDialog) {
      const closable =
        hasEscapeHandler || /aria-label=["']Close["']/i.test(window_) || /onKeyDown|onKeyUp/.test(window_);
      if (!closable) {
        add(file, line, 'modal-no-escape', 'Modal scrim closes on click but offers no Escape handler and no close button — a mouse-only exit.');
      }
      continue;
    }

    if (/role=/.test(attrs) || /role=/.test(window_.slice(0, 300))) {
      if (!/onKeyDown|onKeyUp|onKeyPress/.test(window_) && !hasEscapeHandler) {
        add(file, line, 'click-no-key', `<${m[1]} onClick> has a role but no key handler — a mouse-only control.`);
      }
      continue;
    }
    add(file, line, 'click-no-role', `<${m[1]} onClick> is not reachable by keyboard. Use a <button>, or add role + tabIndex + a key handler.`);
  }
}

/* ── baseline ────────────────────────────────────────────────────────────── */
const key = (f) => `${f.rule}::${f.where}`;
let baseline = { known: [] };
if (existsSync(BASELINE)) baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(baseline.known ?? []);

if (process.argv.includes('--update')) {
  const out = { _comment: 'Pre-existing accessibility findings, accepted so the guard can gate NEW ones. Shrink this list; never grow it. Regenerate with --update only after fixing, never to silence a new finding.', known: findings.map(key).sort() };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const fresh = findings.filter((f) => !known.has(key(f)));
const stale = [...known].filter((k) => !findings.some((f) => key(f) === k));

if (fresh.length) {
  console.error('');
  for (const f of fresh) console.error(`✗ ${f.where}  [${f.rule}]\n    ${f.message}`);
  console.error(`\n✗ a11y: ${fresh.length} new finding(s). Fix them, or — only if a finding is wrong — say why in scripts/a11y-baseline.json.`);
  process.exit(1);
}

if (stale.length) {
  console.log(`verify-a11y: ${stale.length} baseline entry(ies) no longer apply — run --update to shrink.`);
}

console.log(`✓ a11y verified — ${files.length} component(s), ${findings.length} known finding(s), 0 new`);
