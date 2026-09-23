#!/usr/bin/env node
/**
 * scripts/verify-assistant.mjs — one name per assistant, one closing rule.
 *
 *   pnpm seo:assistant
 *
 * WHY THIS IS AN SEO GUARD AND NOT A BRANDING ONE
 *
 * Every other surface on this site is relentlessly one entity. The schema graph,
 * llms.txt, ai.txt, the citation guide and the framework all say Ecowoods,
 * because the entire retrieval strategy is making one entity unmistakable to
 * machines and to people.
 *
 * Then the one thing a visitor actually talks to introduced itself as
 * "RenoGuide" — a second brand, in the highest-intent moment on the site, in a
 * window a person opened because they were ready to ask a question. It is the
 * same class of leak as two live domains, at a smaller scale.
 *
 * TWO PRODUCTS, TWO GUARDED SURFACES
 *
 * The corner Quick Assistant (`assistant-identity.ts`, "EcowoodsGuide") and the
 * `/assistant` project workspace (`assistant-workspace/identity.ts`, "Ask
 * Francisco" — renamed from "AI Home Advisor" at ASSISTANT-01) are deliberately
 * two products with two names (`NO_DUPLICATION_GUARANTEE.md`). Each gets the
 * same three checks below, independently, against its own identity file and its
 * own retired name(s) — a leak on one surface is still a leak even if the other
 * surface's name is correct.
 *
 * THREE CHECKS (per surface)
 *
 *   1. The retired name(s) appear nowhere.
 *   2. No customer-facing surface types the assistant's name as a literal —
 *      it comes from the surface's identity file, so the next rename is one edit.
 *   3. (Corner widget only) The system prompt still carries the always-close
 *      rule. That rule is the difference between an assistant that answers
 *      questions and one that produces work, and it is exactly the kind of
 *      instruction that gets quietly trimmed when someone shortens a prompt.
 *      The workspace has its own prompt at
 *      apps/web/lib/assistant-workspace/system-prompt.ts (Ask Francisco),
 *      checked separately for whole-home voice and honest pending_key language.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const PROMPT = 'packages/shared/ai/index.ts';
const OPT_OUT = 'assistant-allow';

const read = (p) => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

/**
 * Every guarded assistant surface. `retired` names are kept here, and only
 * here, so the guard can name them — add a surface's retired name the moment
 * it is renamed, never leave the old name to be found only by grep.
 */
const SURFACES = [
  {
    label: 'corner Quick Assistant',
    identity: 'apps/web/lib/assistant-identity.ts',
    retired: ['Reno' + 'Guide', 'reno' + 'guide', 'RENO' + 'GUIDE'],
  },
  {
    label: '/assistant project workspace',
    identity: 'apps/web/lib/assistant-workspace/identity.ts',
    retired: ['AI Home Advisor', 'ai home advisor'],
  },
];

for (const s of SURFACES) {
  const identity = read(s.identity);
  if (!identity) {
    console.error(`\n✗ ${s.identity} is missing. Every surface renders the name from it.\n`);
    process.exit(1);
  }
  s.name = (identity.match(/name:\s*'([^']+)'/) || [, null])[1];
  if (!s.name) {
    console.error(`\n✗ could not read the ${s.label}'s name out of ${s.identity}.\n`);
    process.exit(1);
  }
}

/* Destination /assistant must remain Ask Francisco — never the corner
   widget name (EcowoodsGuide), never a retired product label. */
{
  const dest = SURFACES.find((s) => s.identity.includes('assistant-workspace/identity'));
  if (!dest || dest.name !== 'Ask Francisco') {
    console.error(`\n✗ /assistant destination must be named "Ask Francisco" (got ${dest ? JSON.stringify(dest.name) : 'missing surface'}).\n`);
    process.exit(1);
  }
  const destSrc = read(dest.identity);
  for (const banned of ['EcowoodsGuide', 'Reno' + 'Guide', 'AI Home Advisor']) {
    // name: '...' line only — comments may mention retired names when documenting the rename
    const nameLine = destSrc.split('\n').find((l) => /^\s*name:\s*'/.test(l)) || '';
    if (nameLine.includes(banned)) {
      console.error(`\n✗ /assistant identity name must not be "${banned}".\n`);
      process.exit(1);
    }
  }
  // Public greeting must not close the door to whole-house questions.
  if (/WORKSPACE_GREETING[\s\S]*?floor you're planning/.test(destSrc)) {
    console.error('\n✗ WORKSPACE_GREETING still frames the workspace as floor-only. Restore whole-home renovation narrative.\n');
    process.exit(1);
  }
}

const SKIP = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', '.git']);
const EXT = new Set(['.ts', '.tsx', '.md', '.mdx', '.json']);
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
const problems = [];

/* ── 1 + 2, per surface ───────────────────────────────────────────────── */
for (const file of files) {
  const rel = relative(ROOT, file);
  const src = readFileSync(file, 'utf8');
  if (src.includes(OPT_OUT)) continue;

  for (const s of SURFACES) {
    if (rel === s.identity) continue;            // documents the rename

    src.split('\n').forEach((line, i) => {
      for (const r of s.retired) {
        if (line.includes(r)) {
          problems.push({
            rel, line: i + 1,
            what: `the retired name "${r}" (${s.label}) is still here`,
            why: 'Two names for one assistant is a second brand in the one window a buyer opens deliberately.',
            text: line.trim().slice(0, 110),
          });
        }
      }
      /* The current name typed as a literal in a component. Comments are fine —
         explaining the rename requires naming it. */
      if (!/\.tsx?$/.test(file)) return;
      const t = line.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
      if (rel === PROMPT) return;                 // the prompt states its own name to the model
      if (rel === 'apps/web/lib/assistant-workspace/system-prompt.ts') return;
      if (rel === 'apps/web/app/api/assistant/chat/route.ts') return;
      if (new RegExp(`['"\`>]${s.name}`).test(line)) {
        problems.push({
          rel, line: i + 1,
          what: `"${s.name}" (${s.label}) typed as a literal`,
          why: `Import from ${s.identity}. That is the whole reason the constant exists.`,
          text: t.slice(0, 110),
        });
      }
    });
  }
}

/* ── 3 ────────────────────────────────────────────────────────────────── */
const prompt = read(PROMPT);
const REQUIRED = [
  { needle: 'ALWAYS CLOSE ON WHAT WE WOULD DO', what: 'the always-close rule' },
  { needle: 'WHAT WE OFFER', what: 'the service list the assistant may name' },
  { needle: 'make that step something WE do', what: 'the closing instruction' },
  { needle: 'HARD SCOPE', what: 'the Ecowoods-only scope rule' },
  { needle: 'NEVER recommend', what: 'the never-recommend-a-competitor rule' },
  { needle: 'ALWAYS INCLUDE A LINK', what: 'the mandatory-link rule' },
];
for (const r of REQUIRED) {
  if (!prompt.includes(r.needle)) {
    problems.push({
      rel: PROMPT, line: 0,
      what: `${r.what} is gone from the system prompt`,
      why:
        'An assistant that answers the question and stops has spent the visit and produced ' +
        'nothing. Every reply must end on a specific thing we would do about what was ' +
        'just described, spoken in first person as the company.',
      text: `expected to find: ${r.needle}`,
    });
  }
}
/* The prompt now speaks AS the company (we/our), not ABOUT it in the third
   person — see packages/shared/ai/index.ts's identity line. A stray bare
   "Ecowoods" in the actual prompt STRING (not the surrounding file comments)
   is exactly the narrator voice this rewrite removed. Only the template
   literal itself is checked — a comment explaining the history, like the one
   a few lines below quoting a retired figure, is documentation, not voice. */
{
  const literal = (prompt.match(/ECOWOODS_GUIDE_SYSTEM_PROMPT = `([\s\S]*?)`;/) || [, ''])[1];
  const bodyStart = literal.indexOf('VOICE:');
  const body = bodyStart === -1 ? literal : literal.slice(bodyStart);
  const bareEcowoods = [...body.matchAll(/\bEcowoods\b(?! Inc\.)/g)].filter(
    (m) => !/["'“”]Ecowoods["'“”]/.test(body.slice(Math.max(0, m.index - 1), m.index + 11)),
  );
  if (bareEcowoods.length) {
    problems.push({
      rel: PROMPT, line: 0,
      what: `${bareEcowoods.length} bare "Ecowoods" reference(s) in the prompt body`,
      why: 'The assistant speaks AS the company in first person (we/our) — a third-person "Ecowoods" in the body is the narrator voice this file was rewritten to remove.',
      text: 'expected the body to use we/our/us, or "Ecowoods Inc." by full name',
    });
  }
}

/* The mandatory-link rule is only real if the prompt actually hands the
   model a menu of real pages to cite — "always include a link" with no
   examples is an instruction the model has nothing to satisfy it with.
   Require several distinct https://ecowoods.ca/... URLs in the prompt body,
   not just the bare word "link". */
{
  const literal = (prompt.match(/ECOWOODS_GUIDE_SYSTEM_PROMPT = `([\s\S]*?)`;/) || [, ''])[1];
  const urls = new Set((literal.match(/https:\/\/ecowoods\.ca\/[A-Za-z0-9\-._~/#]*/g) || []));
  if (urls.size < 5) {
    problems.push({
      rel: PROMPT, line: 0,
      what: `only ${urls.size} distinct https://ecowoods.ca/... URL(s) in the prompt`,
      why: 'The mandatory-link rule needs a real menu of pages to point at, not just the instruction to link something. Give at least five concrete destinations.',
      text: 'expected 5+ distinct https://ecowoods.ca/... URLs in the system prompt',
    });
  }
}

/* ── 4 workspace Ask Francisco prompt ─────────────────────────────────── */
const WORKSPACE_PROMPT = 'apps/web/lib/assistant-workspace/system-prompt.ts';
const WORKSPACE_CHAT_ROUTE = 'apps/web/app/api/assistant/chat/route.ts';
{
  const wp = read(WORKSPACE_PROMPT);
  if (!wp) {
    problems.push({
      rel: WORKSPACE_PROMPT, line: 0,
      what: 'Ask Francisco system prompt is missing',
      why: 'The workspace conversation wire needs its own prompt — never reuse ECOWOODS_GUIDE_SYSTEM_PROMPT.',
      text: 'expected apps/web/lib/assistant-workspace/system-prompt.ts',
    });
  } else {
    const REQUIRED_WS = [
      { needle: 'ENTIRE home renovations', what: 'whole-home renovation scope' },
      { needle: 'pending_key', what: 'honest pending_key language for missing adapters' },
      { needle: 'NEVER claim Ecowoods installs kitchens', what: 'never-claim-other-trades rule' },
      { needle: 'propose_conversion', what: 'conversion propose (not direct book) rule' },
      { needle: 'NEVER invent', what: 'never-invent prices/AVMs rule' },
    ];
    for (const r of REQUIRED_WS) {
      if (!wp.includes(r.needle)) {
        problems.push({
          rel: WORKSPACE_PROMPT, line: 0,
          what: `${r.what} is gone from the workspace system prompt`,
          why: 'Ask Francisco advises whole-home with honesty; Ecowoods executes floors/stairs only.',
          text: `expected to find: ${r.needle}`,
        });
      }
    }
  }
  const route = read(WORKSPACE_CHAT_ROUTE);
  if (!route) {
    problems.push({
      rel: WORKSPACE_CHAT_ROUTE, line: 0,
      what: 'workspace chat route is missing',
      why: 'Conversation must use a workspace-owned path, not /api/chat.',
      text: 'expected apps/web/app/api/assistant/chat/route.ts',
    });
  } else {
    for (const banned of ['quoteRequest.create', 'appointment.create', 'db.quoteRequest', 'db.appointment']) {
      if (route.includes(banned)) {
        problems.push({
          rel: WORKSPACE_CHAT_ROUTE, line: 0,
          what: `workspace chat route writes via ${banned}`,
          why: 'Conversion must go through ConversionPanel confirm → /api/appointments|/api/leads, never a second writer.',
          text: banned,
        });
      }
    }
    if (!route.includes('propose_conversion') || !route.includes('get_ecowoods_band')) {
      problems.push({
        rel: WORKSPACE_CHAT_ROUTE, line: 0,
        what: 'workspace chat tools are incomplete',
        why: 'Need get_ecowoods_band + propose_conversion at minimum.',
        text: 'expected get_ecowoods_band and propose_conversion tools',
      });
    }
  }
}

console.log('');
console.log(`ASSISTANT — ${SURFACES.map((s) => `"${s.name}" (${s.label})`).join(', ')}, ${files.length} file(s) scanned`);
console.log('');

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):\n`);
  for (const p of problems) {
    console.error(`  ${p.rel}${p.line ? ':' + p.line : ''}`);
    console.error(`    ${p.text}`);
    console.error(`    → ${p.what}. ${p.why}\n`);
  }
  process.exit(1);
}

console.log(`✓ assistant verified — one name per surface, corner + workspace prompts present, workspace chat does not write appointments/leads\n`);
process.exit(0);
