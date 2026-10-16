import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('answers that can be spoken without the rest of the page', () => {
  it('contact opens with phone, hours and address from the registry', () => {
    const s = src('app/contact/page.tsx');
    const at = s.indexOf('className="tlx-lede"');
    const lede = s.slice(at, s.indexOf('</p>', at));
    for (const k of ['BUSINESS_NAP.phoneDisplay', 'HOURS_LINE', 'BUSINESS_ADDRESS_LINE']) expect(lede, k).toContain(k);
  });

  it('every glossary entry puts a question heading directly before its one-sentence answer', () => {
    const s = src('app/glossary/[slug]/page.tsx');
    expect(s).toMatch(/<h2 className="gl-question">What is \{t\.term\}\?<\/h2>\s*<p className="gl-definition">\{t\.short\}<\/p>/);
  });
});
