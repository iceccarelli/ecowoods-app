import { describe, it, expect, beforeEach, vi } from 'vitest';

type W = { gtag: ReturnType<typeof vi.fn>; dataLayer: unknown[] };
let w: W;

beforeEach(() => {
  vi.resetModules();
  w = { gtag: vi.fn(), dataLayer: [] };
  vi.stubGlobal('window', w);
});

describe('analytics event schema', () => {
  it('classifies conversions, intents and engagement separately', async () => {
    const { eventClass } = await import('@/lib/analytics');
    expect(eventClass('quote_submit')).toBe('conversion');
    expect(eventClass('photo_triage_submit')).toBe('conversion');
    expect(eventClass('workspace_measure_requested')).toBe('conversion');
    expect(eventClass('tel_click')).toBe('intent'); // a tap is not a call
    expect(eventClass('quote_start')).toBe('engagement');
  });

  it('stamps event_class on every event', async () => {
    const { track } = await import('@/lib/analytics');
    track('tel_click', { page: '/contact' });
    expect(w.gtag).toHaveBeenCalledWith('event', 'tel_click', { page: '/contact', event_class: 'intent' });
  });

  it('sends a conversion with the same event_id once per page session', async () => {
    const { track } = await import('@/lib/analytics');
    track('quote_submit', { source: 'home', event_id: 'lead_abc' });
    track('quote_submit', { source: 'home', event_id: 'lead_abc' });
    track('quote_submit', { source: 'home', event_id: 'lead_def' });
    expect(w.gtag).toHaveBeenCalledTimes(2);
  });

  it('drops personal data by key and by value shape', async () => {
    const { scrubParams } = await import('@/lib/analytics');
    const out = scrubParams({
      email: 'jane@example.com',
      phone: '4165550142',
      source: 'jane@example.com',
      label: 'call (416) 555-0142',
      where: 'M5V 3A8',
      design_id: 'ABCD1234EFGH',
      photos: 2,
    });
    expect(out).toEqual({ design_id: 'ABCD1234EFGH', photos: 2 });
  });
});
