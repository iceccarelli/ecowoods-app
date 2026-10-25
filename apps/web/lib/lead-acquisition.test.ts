import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  upsert: vi.fn(async (_a: unknown) => ({})),
  findUnique: vi.fn(async (_a: unknown): Promise<{ channel: string; landing: string } | null> => null),
  findMany: vi.fn(async (_a: unknown): Promise<Array<{ quoteId: string; channel: string }>> => []),
}));
vi.mock('@/lib/db', () => ({ db: { leadAcquisition: db } }));

import { acquisitionByQuote, acquisitionForQuote, recordLeadAcquisition } from './lead-acquisition';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('recordLeadAcquisition', () => {
  it('stores the first touch and never rewrites it (update is empty)', async () => {
    await recordLeadAcquisition('q1', { channel: 'google_search', landing: '/estimate' });
    expect(db.upsert).toHaveBeenCalledWith({
      where: { quoteId: 'q1' },
      create: { quoteId: 'q1', channel: 'google_search', landing: '/estimate' },
      update: {},
    });
  });

  it('writes nothing when no attribution was captured', async () => {
    await recordLeadAcquisition('q1', null);
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it('a missing table (migration not applied) is logged and never thrown into the lead request', async () => {
    db.upsert.mockRejectedValueOnce(new Error('relation "ecowoods.LeadAcquisition" does not exist'));
    await expect(recordLeadAcquisition('q1', { channel: 'chatgpt', landing: '/' })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe('acquisitionForQuote', () => {
  it('returns the stored first touch', async () => {
    db.findUnique.mockResolvedValueOnce({ channel: 'claude', landing: '/pricing' });
    expect(await acquisitionForQuote('q1')).toEqual({ channel: 'claude', landing: '/pricing' });
  });

  it('is null when nothing was captured, when the table is unavailable, or when the stored slug is not recognised', async () => {
    expect(await acquisitionForQuote('q1')).toBeNull();
    db.findUnique.mockRejectedValueOnce(new Error('no table'));
    expect(await acquisitionForQuote('q1')).toBeNull();
    db.findUnique.mockResolvedValueOnce({ channel: 'something_else', landing: '/' });
    expect(await acquisitionForQuote('q1')).toBeNull();
  });
});

describe('acquisitionByQuote', () => {
  it('maps quote ids to channels and is available', async () => {
    db.findMany.mockResolvedValueOnce([{ quoteId: 'a', channel: 'google_search' }, { quoteId: 'b', channel: 'no_referrer' }]);
    const r = await acquisitionByQuote(['a', 'b', 'c']);
    expect(r.available).toBe(true);
    expect([...r.byQuote]).toEqual([['a', 'google_search'], ['b', 'no_referrer']]);
  });

  it('reports UNAVAILABLE (not "not captured") when the table cannot be read', async () => {
    db.findMany.mockRejectedValueOnce(new Error('no table'));
    const r = await acquisitionByQuote(['a']);
    expect(r.available).toBe(false);
    expect(r.byQuote.size).toBe(0);
  });

  it('reads a long window in batches rather than one oversized IN list, and logs a failed read', async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `q${i}`);
    await acquisitionByQuote(ids);
    expect(db.findMany).toHaveBeenCalledTimes(3);
    db.findMany.mockRejectedValueOnce(new Error('boom'));
    const r = await acquisitionByQuote(['a']);
    expect(r.available).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('an empty set needs no query and is available', async () => {
    const r = await acquisitionByQuote([]);
    expect(r.available).toBe(true);
    expect(db.findMany).not.toHaveBeenCalled();
  });
});
