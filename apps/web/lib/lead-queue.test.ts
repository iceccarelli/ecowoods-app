/**
 * lead-queue.test.ts — DESK-01.
 *
 * The ordering assertion is the one that matters. Everything else here is
 * arithmetic; the ordering is the defect.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGE_BAND_LABEL, ageBandFor, ageInDays, buildQueue, summarise, type LeadRow } from './lead-queue';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const NOW = new Date('2026-09-13T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const lead = (over: Partial<LeadRow> = {}): LeadRow => ({
  id: 'q1',
  name: 'A. Homeowner',
  city: 'Etobicoke',
  service: 'installation',
  squareFeet: 900,
  createdAt: daysAgo(1),
  ...over,
});

describe('the defect: newest first buried the oldest', () => {
  it('returns oldest first', () => {
    /* Production, measured: fourteen PENDING, oldest eighty-five days. The
       dashboard took six rows ordered desc, so that enquiry was the last row
       or off the bottom. */
    const q = buildQueue(
      [
        lead({ id: 'new', createdAt: daysAgo(0) }),
        lead({ id: 'old', createdAt: daysAgo(85) }),
        lead({ id: 'mid', createdAt: daysAgo(12) }),
      ],
      NOW,
    );
    expect(q.map((x) => x.id)).toEqual(['old', 'mid', 'new']);
  });

  it('the dashboard query asks the database for oldest first', () => {
    /* Sorting ten rows in memory is useless if the database handed over the
       ten NEWEST. The order has to be in the query. */
    const src = read('app/admin/page.tsx');
    expect(src).toContain("orderBy: { createdAt: 'asc' }");
    expect(src).not.toContain("orderBy: { createdAt: 'desc' },\n      take: 6,");
  });

  it('counts everything waiting, not just the rows it displays', () => {
    /* A panel showing six of fourteen, with no total, reads as six. */
    expect(read('app/admin/page.tsx')).toContain('pendingQuoteCount');
  });
});

describe('age', () => {
  it('is whole days, floored', () => {
    expect(ageInDays(daysAgo(85), NOW)).toBe(85);
    expect(ageInDays(new Date(NOW.getTime() - 3600_000), NOW)).toBe(0);
  });

  it('never goes negative on a clock skew', () => {
    expect(ageInDays(new Date(NOW.getTime() + 86_400_000), NOW)).toBe(0);
  });

  it('bands against the reply time this site publishes, not an invented target', () => {
    /* The estimate form promises a senior estimator replies within one
       business day. Anything past that is late by the site's own standard. */
    expect(ageBandFor(0)).toBe('today');
    expect(ageBandFor(1)).toBe('due');
    expect(ageBandFor(3)).toBe('due');
    expect(ageBandFor(4)).toBe('overdue');
    expect(ageBandFor(30)).toBe('overdue');
    expect(ageBandFor(31)).toBe('cold');
    expect(ageBandFor(85)).toBe('cold');
  });

  it('every band has a label', () => {
    for (const b of ['today', 'due', 'overdue', 'cold'] as const) {
      expect(AGE_BAND_LABEL[b].length).toBeGreaterThan(2);
    }
  });
});

describe('the summary', () => {
  it('reports what is waiting, the oldest, and how many are late', () => {
    const q = buildQueue(
      [lead({ createdAt: daysAgo(85) }), lead({ createdAt: daysAgo(40) }), lead({ createdAt: daysAgo(0) })],
      NOW,
    );
    expect(summarise(q)).toEqual({ waiting: 3, oldestDays: 85, late: 2 });
  });

  it('is zero-safe on an empty queue', () => {
    expect(summarise([])).toEqual({ waiting: 0, oldestDays: 0, late: 0 });
  });
});

describe('it does not invent a price', () => {
  it('shows nothing when the area was not stated', () => {
    /* Most of the real leads have no square footage. A figure guessed for them
       would be a number the owner acts on. */
    const [q] = buildQueue([lead({ squareFeet: null })], NOW);
    expect(q!.indicative).toBeNull();
    expect(buildQueue([lead({ squareFeet: 0 })], NOW)[0]!.indicative).toBeNull();
  });

  it('uses the published bands when the area IS stated', () => {
    const [q] = buildQueue([lead({ squareFeet: 900 })], NOW);
    expect(q!.indicative).not.toBeNull();
    expect(q!.indicative!.high).toBeGreaterThan(q!.indicative!.low);
    expect(q!.indicative!.currency).toBe('CAD');
  });

  it('survives a service the band table does not know', () => {
    /* An unknown service must not take the queue down — the lead still has to
       appear, just without a figure. */
    const [q] = buildQueue([lead({ service: 'something-nobody-published' })], NOW);
    expect(q).toBeDefined();
  });

  it('the dashboard labels it as the published band, not a quote', () => {
    expect(read('app/admin/page.tsx')).toContain('at published bands');
  });
});
