import { describe, it, expect } from 'vitest';
import { classifyReferrer, formatAcquisition, landingPath } from './acquisition';

const own = 'ecowoods.ca';

describe('classifyReferrer', () => {
  it('names search engines and AI assistants by host only', () => {
    expect(classifyReferrer('https://www.google.com/search?q=hardwood+floor+refinishing+oakville', null, own)).toBe('Google search');
    expect(classifyReferrer('https://www.google.ca/', null, own)).toBe('Google search');
    expect(classifyReferrer('https://chatgpt.com/', null, own)).toBe('ChatGPT');
    expect(classifyReferrer('https://www.perplexity.ai/search/abc', null, own)).toBe('Perplexity');
    expect(classifyReferrer('https://gemini.google.com/app', null, own)).toBe('Gemini');
    expect(classifyReferrer('https://claude.ai/chat/1', null, own)).toBe('Claude');
    expect(classifyReferrer('https://www.bing.com/', null, own)).toBe('Bing search');
  });

  it('does not mistake a look-alike host for a known one', () => {
    expect(classifyReferrer('https://notgoogle.com/', null, own)).toBe('other site');
    expect(classifyReferrer('https://evilchatgpt.com/', null, own)).toBe('other site');
  });

  it('falls back to a sanitised campaign tag, then direct, then other site', () => {
    expect(classifyReferrer('', 'Flyer-2026!', own)).toBe('campaign: flyer-2026');
    expect(classifyReferrer('', null, own)).toBe('direct or unknown');
    expect(classifyReferrer('https://ecowoods.ca/pricing', null, own)).toBe('direct or unknown');
    expect(classifyReferrer('not a url', null, own)).toBe('direct or unknown');
    expect(classifyReferrer('https://some-blog.example/post', null, own)).toBe('other site');
  });

  it('does not accept a look-alike Google host, and treats www and the bare domain as one site', () => {
    expect(classifyReferrer('https://google.evil.com/', null, own)).toBe('other site');
    expect(classifyReferrer('https://google.com.evil.net/', null, own)).toBe('other site');
    expect(classifyReferrer('https://www.ecowoods.ca/pricing', null, own)).toBe('direct or unknown');
    expect(classifyReferrer('https://ecowoods.ca/pricing', null, 'www.ecowoods.ca')).toBe('direct or unknown');
  });

  it('a known referrer wins over utm_source', () => {
    expect(classifyReferrer('https://www.google.com/', 'newsletter', own)).toBe('Google search');
  });
});

describe('formatAcquisition', () => {
  it('is one short line, and undefined when nothing was captured', () => {
    expect(formatAcquisition({ channel: 'Google search', landing: '/service-areas/oakville' })).toBe('Google search → /service-areas/oakville');
    expect(formatAcquisition(null)).toBeUndefined();
  });
});

describe('landingPath', () => {
  it('keeps plain public page addresses and drops anything that could carry a token or belong to a signed-in visitor', () => {
    expect(landingPath('/service-areas/oakville')).toBe('/service-areas/oakville');
    expect(landingPath('/estimate')).toBe('/estimate');
    expect(landingPath('/r/abc123')).toBe('/');
    expect(landingPath('/floor-plan/XYZ')).toBe('/');
    expect(landingPath('/mypage/invoices')).toBe('/');
    expect(landingPath('/share/me@example.com')).toBe('/');
    expect(landingPath('/a/b/c/d/e')).toBe('/');
  });
});
