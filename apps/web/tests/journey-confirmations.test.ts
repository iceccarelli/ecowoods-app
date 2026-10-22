/**
 * The customer journey's confirmations, through the REAL route handlers.
 *
 * Defects this file pins (each failed on main before the fix):
 *   1. A failed customer confirmation was a console line. The customer thought
 *      nothing had been received and the desk was never told.
 *   2. /api/photo-triage sent the customer nothing at all, and a failed photo
 *      email left the lead's note claiming the photos had been emailed.
 *   3. The corner assistant's create_quote_request sent the customer nothing,
 *      created a second lead for a repeated call, and did not mark an unsaved
 *      lead as NOT SAVED on the SMS alert.
 *   4. Photo-triage funnel rows carried the PAGE as their source, so the
 *      "Photo triage" channel in /admin/funnel was always empty.
 *
 * Only the edges are faked: Prisma, email transport functions, SMS alert, the
 * durable limiter, auth and the language model.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAvailability } from '@/lib/booking/availability';
import { channelOf } from '@/lib/funnel-report';

const h = vi.hoisted(() => ({
  pending: [] as Promise<unknown>[],
  ack: vi.fn(async (_a: unknown) => undefined),
  apptEmail: vi.fn(async (_a: unknown) => undefined),
  adminQuote: vi.fn(async (_a: unknown) => undefined),
  adminFailed: vi.fn(async (_a: unknown) => undefined),
  adminPhotos: vi.fn(async (_a: unknown) => undefined),
  alert: vi.fn(async (_a: unknown) => undefined),
  funnel: vi.fn(async (_a: unknown) => undefined),
  quoteCreate: vi.fn(async (a: { data: Record<string, unknown> }) => ({ id: 'q1', ...a.data })),
  quoteFindFirst: vi.fn(async (_a: unknown): Promise<{ id: string } | null> => null),
  quoteUpdate: vi.fn(async (_a: unknown) => ({})),
  tools: undefined as undefined | Record<string, { execute: (i: unknown) => Promise<unknown> }>,
}));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: (opts: { tools: Record<string, { execute: (i: unknown) => Promise<unknown> }> }) => {
      h.tools = opts.tools;
      return { textStream: (async function* () { /* silent */ })() };
    },
  };
});
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: () => ({}) }));
vi.mock('@/lib/auth', () => ({ auth: async () => null }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: h.alert }));
vi.mock('@/lib/funnel-ledger', () => ({
  recordFunnelEvent: h.funnel,
  sanitiseSource: (v?: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null),
}));
vi.mock('@/lib/rate-limit-durable', () => ({
  enforceRateLimit: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0, degraded: false }),
}));
vi.mock('@/lib/quote-recovery', () => ({ markRecoveryConverted: async () => undefined }));
vi.mock('@/lib/background', () => ({ runAfterResponse: (p: Promise<unknown>) => { h.pending.push(p.catch(() => undefined)); } }));
vi.mock('@/lib/email', () => ({
  sendAdminNewQuoteEmail: h.adminQuote,
  sendQuoteReceivedEmail: h.ack,
  sendAppointmentConfirmationEmail: h.apptEmail,
  sendAdminConfirmationFailedEmail: h.adminFailed,
  sendAdminPhotoTriageEmail: h.adminPhotos,
}));
vi.mock('@/lib/floor-graph', () => ({ recordAssessment: vi.fn(async () => ({ ok: false })), storeAssessmentPhotos: vi.fn() }));
vi.mock('@/lib/floor-graph/consent', () => ({ grantConsent: vi.fn(), readCheckbox: vi.fn(() => false) }));
vi.mock('@/lib/floor-graph/photo-storage', () => ({ storePhoto: vi.fn() }));
vi.mock('@/lib/db', () => {
  const tx = {
    appointment: { findMany: async () => [], create: async () => ({ id: 'a1', startsAt: new Date() }) },
    quoteRequest: { create: h.quoteCreate },
  };
  return {
    db: {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      appointment: { findMany: async () => [] },
      quoteRequest: { create: h.quoteCreate, findFirst: h.quoteFindFirst, update: h.quoteUpdate },
      quoteRecovery: { updateMany: async () => ({ count: 0 }) },
    },
  };
});

const appts = await import('@/app/api/appointments/route');
const leads = await import('@/app/api/leads/route');
const photo = await import('@/app/api/photo-triage/route');
const chat = await import('@/app/api/chat/route');

let ip = 0;
const nextIp = () => `198.18.7.${++ip}`;
const settle = async () => { while (h.pending.length) await Promise.all(h.pending.splice(0)); };

beforeEach(() => {
  vi.clearAllMocks();
  h.pending.length = 0;
  h.quoteCreate.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'q1', ...a.data }));
  h.quoteFindFirst.mockResolvedValue(null);
  for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
});

const alertKinds = () => h.alert.mock.calls.map((c) => (c[0] as { kind: string }).kind);

describe('a failed customer confirmation reaches the desk', () => {
  const slot = () =>
    computeAvailability({ now: new Date(), bookingCounts: new Map() }).days
      .flatMap((d) => d.slots)
      .find((s) => s.available && new Date(s.start).getTime() > Date.now() + 36 * 3600_000)!.start;

  it('booking: still 201 and the desk is told, by SMS and by email, after a retry', async () => {
    h.apptEmail.mockRejectedValue(new Error('provider down'));
    const res = await appts.POST(new Request('https://ecowoods.ca/api/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ startsAt: slot(), name: 'Jane Doe', email: 'jane@example.com', phone: '416-555-0142', postal: 'M5V 3A8', service: 'new-install' }),
    }));
    expect(res.status).toBe(201);
    await settle();
    expect(h.apptEmail).toHaveBeenCalledTimes(2); // one retry
    expect(h.adminQuote).toHaveBeenCalledTimes(1); // the desk's own notification is never held behind it
    expect(alertKinds()).toContain('confirmation email failed');
    expect(h.adminFailed.mock.calls[0]?.[0]).toMatchObject({ kind: 'appointment', ref: 'q1', email: 'jane@example.com' });
  });

  it('booking: no failure report when the confirmation goes out', async () => {
    h.apptEmail.mockResolvedValue(undefined);
    await appts.POST(new Request('https://ecowoods.ca/api/appointments', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ startsAt: slot(), name: 'Jane Doe', email: 'jane2@example.com', phone: '416-555-0142', postal: 'M5V 3A8', service: 'new-install' }),
    }));
    await settle();
    expect(h.apptEmail).toHaveBeenCalledTimes(1);
    expect(h.adminFailed).not.toHaveBeenCalled();
    expect(alertKinds()).not.toContain('confirmation email failed');
  });

  it('estimate form lead: still 201 and the desk is told', async () => {
    h.ack.mockRejectedValue(new Error('provider down'));
    const res = await leads.POST(new Request('https://ecowoods.ca/api/leads', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ name: 'Jane Doe', email: 'jane3@example.com', phone: '(416) 555-0142', postal: 'M5V 3A8', service: 'refinishing', source: 'home' }),
    }));
    expect(res.status).toBe(201);
    await settle();
    expect(h.ack).toHaveBeenCalledTimes(2);
    expect(h.adminQuote).toHaveBeenCalledTimes(1);
    expect(h.adminFailed.mock.calls[0]?.[0]).toMatchObject({ kind: 'lead', email: 'jane3@example.com' });
    h.ack.mockResolvedValue(undefined);
  });
});

describe('POST /api/photo-triage', () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
  const post = (source?: string) => {
    const fd = new FormData();
    fd.set('name', 'Jane Doe');
    fd.set('email', 'photo@example.com');
    fd.set('phone', '(416) 555-0142');
    fd.set('area', 'Etobicoke');
    fd.set('intent', 'refinish');
    if (source) fd.set('source', source);
    fd.append('photos', new File([JPEG], 'a.jpg', { type: 'image/jpeg' }));
    return photo.POST(new Request('https://ecowoods.ca/api/photo-triage', {
      method: 'POST',
      headers: { 'x-requested-with': 'fetch', accept: 'application/json', 'x-forwarded-for': nextIp() },
      body: fd,
    }));
  };

  it('sends the customer an acknowledgement', async () => {
    h.ack.mockResolvedValue(undefined);
    expect((await post()).status).toBe(201);
    await settle();
    expect(h.ack).toHaveBeenCalledTimes(1);
    expect(h.ack.mock.calls[0]?.[0]).toMatchObject({ email: 'photo@example.com', leadId: 'q1' });
  });

  it('tells the desk when the photos email fails, and corrects the lead note', async () => {
    h.adminPhotos.mockRejectedValueOnce(new Error('smtp down'));
    const res = await post();
    expect(res.status).toBe(201);
    await settle();
    expect(alertKinds()).toContain('photos (EMAIL FAILED)');
    const upd = h.quoteUpdate.mock.calls[0]?.[0] as { where: { id: string }; data: { notes: string } };
    expect(upd.where.id).toBe('q1');
    expect(upd.data.notes).toMatch(/PHOTOS NOT DELIVERED/);
    expect(upd.data.notes).not.toMatch(/photos emailed/);
  });

  it('files the funnel row under the Photo triage channel and keeps the page', async () => {
    await post('hardwood-stairs-toronto');
    const row = h.funnel.mock.calls[0]?.[0] as { source: string };
    expect(row.source).toBe('photo-triage:hardwood-stairs-toronto');
    expect(channelOf(row.source, false)).toBe('PHOTO_TRIAGE');
    // The page alone (what was recorded before) is the estimate form.
    expect(channelOf('hardwood-stairs-toronto', false)).toBe('ESTIMATE_FORM');
  });
});

describe('the corner assistant create_quote_request tool', () => {
  const lead = { name: 'Jane Doe', email: 'chat@example.com', phone: '416-555-0142', postal: 'M5V 3A8', service: 'refinishing' };
  const tool = async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const res = await chat.POST(new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    }));
    await res.text();
    return h.tools!.create_quote_request!;
  };

  it('acknowledges the customer by email', async () => {
    h.ack.mockResolvedValue(undefined);
    const t = await tool();
    expect(await t.execute(lead)).toMatchObject({ ok: true, quoteId: 'q1' });
    await settle();
    expect(h.ack).toHaveBeenCalledTimes(1);
    expect(h.ack.mock.calls[0]?.[0]).toMatchObject({ email: 'chat@example.com' });
    expect(h.adminQuote).toHaveBeenCalledTimes(1);
  });

  it('a repeated call is the same lead: no second row, no second alert', async () => {
    h.quoteFindFirst.mockResolvedValue({ id: 'existing-1' });
    const t = await tool();
    expect(await t.execute(lead)).toMatchObject({ ok: true, quoteId: 'existing-1' });
    await settle();
    expect(h.quoteCreate).not.toHaveBeenCalled();
    expect(h.alert).not.toHaveBeenCalled();
    expect(h.ack).not.toHaveBeenCalled();
  });

  it('an unsaved lead is marked NOT SAVED on the SMS alert and the desk email', async () => {
    h.quoteCreate.mockRejectedValue(new Error('db down'));
    const t = await tool();
    expect(await t.execute(lead)).toMatchObject({ ok: true, quoteId: null });
    await settle();
    expect(alertKinds()).toEqual(['lead (NOT SAVED)']);
    expect((h.adminQuote.mock.calls[0]?.[0] as { notes: string }).notes).toMatch(/NOT CONFIRMED SAVED/);
    expect(h.funnel).not.toHaveBeenCalled();
  });
});
