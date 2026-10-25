import { describe, it, expect, vi, afterEach } from 'vitest';
import { ACQUISITION_CHANNELS, ACQUISITION_LABEL, acquisitionNote, captureAcquisition, classifyReferrer, landingPath, parseAcquisition } from './acquisition';

const own = 'ecowoods.ca';

describe('classifyReferrer', () => {
  it('names search engines and AI assistants by host only', () => {
    expect(classifyReferrer('https://www.google.com/search?q=hardwood+floor+refinishing+oakville', false, own)).toBe('google_search');
    expect(classifyReferrer('https://www.google.ca/', false, own)).toBe('google_search');
    expect(classifyReferrer('https://chatgpt.com/', false, own)).toBe('chatgpt');
    expect(classifyReferrer('https://www.perplexity.ai/search/abc', false, own)).toBe('perplexity');
    expect(classifyReferrer('https://gemini.google.com/app', false, own)).toBe('gemini');
    expect(classifyReferrer('https://claude.ai/chat/1', false, own)).toBe('claude');
    expect(classifyReferrer('https://www.bing.com/', false, own)).toBe('bing_search');
  });

  it('does not mistake a look-alike host for a known one', () => {
    for (const u of ['https://notgoogle.com/', 'https://evilchatgpt.com/', 'https://google.evil.com/', 'https://google.com.evil.net/']) {
      expect(classifyReferrer(u, false, own)).toBe('other_site');
    }
  });

  it('falls back to campaign, then no_referrer, then other_site; www and bare domain are one site', () => {
    expect(classifyReferrer('', true, own)).toBe('campaign');
    expect(classifyReferrer('', false, own)).toBe('no_referrer');
    expect(classifyReferrer('not a url', false, own)).toBe('no_referrer');
    // This site as the referrer means the visit was already under way: not a first touch, so nothing is recorded.
    expect(classifyReferrer('https://www.ecowoods.ca/pricing', false, own)).toBeNull();
    expect(classifyReferrer('https://ecowoods.ca/pricing', false, 'www.ecowoods.ca')).toBeNull();
    expect(classifyReferrer('https://ecowoods.ca/pricing', true, own)).toBeNull();
    expect(classifyReferrer('https://some-blog.example/post', false, own)).toBe('other_site');
  });

  it('a known referrer wins over a utm_source tag (ChatGPT adds utm_source to the links it cites)', () => {
    expect(classifyReferrer('https://www.google.com/', true, own)).toBe('google_search');
    expect(classifyReferrer('https://chatgpt.com/', true, own)).toBe('chatgpt');
  });
});

describe('landingPath', () => {
  it('keeps plain public page addresses and drops anything that could carry a token or belong to a signed-in visitor', () => {
    expect(landingPath('/service-areas/oakville')).toBe('/service-areas/oakville');
    expect(landingPath('/estimate')).toBe('/estimate');
    for (const p of ['/r/abc123', '/floor-plan/XYZ', '/mypage/invoices', '/share/me@example.com', '/pages/file.html', '/a%20b']) expect(landingPath(p)).toBe('/');
    expect(landingPath('/blog/a/b/c/d')).toBe('/blog/a/b'); // a deeper public page is kept, truncated, not mistaken for the homepage
    expect(landingPath('/')).toBe('/');
  });
});

describe('parseAcquisition', () => {
  it('accepts a channel from the closed set with a plain landing path', () => {
    expect(parseAcquisition('google_search', '/service-areas/oakville')).toEqual({ channel: 'google_search', landing: '/service-areas/oakville' });
  });

  it('drops anything outside the closed set instead of rejecting the lead', () => {
    expect(parseAcquisition('Google search', '/x')).toBeNull();
    expect(parseAcquisition('x'.repeat(500), '/x')).toBeNull();
    expect(parseAcquisition(undefined, '/x')).toBeNull();
    expect(parseAcquisition({ channel: 'chatgpt' }, '/x')).toBeNull();
  });

  it('sanitises a hostile landing value to the site root', () => {
    expect(parseAcquisition('chatgpt', '/floor-plan/SECRET')).toEqual({ channel: 'chatgpt', landing: '/' });
    expect(parseAcquisition('chatgpt', 'https://evil.example/?q=1')).toEqual({ channel: 'chatgpt', landing: '/' });
    expect(parseAcquisition('chatgpt', 42)).toEqual({ channel: 'chatgpt', landing: '/' });
  });
});

describe('acquisitionNote and labels', () => {
  it('is one short readable line, null when nothing was captured', () => {
    expect(acquisitionNote({ channel: 'google_search', landing: '/service-areas/oakville' })).toBe('Found us via: Google search → /service-areas/oakville');
    expect(acquisitionNote(null)).toBeNull();
  });

  it('every channel has a label', () => {
    for (const c of ACQUISITION_CHANNELS) expect(ACQUISITION_LABEL[c].length).toBeGreaterThan(3);
  });
});

describe('captureAcquisition (browser)', () => {
  const stubBrowser = (opts: { referrer: string; pathname: string; search?: string; store?: Record<string, string>; storageThrows?: boolean }) => {
    const store: Record<string, string> = { ...(opts.store ?? {}) };
    const sessionStorage = {
      getItem: (k: string) => { if (opts.storageThrows) throw new Error('blocked'); return store[k] ?? null; },
      setItem: (k: string, v: string) => { if (opts.storageThrows) throw new Error('blocked'); store[k] = v; },
    };
    vi.stubGlobal('window', { sessionStorage, location: { hostname: 'ecowoods.ca', pathname: opts.pathname, search: opts.search ?? '' } });
    vi.stubGlobal('document', { referrer: opts.referrer });
    return store;
  };
  afterEach(() => vi.unstubAllGlobals());

  it('records the first touch from the referrer host and the plain landing path, once', () => {
    const store = stubBrowser({ referrer: 'https://www.google.com/search?q=hardwood+refinishing+oakville', pathname: '/service-areas/oakville', search: '?x=1' });
    expect(captureAcquisition()).toEqual({ channel: 'google_search', landing: '/service-areas/oakville' });
    expect(JSON.stringify(store)).not.toContain('oakville+'); // the search words never reach storage
    expect(JSON.stringify(store)).not.toContain('x=1');
  });

  it('keeps the first touch after the visitor navigates inside the site', () => {
    stubBrowser({ referrer: 'https://chatgpt.com/', pathname: '/pricing' });
    const first = captureAcquisition();
    // Same tab, next page: the referrer is now the previous internal page.
    const store = JSON.parse(window.sessionStorage.getItem('ew_acquisition')!);
    stubBrowser({ referrer: 'https://ecowoods.ca/pricing', pathname: '/estimate', store: { ew_acquisition: JSON.stringify(store) } });
    expect(captureAcquisition()).toEqual(first);
    expect(first).toEqual({ channel: 'chatgpt', landing: '/pricing' });
  });

  it('a visit with no referrer is no_referrer, and a tagged link is campaign without keeping the tag text', () => {
    stubBrowser({ referrer: '', pathname: '/' });
    expect(captureAcquisition()).toEqual({ channel: 'no_referrer', landing: '/' });
    const store = stubBrowser({ referrer: '', pathname: '/estimate', search: '?utm_source=flyer-oct' });
    expect(captureAcquisition()).toEqual({ channel: 'campaign', landing: '/estimate' });
    expect(JSON.stringify(store)).not.toContain('flyer');
  });

  it('a link opened in a new tab mid-visit is not mistaken for a first touch', () => {
    const store = stubBrowser({ referrer: 'https://ecowoods.ca/pricing', pathname: '/estimate' });
    expect(captureAcquisition()).toBeNull();
    expect(Object.keys(store)).toEqual([]); // nothing stored, so a later real first touch is not blocked
  });

  it('a value written by an older build or tampered with is not trusted and not re-classified', () => {
    stubBrowser({ referrer: 'https://ecowoods.ca/x', pathname: '/estimate', store: { ew_acquisition: JSON.stringify({ channel: 'Google search', landing: '/x' }) } });
    expect(captureAcquisition()).toBeNull();
    stubBrowser({ referrer: '', pathname: '/', store: { ew_acquisition: 'not json' } });
    expect(captureAcquisition()).toBeNull();
  });

  it('is null, not an error, when storage is blocked or there is no window', () => {
    stubBrowser({ referrer: 'https://www.google.com/', pathname: '/', storageThrows: true });
    expect(captureAcquisition()).toBeNull();
    vi.unstubAllGlobals();
    expect(captureAcquisition()).toBeNull();
  });
});
