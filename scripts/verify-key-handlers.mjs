#!/usr/bin/env node
/**
 * scripts/verify-key-handlers.mjs — no global shortcut may eat a keystroke.
 *
 *   pnpm seo:keys
 *
 * THE BUG THIS EXISTS FOR
 *
 * Two components registered `window.addEventListener('keydown', …)` handlers
 * that called `preventDefault()` on the space bar to toggle a carousel. A
 * window listener fires regardless of focus. Both components are mounted on the
 * homepage. The homepage carries the primary lead-capture form.
 *
 * Result: on the highest-traffic page of a business whose entire funnel is
 * "type your project into this box", the space bar did nothing and the arrow
 * keys jumped a carousel instead of moving the cursor. It was reported as a
 * chat-widget bug. The chat widget was innocent. Every text field on the page
 * had it, and it was live.
 *
 * That class of bug is invisible to typecheck, invisible to a build, invisible
 * to every other guard in this repository, and catastrophic to conversion. So
 * it gets its own check.
 *
 * WHAT IS FLAGGED
 *
 * A `window` or `document` keydown/keypress/keyup listener whose handler calls
 * `preventDefault()` and does not consult `lib/keyboard.ts`.
 *
 * WHAT IS NOT FLAGGED
 *
 *   · A handler on a JSX element (`onKeyDown={…}`). Those only fire for that
 *     element, which is the whole difference.
 *   · A global listener that never calls preventDefault — an Escape-to-close
 *     handler reads the key and lets the browser do its thing.
 *   · Anything already wrapped in `whenNotTyping` or checking `isTypingTarget`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const GUARD = 'apps/web/lib/keyboard.ts';
const OPT_OUT = 'keys-allow';

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const EXT = new Set(['.ts', '.tsx']);

function walk(dir, out = []) {
  let e;
  try { e = readdirSync(dir); } catch { return out; }
  for (const n of e) {
    if (SKIP.has(n)) continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (EXT.has(extname(n))) out.push(f);
  }
  return out;
}

const files = ['apps/web', 'packages'].flatMap((d) => walk(join(ROOT, d)));
const violations = [];

/**
 * Find each global listener registration and read the handler it names.
 *
 * Two shapes appear in this codebase and both are checked:
 *   window.addEventListener('keydown', onKey)     — a named handler above
 *   window.addEventListener('keydown', (e) => …)  — an inline arrow
 *
 * For the named form the handler body is located by its declaration. Crude, and
 * correct for every occurrence here; a miss produces a false PASS, so the
 * counter below fails the run if this scanner finds no global listeners at all
 * — that would mean the pattern changed and this went blind.
 */
const REGISTER = /\b(window|document)\.addEventListener\(\s*['"](keydown|keypress|keyup)['"]\s*,\s*([A-Za-z_$][\w$]*)/g;
const INLINE = /\b(window|document)\.addEventListener\(\s*['"](keydown|keypress|keyup)['"]\s*,\s*\(/g;

let globalListeners = 0;

for (const file of files) {
  const rel = relative(ROOT, file);
  if (rel === GUARD) continue;
  const src = readFileSync(file, 'utf8');
  if (src.includes(OPT_OUT)) continue;

  const guarded = /whenNotTyping|isTypingTarget/.test(src);

  for (const m of [...src.matchAll(REGISTER)]) {
    globalListeners++;
    if (guarded) continue;
    const name = m[3];
    /* The handler's body: from its declaration to the end of that statement.
       Looking at the whole file for preventDefault would flag a component that
       has an unrelated JSX handler using it. */
    const decl = new RegExp(`const\\s+${name}\\s*=[\\s\\S]{0,900}`);
    const body = (src.match(decl) || [''])[0];
    if (/preventDefault\s*\(/.test(body)) {
      violations.push({
        rel,
        target: m[1],
        handler: name,
        line: src.slice(0, m.index).split('\n').length,
      });
    }
  }

  for (const m of [...src.matchAll(INLINE)]) {
    globalListeners++;
    if (guarded) continue;
    const after = src.slice(m.index, m.index + 900);
    if (/preventDefault\s*\(/.test(after)) {
      violations.push({
        rel,
        target: m[1],
        handler: '(inline)',
        line: src.slice(0, m.index).split('\n').length,
      });
    }
  }
}

if (globalListeners === 0) {
  console.error(
    '\n✗ found zero global key listeners in the whole tree.\n\n' +
      '  This site has several. Zero means the registration pattern changed and this\n' +
      '  scanner went blind — which would report a clean run over nothing, and this\n' +
      '  repository has shipped that failure six times. Fix the scanner.\n',
  );
  process.exit(1);
}

console.log('');
console.log(`GLOBAL KEY HANDLERS — ${globalListeners} listener(s) on window/document`);
console.log('');

if (violations.length) {
  console.error(`✗ ${violations.length} handler(s) can swallow a keystroke from a text field:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}`);
    console.error(`    ${v.target}.addEventListener('keydown', ${v.handler}) calls preventDefault()`);
    console.error(`    and never checks whether the person is typing.\n`);
  }
  console.error(
    `Wrap it:\n\n` +
      `    import { whenNotTyping } from '@/lib/keyboard';\n` +
      `    const onKey = whenNotTyping((e) => { … });\n\n` +
      `A window listener fires no matter what has focus. If this component renders\n` +
      `anywhere near a form, it is deciding what your customers can type.\n`,
  );
  process.exit(1);
}

console.log('✓ key handlers verified — no global shortcut can steal a keystroke from a text field\n');
process.exit(0);
