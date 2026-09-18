import { describe, expect, it } from 'vitest';
import { parseShareCode } from './share-code';

describe('parseShareCode', () => {
  it('passes a bare code through unchanged', () => {
    expect(parseShareCode('c=white-oak.satin.herringbone.5&a=900')).toBe('c=white-oak.satin.herringbone.5&a=900');
  });

  it('extracts the design= param from a /design/spec-style link', () => {
    const link = 'https://ecowoods.ca/design/spec?design=' + encodeURIComponent('c=white-oak.satin.herringbone.5&a=900');
    expect(parseShareCode(link)).toBe('c=white-oak.satin.herringbone.5&a=900');
  });

  it("uses the page's own querystring for a /floor-studio address-bar link", () => {
    const link = 'https://ecowoods.ca/floor-studio?c=white-oak.satin.herringbone.5&a=900&d=abc123';
    expect(parseShareCode(link)).toBe('c=white-oak.satin.herringbone.5&a=900&d=abc123');
  });

  it('trims surrounding whitespace, since a pasted code often carries it', () => {
    expect(parseShareCode('  c=white-oak.satin.herringbone.5&a=900  ')).toBe('c=white-oak.satin.herringbone.5&a=900');
  });

  it('returns an empty string unchanged rather than throwing', () => {
    expect(parseShareCode('')).toBe('');
  });
});
