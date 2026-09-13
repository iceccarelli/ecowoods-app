/**
 * authority-routes.test.ts — AUTH-01.
 *
 * The audit measured it: /framework 59 inbound internal links, /papers 39,
 * /guides 34 — the authority tier is the largest accumulation of link equity
 * on this site. And /estimate had SIX inbound links in the whole codebase,
 * none of them from a paper, a guide or a glossary term, while the 47 glossary
 * entries linked to nothing commercial at all.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTHORITY_ROUTES, routeForPaper } from './authority-routes';
import { GLOSSARY } from './glossary';
import { getPapers } from './papers';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const SERVICES = [
  'hardwood-installation',
  'floor-refinishing',
  'dust-free-sanding',
  'floor-restoration',
  'stair-refinishing',
  'custom-inlays',
];

describe('the mapping is small on purpose and honest', () => {
  it('keys on papers that actually exist', () => {
    /* A mapping keyed on a paper slug nobody publishes routes nobody. */
    const published = new Set(getPapers().map((p) => p.slug));
    for (const slug of Object.keys(AUTHORITY_ROUTES)) {
      expect(published.has(slug), `${slug} must be a published paper`).toBe(true);
    }
  });

  it('points only at services that exist', () => {
    for (const [slug, r] of Object.entries(AUTHORITY_ROUTES)) {
      expect(SERVICES, `${slug} routes to a real service`).toContain(r.service);
    }
  });

  it('every entry carries the reason it points where it points', () => {
    /* So somebody who disagrees argues with a sentence rather than guessing at
       an intention. A mapping with no stated reason is a mapping nobody can
       correct. */
    for (const [slug, r] of Object.entries(AUTHORITY_ROUTES)) {
      expect(r.because.length, `${slug} needs a reason`).toBeGreaterThan(40);
      expect(r.label.length).toBeGreaterThan(3);
    }
  });

  it('stays small — this is paper-level, not term-level', () => {
    /* Forty-seven per-term judgements would be forty-seven things nobody ever
       checks, and a wrong one sends somebody with a refinishing question to an
       installation page. Five is reviewable in a minute. */
    expect(Object.keys(AUTHORITY_ROUTES).length).toBeLessThanOrEqual(8);
  });

  it('says nothing rather than guessing', () => {
    expect(routeForPaper(undefined)).toBeNull();
    expect(routeForPaper('a-paper-that-does-not-exist')).toBeNull();
    expect(routeForPaper('')).toBeNull();
  });
});

describe('the glossary is no longer a dead end', () => {
  it('most terms now reach a service', () => {
    /* Not all — a term whose source paper is unmapped renders nothing, and
       that is correct. But the majority should now have a way out. */
    const routed = GLOSSARY.filter((t) => routeForPaper(t.source.paper) !== null);
    expect(routed.length / GLOSSARY.length).toBeGreaterThan(0.5);
  });

  it('the page renders the block and the estimate link', () => {
    const src = read('app/glossary/[slug]/page.tsx');
    expect(src).toContain('routeForPaper');
    expect(src).toContain('href="/estimate"');
  });
});

describe('the papers had no commercial link of any kind', () => {
  it('now carry one', () => {
    const src = read('app/papers/[slug]/page.tsx');
    expect(src).toContain('routeForPaper');
    expect(src).toContain('href="/estimate"');
  });
});

describe('the link is written literally, and that is the point', () => {
  it('no call site hides the href behind a constant', () => {
    /* The first version of this exported an ESTIMATE_HREF constant. It read
       better and it broke `pnpm seo:density`, which extracts LITERAL href
       strings — so the link existed, the page was correct, and the guard
       reported zero CTAs. A constant that hides a link from a link guard is a
       constant that should not exist. */
    expect(read('lib/authority-routes.ts')).not.toContain('export const ESTIMATE_HREF');
    for (const f of [
      'app/glossary/[slug]/page.tsx',
      'app/papers/[slug]/page.tsx',
      'app/guides/[slug]/page.tsx',
    ]) {
      expect(read(f), `${f} must write the href literally`).toContain('href="/estimate"');
    }
  });

  it('the density guard counts the estimate page as a CTA', () => {
    /* WIDENED, disclosed. It counted `/#quote` and not `/estimate`, so moving
       a CTA from a homepage fragment onto the page built for it made a
       compliant page fail. Every href that counted before still counts. */
    const guard = readFileSync(join(WEB, '../../scripts/verify-link-density.mjs'), 'utf8');
    expect(guard).toContain("h === '/estimate'");
    expect(guard).toContain("h === '/#quote'");
  });
});
