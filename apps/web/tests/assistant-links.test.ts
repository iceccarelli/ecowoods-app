/**
 * Link integrity for Ask Francisco.
 *
 * Every href the assistant can put in front of a homeowner must land on a
 * real, indexable, canonical route of THIS app. "Real, indexable, canonical"
 * is taken from the sitemap (app/sitemap.ts): it lists only canonical,
 * indexable pages, so a path that is absent from it is a 404, a redirect
 * alias, a noindex page or a private surface.
 *
 * The hrefs are enumerated from the code that emits them — the navigation
 * registry behind find_on_site, the headline features in the system prompt,
 * the next_action table, the evidence retrieval corpora, the service cards —
 * not typed here, so a new page or a renamed route fails this file.
 */
import { describe, expect, it } from 'vitest';
import sitemap from '@/app/sitemap';
import { DESTINATIONS } from '@/lib/navigation';
import { headlineFeatures, siteCapabilitiesBlock } from '@/lib/assistant-site';
import { SERVICES, SERVICE_AREAS } from '@/lib/seo-data';
import { GUIDES } from '@/lib/guides';
import { PAPERS } from '@/lib/papers';
import { PILLARS } from '@/lib/framework';
import {
  NEXT_ACTION_HREF,
  executeFindOnSite,
  executeRetrieveEvidence,
  executeSuggestNextAction,
} from '@/lib/assistant-workspace/chat-tools';
import { loadCaseStudyEvidence } from '@/lib/assistant-workspace/value-scenario-evidence';
import { isKnownSiteRoute, resolveSiteHref, STATIC_SITE_ROUTES } from '@/lib/assistant-workspace/links';
import { parseInline, parseMarkdown } from '@/lib/assistant-workspace/markdown';
import type { AssistantChatCard } from '@/lib/assistant-workspace/chat-schema';

const SITE = 'https://ecowoods.ca';
/** Built by concatenation so scripts/verify-destinations.mjs does not read a deliberately bad target as a real link. */
const md = (label: string, target: string) => '[' + label + '](' + target + ')';
const DYNAMIC_SECTIONS = ['services', 'service-areas', 'guides', 'papers', 'glossary', 'case-studies', 'blog', 'projects', 'equipment', 'corridors'];

async function sitemapPaths(): Promise<Set<string>> {
  const entries = await sitemap();
  return new Set(entries.map((e) => (e.url === SITE ? '/' : e.url.replace(SITE, ''))));
}

const pathOf = (href: string) => {
  const u = new URL(href, SITE);
  return u.pathname;
};

describe('the known-route list agrees with the sitemap', () => {
  it('every static route is a sitemap URL', async () => {
    const paths = await sitemapPaths();
    for (const r of STATIC_SITE_ROUTES) expect(paths.has(r), `${r} is not in the sitemap`).toBe(true);
  });

  it('every non-dynamic sitemap URL is in the static list (so a new page is linkable)', async () => {
    const paths = await sitemapPaths();
    for (const p of paths) {
      const section = p.split('/')[1];
      if (DYNAMIC_SECTIONS.includes(section!) && p.split('/').length > 2) continue;
      if (p.endsWith('.pdf')) continue;
      expect(STATIC_SITE_ROUTES, `${p} is indexable but unknown to the assistant`).toContain(p);
    }
  });
});

describe('every href the assistant can emit resolves to a sitemap route', () => {
  const collect = async () => {
    const hrefs: { from: string; href: string }[] = [];
    const add = (from: string, href: string | undefined) => {
      if (href) hrefs.push({ from, href });
    };

    for (const d of DESTINATIONS) add('navigation DESTINATIONS', d.href);
    for (const f of headlineFeatures()) add('headline features', f.href);
    for (const [kind, href] of Object.entries(NEXT_ACTION_HREF)) add(`NEXT_ACTION_HREF.${kind}`, href);
    for (const s of SERVICES) add('ServiceCard', `/services/${s.slug}`);
    for (const c of SERVICE_AREAS) add('service areas', `/service-areas/${c.slug}`);

    // Cards built by the tools: site_link (find_on_site), next_action, evidence.
    const cards: AssistantChatCard[] = [];
    for (const d of DESTINATIONS) cards.push(...executeFindOnSite(`${d.label} ${d.note ?? ''}`).cards);
    for (const kind of [...Object.keys(NEXT_ACTION_HREF), 'not-a-kind']) {
      cards.push(executeSuggestNextAction({ action: kind, body: 'x' }).card);
    }
    const pool = await loadCaseStudyEvidence();
    const topics = [
      ...GUIDES.map((g) => `${g.title} ${g.question}`),
      ...PAPERS.map((p) => `${p.title} ${p.topics.join(' ')}`),
      ...PILLARS.map((p) => `${p.name} ${p.intent}`),
      ...pool.map((c) => `${c.title} ${c.neighbourhood}`),
    ];
    for (const t of topics) cards.push(...executeRetrieveEvidence(t, pool).cards);
    for (const c of pool) add('case-study evidence pool', c.url);

    for (const c of cards) {
      if ('href' in c) add(`card:${c.type}`, c.href);
    }
    return hrefs;
  };

  it('enumerates a non-trivial set (guards against the collector silently going empty)', async () => {
    const hrefs = await collect();
    expect(hrefs.length).toBeGreaterThan(80);
    expect(new Set(hrefs.map((h) => h.from.split(':')[0])).size).toBeGreaterThanOrEqual(8);
  });

  it('each one is accepted by the runtime link rule and is a canonical sitemap route', async () => {
    const paths = await sitemapPaths();
    const bad: string[] = [];
    for (const { from, href } of await collect()) {
      const resolved = resolveSiteHref(href);
      if (!resolved || resolved.external) {
        bad.push(`${from}: ${href} is not accepted as a same-site route`);
        continue;
      }
      if (!paths.has(pathOf(href))) bad.push(`${from}: ${href} is not a sitemap (indexable, canonical) route`);
    }
    expect(bad).toEqual([]);
  });

  it('the system prompt only names paths that exist', async () => {
    const paths = await sitemapPaths();
    const named = [...siteCapabilitiesBlock().matchAll(/^- (\/[^\s]*) —/gm)].map((m) => pathOf(m[1]!));
    expect(named.length).toBeGreaterThan(3);
    for (const p of named) expect(paths.has(p), p).toBe(true);
  });
});

describe('resolveSiteHref — what a model-written link may become', () => {
  it('keeps known same-site routes, with hash and query, as relative hrefs', () => {
    expect(resolveSiteHref('/estimate')).toEqual({ href: '/estimate', external: false });
    expect(resolveSiteHref('/floor-studio#live')).toEqual({ href: '/floor-studio#live', external: false });
    expect(resolveSiteHref('https://ecowoods.ca/pricing')).toEqual({ href: '/pricing', external: false });
    expect(resolveSiteHref('https://www.ecowoods.ca/services/floor-refinishing/')?.external).toBe(false);
  });

  it('rejects unknown internal paths, other sections and path tricks', () => {
    for (const bad of ['/not-a-page', '/admin', '/mypage', '/api/leads', '/services/not-a-service', '/guides/Bad Slug', '/estimate/../admin', '//evil.example/estimate', '/guides/x/y']) {
      expect(resolveSiteHref(bad), bad).toBeNull();
    }
    expect(isKnownSiteRoute('/login')).toBe(false);
  });

  it('allows https elsewhere, but never http, other schemes, credentials or lookalike hosts as ours', () => {
    expect(resolveSiteHref('https://creativecommons.org/licenses/by/4.0/')).toEqual({ href: 'https://creativecommons.org/licenses/by/4.0/', external: true });
    expect(resolveSiteHref('http://example.org/a')).toBeNull();
    expect(resolveSiteHref('javascript:alert(1)')).toBeNull();
    expect(resolveSiteHref('data:text/html,hi')).toBeNull();
    expect(resolveSiteHref('https://user:pw@example.org/')).toBeNull();
    expect(resolveSiteHref('https://ecowoods.ca.evil.example/pricing')?.external).toBe(true);
    expect(resolveSiteHref('https://ecowoods.ca/nope')).toBeNull();
  });

  it('allows only the company phone and email', () => {
    expect(resolveSiteHref('tel:+16472445156')?.href).toBe('tel:+16472445156');
    expect(resolveSiteHref('tel:6472445156')?.href).toBe('tel:+16472445156');
    expect(resolveSiteHref('tel:+14165550100')).toBeNull();
    expect(resolveSiteHref('mailto:services@ecowoods.ca')?.href).toBe('mailto:services@ecowoods.ca');
    expect(resolveSiteHref('mailto:someone@else.example')).toBeNull();
  });
});

describe('markdown links are sanitised by the parser', () => {
  it('a link to an unknown internal path renders as its label only', () => {
    const nodes = parseInline(md('our hidden page', '/secret-page') + ' now.');
    expect(nodes.some((n) => n.t === 'link')).toBe(false);
    expect(nodes.map((n) => (n.t === 'text' ? n.text : '')).join('')).toBe('our hidden page now.');
  });

  it('a link to a real route survives, and an absolute site URL becomes relative', () => {
    const [p] = parseMarkdown('Start at [the estimate](https://ecowoods.ca/estimate).');
    expect(p).toMatchObject({ t: 'p' });
    const link = (p as { children: { t: string; href?: string }[] }).children.find((n) => n.t === 'link');
    expect(link?.href).toBe('/estimate');
  });
});
