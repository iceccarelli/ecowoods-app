import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline, parseMarkdown } from '@/lib/assistant-workspace/markdown';

describe('assistant markdown parser', () => {
  it('parses headings, paragraphs and clamps heading level below h1', () => {
    const b = parseMarkdown('# Title\n\nHello **world**.');
    expect(b[0]).toMatchObject({ t: 'h', level: 2 });
    expect(b[1]).toMatchObject({ t: 'p' });
  });

  it('keeps nested list structure by indentation', () => {
    const [list] = parseMarkdown('1. Prep\n   - dust\n   - tape\n2. Sand');
    expect(list).toMatchObject({ t: 'list', ordered: true });
    if (list.t !== 'list') throw new Error('not a list');
    expect(list.items).toHaveLength(2);
    expect(list.items[0][1]).toMatchObject({ t: 'list', ordered: false });
    expect((list.items[0][1] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('tolerates an unclosed code fence while streaming', () => {
    const [code] = parseMarkdown('```ts\nconst a = 1;');
    expect(code).toEqual({ t: 'code', lang: 'ts', text: 'const a = 1;' });
  });

  it('parses tables', () => {
    const [t] = parseMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(t).toMatchObject({ t: 'table' });
  });

  it('drops unsafe link targets and never emits raw HTML', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('//evil.example')).toBe(false);
    expect(isSafeHref('/estimate')).toBe(true);
    const nodes = parseInline('[x](javascript:alert(1)) <script>a</script>');
    expect(nodes.some((n) => n.t === 'link')).toBe(false);
    expect(JSON.stringify(nodes)).toContain('<script>');
    expect(nodes.every((n) => n.t === 'text')).toBe(true);
  });
});
