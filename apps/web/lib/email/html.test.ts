import { describe, expect, it } from 'vitest';
import { detailRowsHtml, escapeHtml } from './html';

describe('escapeHtml', () => {
  it('neutralises markup, quotes and ampersands', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });
  it('escapes ampersands once, in order', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
  it('treats null and undefined as empty', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });
});

describe('detailRowsHtml', () => {
  it('renders customer-supplied cells inert', () => {
    const html = detailRowsHtml([['Note', '<a href="javascript:pay()">Pay your invoice here</a>'], ['<b>k</b>', 'v']]);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;a href=&quot;javascript:pay()&quot;&gt;');
    expect(html.match(/<tr>/g)).toHaveLength(2);
  });
});
