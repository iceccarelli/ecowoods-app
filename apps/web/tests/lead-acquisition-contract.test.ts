/**
 * The first-touch acquisition contract at both lead entrances.
 *
 *   - a valid channel + plain landing path is stored (best-effort) and shown to
 *     the desk in the lead notes and in the notification email;
 *   - anything invalid, hostile or private is dropped, never stored, and NEVER
 *     costs the lead;
 *   - a repeated submission creates nothing and so cannot overwrite the first touch;
 *   - a table that is not there (migration not applied) changes nothing for the lead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  create: vi.fn(async (_a: unknown): Promise<{ id: string }> => ({ id: 'q_new' })),
  findFirst: vi.fn(async (_a: unknown): Promise<{ id: string } | null> => null),
  record: vi.fn(async (_id: string, _a: unknown) => undefined),
  admin: vi.fn(async (_a: unknown) => undefined),
  photoEmail: vi.fn(async (_a: unknown) => undefined),
}));

vi.mock('@/lib/db', () => ({
  db: { quoteRequest: { create: h.create, findFirst: h.findFirst }, quoteRecovery: { updateMany: vi.fn(async () => ({ count: 0 })) } },
}));
vi.mock('@/lib/auth', () => ({ auth: vi.fn(async () => null) }));
vi.mock('@/lib/email', () => ({
  sendAdminNewQuoteEmail: h.admin,
  sendQuoteReceivedEmail: vi.fn(async () => undefined),
  sendAdminPhotoTriageEmail: h.photoEmail,
}));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: vi.fn(async () => undefined) }));
vi.mock('@/lib/funnel-ledger', () => ({
  recordFunnelEvent: vi.fn(async () => undefined),
  sanitiseSource: (v?: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null),
}));
vi.mock('@/lib/lead-acquisition', () => ({ recordLeadAcquisition: h.record }));
vi.mock('@/lib/floor-graph', () => ({ recordAssessment: vi.fn(async () => ({ ok: false })), storeAssessmentPhotos: vi.fn() }));
vi.mock('@/lib/floor-graph/consent', () => ({ grantConsent: vi.fn(), readCheckbox: vi.fn(() => false) }));
vi.mock('@/lib/floor-graph/photo-storage', () => ({ storePhoto: vi.fn() }));

import { POST as postLead } from '@/app/api/leads/route';
import { POST as postPhotos } from '@/app/api/photo-triage/route';
import { PHOTO_TRIAGE_INTENTS } from '@ecowoods/shared/schemas';

let n = 0;
const lead = (extra: Record<string, unknown> = {}) =>
  postLead(
    new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.0.${++n}` },
      body: JSON.stringify({
        name: 'Jane Doe', email: 'jane@example.com', phone: '(416) 555-0142', postal: 'M5V 3A8',
        service: 'refinishing', source: 'service-areas-oakville', ...extra,
      }),
    }),
  );

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const photos = (extra: Record<string, string> = {}) => {
  const fd = new FormData();
  fd.set('name', 'Jane Doe');
  fd.set('email', 'jane@example.com');
  fd.set('phone', '(416) 555-0142');
  fd.set('area', 'Etobicoke');
  fd.set('intent', PHOTO_TRIAGE_INTENTS[0]!);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  fd.append('photos', new File([JPEG], 'a.jpg', { type: 'image/jpeg' }));
  return postPhotos(new Request('https://ecowoods.ca/api/photo-triage', {
    method: 'POST',
    headers: { 'x-requested-with': 'fetch', accept: 'application/json', 'x-forwarded-for': `10.9.1.${++n}` },
    body: fd,
  }));
};

const createdNotes = () => ((h.create.mock.calls[0]?.[0] as { data: { notes?: string | null } }).data.notes ?? '');
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  h.create.mockResolvedValue({ id: 'q_new' });
  h.findFirst.mockResolvedValue(null);
  h.record.mockResolvedValue(undefined);
});

describe('POST /api/leads — first-touch acquisition', () => {
  it('stores a valid channel and landing, and shows it to the desk in the notes and the notification email', async () => {
    const res = await lead({ acquisitionChannel: 'google_search', acquisitionLanding: '/service-areas/oakville' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.record).toHaveBeenCalledWith('q_new', { channel: 'google_search', landing: '/service-areas/oakville' });
    expect(createdNotes()).toContain('Found us via: Google search → /service-areas/oakville');
    expect(JSON.stringify(h.admin.mock.calls[0]?.[0])).toContain('Found us via: Google search → /service-areas/oakville');
  });

  it('drops an unknown channel without rejecting the lead, and records nothing', async () => {
    const res = await lead({ acquisitionChannel: 'Google search; drop table', acquisitionLanding: '/estimate' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.record).toHaveBeenCalledWith('q_new', null);
    expect(createdNotes()).not.toContain('Found us via');
  });

  it('keeps a valid channel but sanitises a private or query-string landing to the site root', async () => {
    for (const landing of ['/floor-plan/SECRET-TOKEN', '/estimate?q=private+search', 'https://evil.example/x', '/mypage/invoices']) {
      h.record.mockClear();
      const res = await lead({ acquisitionChannel: 'chatgpt', acquisitionLanding: landing });
      expect(res.status).toBe(201);
      await settle();
      expect(h.record).toHaveBeenCalledWith('q_new', { channel: 'chatgpt', landing: '/' });
    }
  });

  it('a lead without any attribution is still a lead, recorded as not captured', async () => {
    const res = await lead();
    expect(res.status).toBe(201);
    await settle();
    expect(h.record).toHaveBeenCalledWith('q_new', null);
    expect(createdNotes()).not.toContain('Found us via');
  });

  it('a repeated submission creates nothing, so it cannot overwrite the original first touch', async () => {
    h.findFirst.mockResolvedValue({ id: 'q_original' });
    const res = await lead({ acquisitionChannel: 'perplexity', acquisitionLanding: '/pricing' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  });

  it('the lead.captured log line carries the validated attribution, never the raw client strings', async () => {
    const log = vi.spyOn(console, 'log');
    await lead({ acquisitionChannel: 'chatgpt', acquisitionLanding: '/?token=abc&q=private+search' });
    const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes('lead.captured')) ?? '';
    expect(line).toContain('"acquisitionLanding":"/"');
    expect(line).not.toContain('token=abc');
    expect(line).not.toContain('private+search');
  });
});

describe('POST /api/photo-triage — first-touch acquisition', () => {
  it('stores a valid channel and landing and writes the desk note', async () => {
    const res = await photos({ acquisitionChannel: 'bing_search', acquisitionLanding: '/hardwood-stairs-toronto' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.record).toHaveBeenCalledWith('q_new', { channel: 'bing_search', landing: '/hardwood-stairs-toronto' });
    expect(createdNotes()).toContain('Found us via: Bing search → /hardwood-stairs-toronto');
  });

  it('an invalid channel never rejects the photo lead and is not stored', async () => {
    const res = await photos({ acquisitionChannel: '<script>', acquisitionLanding: '/estimate' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.record).toHaveBeenCalledWith('q_new', null);
    expect(createdNotes()).not.toContain('Found us via');
  });

  it('records nothing when the lead itself was not saved', async () => {
    h.create.mockRejectedValue(new Error('db down'));
    const res = await photos({ acquisitionChannel: 'google_search', acquisitionLanding: '/estimate' });
    expect(res.status).toBe(201);
    await settle();
    expect(h.record).not.toHaveBeenCalled();
  });
});
