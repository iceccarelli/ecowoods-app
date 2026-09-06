/**
 * lib/registry/changes.ts — the changefeed (Protocol v2, Stage 19).
 *
 * GET /api/v1/changes?since=YYYY-MM-DD
 *
 * Every entry is a dated event that already exists somewhere in the
 * repository: a changelog entry (lib/changelog.ts), a claim's verifiedAt
 * (content/claims.ts), a review row's read date (REVIEW_EVIDENCE), the date
 * the facts were last read live (FACTS_VERIFIED_AT). Nothing here is
 * timestamped at build time; a build is not a change.
 */
import { CHANGELOG } from '@/lib/changelog';
import { CLAIMS } from '@/content/claims';
import { REVIEW_EVIDENCE } from '@ecowoods/shared/constants';
import { SITE_URL } from '@/lib/seo-data';
import { FACTS_VERIFIED_AT, REGISTRY_VERSION, getRegistry } from './registry';

export type ChangeKind =
  | 'price_changed'
  | 'price_verified'
  | 'service_changed'
  | 'location_changed'
  | 'claim_changed'
  | 'claim_verified'
  | 'source_verified'
  | 'source_invalidated'
  | 'page_changed'
  | 'faq_changed'
  | 'contact_changed'
  | 'registry_published';

export type ChangeEvent = {
  id: string;
  date: string;
  kind: ChangeKind;
  subject_id: string;
  title: string;
  url: string;
  note?: string;
};

const abs = (p: string) => (p.startsWith('http') ? p : `${SITE_URL}${p}`);

export async function buildChanges(): Promise<ChangeEvent[]> {
  const reg = await getRegistry();
  const out: ChangeEvent[] = [];

  for (const c of CHANGELOG) {
    out.push({
      id: `change:page:${c.id}`,
      date: c.date,
      kind: 'page_changed',
      subject_id: `page:${c.href.replace(/^\//, '').replace(/\//g, '.')}`,
      title: c.title,
      url: abs(c.href),
      note: c.kind,
    });
  }

  for (const c of CLAIMS) {
    const kind: ChangeKind = c.id.startsWith('pricing.')
      ? 'price_verified'
      : c.id === 'business.phone' || c.id === 'business.address'
        ? 'contact_changed'
        : c.id === 'coverage.serviceAreas'
          ? 'location_changed'
          : c.status === 'unsourced'
            ? 'claim_changed'
            : 'claim_verified';
    out.push({
      id: `change:claim:${c.id}:${c.verifiedAt}`,
      date: c.verifiedAt,
      kind,
      subject_id: `evidence:claim:${c.id}`,
      title: c.statement,
      url: kind === 'price_verified' ? abs('/pricing') : abs('/about'),
      note: c.status === 'unsourced' ? 'Published without a recorded source; fenced out of schema.' : c.source,
    });
  }

  for (const r of REVIEW_EVIDENCE) {
    out.push({
      id: `change:review:${r.platform.toLowerCase()}:${r.asOf}`,
      date: r.asOf,
      kind: 'source_verified',
      subject_id: `review:${r.platform.toLowerCase()}`,
      title: `${r.platform}: ${r.count} reviews at ${r.rating.toFixed(1)}/${r.outOf}, read live.`,
      url: r.href,
    });
  }

  out.push({
    id: `change:registry:${FACTS_VERIFIED_AT}:${REGISTRY_VERSION}`,
    date: FACTS_VERIFIED_AT,
    kind: 'registry_published',
    subject_id: reg.organization.id,
    title: `Registry v${REGISTRY_VERSION}: NAP, hours, founding year and price bands read on the live canonical host.`,
    url: abs('/api/v1/manifest'),
  });

  // Newest first, stable within a day by id.
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)));
}

export const isIsoDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
