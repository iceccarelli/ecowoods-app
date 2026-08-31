#!/usr/bin/env node
/**
 * scripts/verify-conversion.mjs — the page that earns the click can take the job.
 *
 * WHY THIS EXISTS — F-160 through F-162
 *
 * Two independent audits of this site opened with the same finding, and it had
 * survived thirty-nine guards:
 *
 *   `<form>` count 0. `<input>` count 0. On every page.
 *
 * The estimate form existed, but only inside a React modal rendered behind
 * `{estimateModalOpen && …}`, on the homepage. Every commercial page's primary
 * button pointed at `/#quote` — a different url, whose form appears only after
 * hydration and a click. A business publishing 286 pages of sourced authority
 * was collecting jobs through a phone number.
 *
 * Two more of the same shape, found in the same audits:
 *
 *   F-161  /api/knowledge was `export const dynamic = 'force-static'`. Next
 *          prerenders such a route once, and `searchParams` is then always
 *          empty — so `?q=` and `?collection=`, both advertised in the route's
 *          own `meta.usage`, silently returned the entire 330 KB corpus. The
 *          filter code was correct and could never run.
 *
 *   F-162  /papers said every paper was "downloadable as a PDF" and the API
 *          emitted a versioned `pdfUrl` for all five, while public/papers/ was
 *          empty. Every one 404'd.
 *
 * Nothing in this repository could see any of them, because every guard here
 * reads a manifest and asks whether it agrees with itself. These three are
 * about whether the site DOES what it SAYS. That is a different question and it
 * needs its own guard.
 *
 *   node scripts/verify-conversion.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'apps/web/app');
const problems = [];
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

/**
 * Strip comments before pattern-matching source.
 *
 * The first version of check 4 failed on the very file it had just fixed,
 * because the fix's own comment explains the bug and therefore contains the
 * string it was scanning for. A guard that cannot tell code from prose about
 * code will fail on every well-documented fix, which teaches people to stop
 * documenting fixes. Line comments are kept when preceded by `:` so a `https://`
 * inside a string survives — the same guard verify-schema-figures.mjs uses.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/([^:])\/\/[^\n]*/g, '$1');

/**
 * The pages that carry the money queries. If one of these cannot take a job,
 * nothing else on this site matters that day.
 */
const COMMERCIAL = [
  'apps/web/app/hardwood-flooring-toronto/page.tsx',
  'apps/web/app/hardwood-floor-refinishing-toronto/page.tsx',
  'apps/web/app/hardwood-stairs-toronto/page.tsx',
  'apps/web/app/hardwood-floor-problems-toronto/page.tsx',
  /* P1. A commercial page without a form on it is a page that asks a property
     manager or an agent to go and find one. Both render EstimateForm, so both
     are held to the same no-JavaScript standard as the head terms. */
  'apps/web/app/commercial/page.tsx',
  'apps/web/app/realtors/page.tsx',
  'apps/web/app/services/[slug]/page.tsx',
  /* The homepage kept a <button> that opened a modal long after the five
     commercial pages had a real form, so the busiest url on the site still
     served zero <form> elements — and the site chrome had no `#estimate` to
     point at, which is how verify-links.mjs caught it. */
  'apps/web/app/home-client.tsx',
];

/* ── 1. every commercial page renders a real form ────────────────────────── */
for (const rel of COMMERCIAL) {
  const src = read(path.join(ROOT, rel));
  if (!src) { problems.push({ rel, why: 'missing — this is a commercial page' }); continue; }
  if (!/<EstimateForm\b/.test(src)) {
    problems.push({
      rel,
      why:
        'renders no <EstimateForm>. A visitor who has read the price and decided cannot send\n' +
        '      the job from the page that convinced them. That is F-160, and it is the single\n' +
        '      most expensive defect this site has had.',
    });
  }
  if (/href="\/#quote"/.test(src)) {
    problems.push({
      rel,
      why:
        'still links to /#quote. That anchor is on a DIFFERENT url and the form there only\n' +
        '      exists after hydration and a click. Link to #estimate on this page instead.',
    });
  }
}

/* ── 2. the form component still submits without JavaScript ──────────────── */
{
  const rel = 'apps/web/app/components/EstimateForm.tsx';
  const src = read(path.join(ROOT, rel));
  if (!src) problems.push({ rel, why: 'missing — every commercial page imports it' });
  else {
    if (!/<form[^>]*method="post"/.test(src) || !/action="\/api\/leads"/.test(src)) {
      problems.push({
        rel,
        why:
          'the <form> lost method="post" action="/api/leads". Without those it works only while\n' +
          '      JavaScript does, which is the condition F-160 was about. The native POST is the\n' +
          '      floor under the enhancement, not a nicety.',
      });
    }
    if (!/name="company"/.test(src)) {
      problems.push({ rel, why: 'the honeypot field is gone — api/leads still checks `company`' });
    }
  }
}

/* ── 3. the API accepts what the form sends ──────────────────────────────── */
{
  const rel = 'apps/web/app/api/leads/route.ts';
  const src = read(path.join(ROOT, rel));
  if (!/formData\(\)/.test(src) || !/isFormPost/.test(src)) {
    problems.push({
      rel,
      why:
        'no longer reads form-encoded bodies. A browser with no JavaScript posts\n' +
        '      application/x-www-form-urlencoded; JSON-only parsing turns that into a 400 and\n' +
        '      loses the lead exactly when the client is least capable.',
    });
  }
  /* The order is the invariant. Durable log BEFORE the rate limiter, always. */
  const iLog = src.indexOf("event: 'lead.captured'");
  const iRate = src.indexOf('checkRateLimit(getClientIp');
  if (iLog < 0 || iRate < 0 || iLog > iRate) {
    problems.push({
      rel,
      why:
        'the durable capture log no longer runs BEFORE the rate limiter. That ordering is the\n' +
        '      lead-capture invariant: a false-positive rate limit must inconvenience someone,\n' +
        '      never erase them.',
    });
  }
}

/* ── 4. force-static kills searchParams. Nothing warns you. ──────────────── */
/**
 * The generalised form of F-161, and the most valuable check in this file.
 * `export const dynamic = 'force-static'` on a handler that reads searchParams
 * is not an error, not a warning, and not visible in the response. The route
 * simply answers every query with the same prerendered body, forever.
 */
{
  const routes = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (e.name === 'route.ts' || e.name === 'route.tsx') routes.push(p);
    }
  })(APP);

  for (const file of routes) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    if (!/dynamic\s*=\s*'force-static'/.test(src)) continue;
    if (!/searchParams/.test(src)) continue;
    problems.push({
      rel: path.relative(ROOT, file),
      why:
        "reads searchParams while declaring dynamic = 'force-static'.\n" +
        '      Next prerenders the route once at build time and searchParams is then ALWAYS EMPTY,\n' +
        '      so every query string returns the same body. No error is raised and nothing in the\n' +
        "      response says the query was discarded. Use 'force-dynamic' — the CDN still caches,\n" +
        '      and its cache key is the full URL including the query.',
    });
  }
}

/* ── 5. do not advertise a download that does not exist ──────────────────── */
{
  const pdfDir = path.join(ROOT, 'apps/web/public/papers');
  const havePdf = fs.existsSync(pdfDir) && fs.readdirSync(pdfDir).some((f) => f.endsWith('.pdf'));
  const papersPage = read(path.join(ROOT, 'apps/web/app/papers/page.tsx'));
  if (!havePdf && /downloadable as a PDF/i.test(stripComments(papersPage))) {
    problems.push({
      rel: 'apps/web/app/papers/page.tsx',
      why:
        'promises a PDF download while apps/web/public/papers/ holds no PDF. Every advertised\n' +
        '      file 404s. Ship the exports or drop the sentence — an agent that follows a machine\n' +
        '      surface to a 404 stops trusting the surface.',
    });
  }
  const api = read(path.join(ROOT, 'apps/web/app/api/knowledge/route.ts'));
  if (/pdfUrl:/.test(api) && !/pdfIsPublished/.test(api)) {
    problems.push({
      rel: 'apps/web/app/api/knowledge/route.ts',
      why: 'emits pdfUrl unconditionally. Gate it on pdfIsPublished() so the API never names a 404.',
    });
  }
}

/* ── 6. the chrome keeps the phone, and the tree survives the phone ──────── */
/**
 * The AWS layout patterns this site adopted are mechanisms, and each one exists
 * because something measurable was wrong. A guard per mechanism, so the reason
 * survives the next redesign.
 */
{
  const ub = read(path.join(ROOT, 'apps/web/app/components/UtilityBar.tsx'));
  const layout = read(path.join(ROOT, 'apps/web/app/layout.tsx'));
  if (!ub) {
    problems.push({ rel: 'apps/web/app/components/UtilityBar.tsx', why: 'missing — the phone number returns to being homepage-only' });
  } else if (!/phoneHref/.test(ub) || !/phoneDisplay/.test(ub)) {
    problems.push({
      rel: 'apps/web/app/components/UtilityBar.tsx',
      why:
        'no longer renders the phone number. The strip exists so a trade business has its\n' +
        '      highest-converting element on every page without spending a slot in the primary nav.',
    });
  }
  if (ub && !/<UtilityBar/.test(layout)) {
    problems.push({ rel: 'apps/web/app/layout.tsx', why: 'does not render <UtilityBar> — the strip exists and appears nowhere' });
  }

  const header = read(path.join(ROOT, 'apps/web/app/components/Header.tsx'));
  if (!/<MegaMenu/.test(header)) {
    problems.push({
      rel: 'apps/web/app/components/Header.tsx',
      why:
        'no <MegaMenu>. Five papers, sixteen guides, forty-four glossary terms and nine\n' +
        '      standards go back to being reachable only by guessing which of eight hubs to open.\n' +
        '      Two independent audits scored information architecture 5/10 and 6/10 for exactly this.',
    });
  }
  if (/<MegaMenu/.test(header) && !/mnav-group/.test(header)) {
    problems.push({
      rel: 'apps/web/app/components/Header.tsx',
      why:
        'has a mega-menu and no mobile accordion. .mm is display:none under 1000px, so the\n' +
        '      whole library tree would exist on a desktop and vanish on the phone — which is where\n' +
        '      a homeowner actually reads about cupping at 9pm.',
    });
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */
if (problems.length) {
  console.error(`\n✗ ${problems.length} conversion / truth violation(s):\n`);
  for (const p of problems) console.error(`  ${p.rel}\n      ${p.why}\n`);
  console.error(
    '  Every other guard here asks whether a manifest agrees with itself. These ask whether\n' +
      '  the site does what it says. See the header of this file.\n',
  );
  process.exit(1);
}
console.log(
  `✓ conversion verified — ${COMMERCIAL.length} commercial page(s) render a real form that posts ` +
    'without JavaScript, no force-static route reads searchParams, no advertised PDF is missing',
);
