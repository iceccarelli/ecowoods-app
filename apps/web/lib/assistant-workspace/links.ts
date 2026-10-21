/**
 * lib/assistant-workspace/links.ts — which links Ask Francisco may put in
 * front of a homeowner.
 *
 * Model-written markdown links are untrusted text. A link is rendered only
 * when it points at (a) a route that really exists on this site and is
 * indexable, (b) an https URL on another host, or (c) the company's own
 * published phone or email. Everything else is rendered as plain text by the
 * markdown parser, so a wrong guess shows as words rather than as a 404.
 *
 * The static list below is the set of indexable top-level routes in
 * `app/sitemap.ts`. `tests/assistant-links.test.ts` compares it with the
 * sitemap, so adding or removing a page there fails this list loudly instead
 * of letting it drift. Dynamic sections are accepted by slug shape plus, where
 * a small registry is already in the client bundle (services, service areas),
 * by membership. The large registries (guides, papers, glossary, case
 * studies) are NOT imported here: they would add ~250 KB of source to the
 * /assistant bundle, so the card builders that emit those paths are held to
 * the sitemap by the test instead.
 */
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { SERVICES, SERVICE_AREAS } from '@/lib/seo-data';

export const SITE_HOSTS: readonly string[] = ['ecowoods.ca', 'www.ecowoods.ca'];

export const STATIC_SITE_ROUTES: readonly string[] = [
  '/',
  '/floor-studio',
  '/design',
  '/assistant',
  '/technical-library',
  '/papers',
  '/catalogues',
  '/products/floorforge',
  '/blog',
  '/case-studies',
  '/about',
  '/team',
  '/reviews',
  '/press',
  '/where-we-work',
  '/authority',
  '/framework',
  '/framework/assess',
  '/tools/floor-movement',
  '/projects',
  '/corridors',
  '/quote-check',
  '/equipment',
  '/resources',
  '/market',
  '/whats-new',
  '/standards',
  '/library',
  '/films',
  '/data',
  '/glossary',
  '/guides',
  '/services',
  '/pricing',
  '/estimate',
  '/contact',
  '/refer',
  '/commercial',
  '/realtors',
  '/hardwood-flooring-toronto',
  '/hardwood-floor-refinishing-toronto',
  '/hardwood-stairs-toronto',
  '/best-hardwood-flooring-company-toronto',
  '/best-hardwood-flooring-company-gta',
  '/hardwood-color-matching-toronto',
  '/hardwood-floor-problems-toronto',
  '/service-areas',
  '/privacy',
  '/terms',
];

const STATIC = new Set(STATIC_SITE_ROUTES);

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/** Dynamic sections: the first path segment and how its single slug is checked. */
const DYNAMIC: Record<string, (slug: string) => boolean> = {
  services: (s) => SERVICES.some((x) => x.slug === s),
  'service-areas': (s) => SERVICE_AREAS.some((x) => x.slug === s),
  guides: (s) => SLUG.test(s),
  papers: (s) => SLUG.test(s),
  glossary: (s) => SLUG.test(s),
  'case-studies': (s) => SLUG.test(s),
  blog: (s) => SLUG.test(s),
  projects: (s) => SLUG.test(s),
  equipment: (s) => SLUG.test(s),
  corridors: (s) => SLUG.test(s),
};

/** True when `pathname` (no query or hash) is a real, indexable route on this site. */
export function isKnownSiteRoute(pathname: string): boolean {
  if (!pathname.startsWith('/')) return false;
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (STATIC.has(clean)) return true;
  const parts = clean.split('/').filter(Boolean);
  if (parts.length !== 2) return false;
  const check = DYNAMIC[parts[0]!];
  return !!check && check(parts[1]!);
}

export type ResolvedHref = { href: string; external: boolean };

const digits = (s: string) => s.replace(/\D/g, '');

/**
 * Resolve an href written by the model or built by a card into something safe
 * to render, or null when it must be shown as text only.
 *
 *  - `/path`, `https://ecowoods.ca/path` → internal, returned as `/path`
 *    (a relative href so previews and local dev stay on their own host)
 *  - `https://other.example/...`          → external https
 *  - `tel:` / `mailto:`                   → only the company's published ones
 */
export function resolveSiteHref(raw: string): ResolvedHref | null {
  const href = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (!href || /[\s\\\u0000-\u001f]/.test(href)) return null;

  const lower = href.toLowerCase();
  if (lower.startsWith('tel:')) {
    return digits(href.slice(4)).replace(/^1/, '') === digits(BUSINESS_NAP.phoneE164).replace(/^1/, '')
      ? { href: BUSINESS_NAP.phoneHref, external: false }
      : null;
  }
  if (lower.startsWith('mailto:')) {
    const addr = href.slice(7).split('?')[0]!.toLowerCase();
    return addr === BUSINESS_NAP.email.toLowerCase() ? { href: `mailto:${BUSINESS_NAP.email}`, external: false } : null;
  }

  let path: string;
  if (href.startsWith('/')) {
    if (href.startsWith('//')) return null;
    path = href;
  } else if (/^https:\/\//i.test(href)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return null;
    }
    if (url.username || url.password) return null;
    if (!SITE_HOSTS.includes(url.hostname.toLowerCase())) return { href: url.href, external: true };
    path = `${url.pathname}${url.search}${url.hash}`;
  } else {
    return null;
  }

  const m = /^([^?#]*)(.*)$/.exec(path)!;
  let pathname = m[1]!;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (pathname.split('/').includes('..') || pathname.includes('//')) return null;
  if (!isKnownSiteRoute(pathname)) return null;
  return { href: `${m[1]}${m[2]}`, external: false };
}
