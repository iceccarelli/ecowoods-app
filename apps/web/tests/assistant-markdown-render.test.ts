/**
 * What AssistantMarkdown actually puts in the DOM: accessible names, heading
 * order, table scoping, hanging-indent hooks and link attributes. The CSS
 * itself is checked by `pnpm verify` (verify:ui); these are the structural
 * hooks the CSS and assistive technology depend on.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantMarkdown } from '@/app/assistant/components/AssistantMarkdown';

/** Concatenated so scripts/verify-destinations.mjs does not read a deliberately bad target as a real link. */
const md = (label: string, target: string) => '[' + label + '](' + target + ')';
const CC = 'https://creativecommons.org/licenses/by/4.0/';
const html = (text: string) => renderToStaticMarkup(createElement(AssistantMarkdown, { text }));

describe('AssistantMarkdown markup', () => {
  it('never renders h1/h2, and heading levels do not skip', () => {
    const out = html('# A\n\ntext\n\n## B\n\n#### C');
    expect(out).not.toMatch(/<h[12][ >]/);
    const levels = [...out.matchAll(/<h([1-6])[ >]/g)].map((m) => Number(m[1]));
    expect(levels).toEqual([3, 4, 4]);
  });

  it('code blocks are focusable, scrollable regions with a name', () => {
    const out = html('```sh\nls -la\n```');
    expect(out).toContain('tabindex="0"');
    expect(out).toContain('role="region"');
    expect(out).toContain('aria-label="Code, sh"');
    expect(html('```\nx\n```')).toContain('aria-label="Code"');
  });

  it('tables have column-scoped headers and a labelled, focusable scroll region', () => {
    const out = html('| Species | Finish |\n|---|---|\n| Oak | Satin |');
    expect(out).toContain('<th scope="col">Species</th>');
    expect(out).toContain('aria-label="Table: Species, Finish"');
    expect(out).toContain('tabindex="0"');
  });

  it('ordered lists carry the digit count the hanging indent needs', () => {
    expect(html('1. a\n2. b')).toContain('data-digits="1"');
    expect(html('9. a\n10. b\n11. c')).toContain('data-digits="2"');
    expect(html('99. a\n100. b')).toContain('data-digits="3"');
    expect(html('9. a')).toContain('start="9"');
  });

  it('nested lists render as lists inside list items', () => {
    const out = html('1. a\n   - b\n2. c');
    expect(out).toBe('<ol data-digits="1"><li><p>a</p><ul><li><p>b</p></li></ul></li><li><p>c</p></li></ol>');
  });

  it('internal links stay in-tab; external https opens safely; unknown paths are plain text', () => {
    const out = html([md('est', '/estimate'), md('out', CC), md('gone', '/not-a-real-page')].join(' '));
    expect(out).toContain('<a href="/estimate">est</a>');
    expect(out).toContain('<a href="' + CC + '" target="_blank" rel="noopener noreferrer">out</a>');
    expect(out).not.toContain('not-a-real-page');
    expect(out).toContain('gone');
  });

  it('escapes raw HTML in model text', () => {
    const out = html('<img src=x onerror=alert(1)> **ok**');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });
});
