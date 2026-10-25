import { describe, it, expect } from 'vitest';
import { ACQUISITION_CHANNELS, ACQUISITION_LABEL, acquisitionNote, classifyReferrer, landingPath, parseAcquisition } from './acquisition';

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
    expect(classifyReferrer('https://www.ecowoods.ca/pricing', false, own)).toBe('no_referrer');
    expect(classifyReferrer('https://ecowoods.ca/pricing', false, 'www.ecowoods.ca')).toBe('no_referrer');
    expect(classifyReferrer('not a url', false, own)).toBe('no_referrer');
    expect(classifyReferrer('https://some-blog.example/post', false, own)).toBe('other_site');
  });

  it('a known referrer wins over a utm_source tag', () => {
    expect(classifyReferrer('https://www.google.com/', true, own)).toBe('google_search');
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
