import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create, alert, email, funnel } = vi.hoisted(() => ({
  funnel: vi.fn(async (_a: unknown) => undefined),
  create: vi.fn(async (): Promise<{ id: string }> => ({ id: 'q1' })),
  alert: vi.fn(async (_a: unknown) => undefined),
  email: vi.fn(async () => undefined),
}));
vi.mock('@/lib/db', () => ({ db: { quoteRequest: { create } } }));
vi.mock('@/lib/email', () => ({ sendAdminPhotoTriageEmail: email }));
vi.mock('@/lib/funnel-ledger', () => ({ recordFunnelEvent: funnel, sanitiseSource: (v?: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null) }));
vi.mock('@/lib/lead-alert', () => ({ sendLeadAlert: alert }));
vi.mock('@/lib/floor-graph', () => ({ recordAssessment: vi.fn(async () => ({ ok: false })), storeAssessmentPhotos: vi.fn() }));
vi.mock('@/lib/floor-graph/consent', () => ({ grantConsent: vi.fn(), readCheckbox: vi.fn(() => false) }));
vi.mock('@/lib/floor-graph/photo-storage', () => ({ storePhoto: vi.fn() }));

import { POST } from '@/app/api/photo-triage/route';
import { PHOTO_TRIAGE_INTENTS } from '@ecowoods/shared/schemas';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
let n = 0;
const post = () => {
  const fd = new FormData();
  fd.set('name', 'Jane Doe');
  fd.set('email', 'jane@example.com');
  fd.set('phone', '(416) 555-0142');
  fd.set('area', 'Etobicoke');
  fd.set('intent', PHOTO_TRIAGE_INTENTS[0]!);
  fd.append('photos', new File([JPEG], 'a.jpg', { type: 'image/jpeg' }));
  return POST(new Request('https://ecowoods.ca/api/photo-triage', {
    method: 'POST',
    headers: { 'x-requested-with': 'fetch', accept: 'application/json', 'x-forwarded-for': `10.7.0.${++n}` },
    body: fd,
  }));
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of ['log', 'warn', 'error'] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  create.mockResolvedValue({ id: 'q1' });
});

describe('POST /api/photo-triage — desk alert', () => {
  it('texts the desk about a photo lead', async () => {
    const res = await post();
    expect(res.status).toBe(201);
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ kind: 'photos', phone: '(416) 555-0142' });
  });
  it('records a LEAD_CAPTURED funnel event for a saved triage, and none when it was not saved', async () => {
    await post();
    expect(funnel.mock.calls[0]?.[0]).toMatchObject({ stage: 'LEAD_CAPTURED', quoteId: 'q1', source: 'photo-triage' });
    funnel.mockClear();
    create.mockRejectedValue(new Error('db down'));
    await post();
    expect(funnel).not.toHaveBeenCalled();
  });
  it('says NOT SAVED when the database write fails, and still emails the photos', async () => {
    create.mockRejectedValue(new Error('db down'));
    const res = await post();
    expect(res.status).toBe(201);
    expect(alert.mock.calls[0]?.[0]).toMatchObject({ kind: 'lead (NOT SAVED)' });
    expect(email).toHaveBeenCalledTimes(1);
  });
});
