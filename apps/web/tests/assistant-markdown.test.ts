import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline, parseMarkdown, plainText, type Block, type InlineNode } from '@/lib/assistant-workspace/markdown';

describe('assistant markdown parser', () => {
  it('parses headings, paragraphs and clamps heading level below h1', () => {
    const b = parseMarkdown('# Title\n\nHello **world**.');
    expect(b[0]).toMatchObject({ t: 'h', level: 3 });
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

/* ── streaming fidelity ───────────────────────────────────────────────────
   The reply arrives a few characters at a time and is re-parsed on every
   chunk. A partial token must render as what it is becoming, or not at all,
   never as raw syntax that vanishes a chunk later. */

const RAW = /\*\*|`|\]\(|^\s*[-*+]\s*$|^#+\s*$/;
/** Every piece of text a reader would see, flattened. */
function visibleText(blocks: Block[]): string[] {
  const out: string[] = [];
  const inline = (n: InlineNode[]) => out.push(plainText(n));
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'p' || b.t === 'h') inline(b.children);
      else if (b.t === 'quote') walk(b.blocks);
      else if (b.t === 'list') b.items.forEach(walk);
      else if (b.t === 'table') [b.head, ...b.rows.flat()].forEach((c) => (Array.isArray(c[0]) ? (c as unknown as InlineNode[][]).forEach(inline) : inline(c as InlineNode[])));
    }
  };
  walk(blocks);
  return out;
}

describe('streaming: partial inline syntax never shows as raw markers', () => {
  const FULL = 'Your **hardwood floor** needs `a measure` first, see [the estimate](/estimate) and *then* decide.';
  it('every prefix of a reply renders without stray markers', () => {
    for (let n = 1; n <= FULL.length; n++) {
      const prefix = FULL.slice(0, n);
      for (const text of visibleText(parseMarkdown(prefix))) {
        expect(RAW.test(text), `prefix ${JSON.stringify(prefix)} -> ${JSON.stringify(text)}`).toBe(false);
      }
    }
  });

  it('an unclosed **bold is already bold', () => {
    expect(parseInline('a **bo')).toEqual([
      { t: 'text', text: 'a ' },
      { t: 'strong', children: [{ t: 'text', text: 'bo' }] },
    ]);
  });

  it('a half-typed closing ** ("**bold*") is bold, not a stray asterisk', () => {
    expect(parseInline('**bold*')).toEqual([{ t: 'strong', children: [{ t: 'text', text: 'bold' }] }]);
  });

  it('a lone trailing marker is dropped until it has content', () => {
    expect(parseInline('Price **')).toEqual([{ t: 'text', text: 'Price ' }]);
    expect(parseInline('Run `')).toEqual([{ t: 'text', text: 'Run ' }]);
  });

  it('an unclosed ` is already code', () => {
    expect(parseInline('use `sand')).toEqual([
      { t: 'text', text: 'use ' },
      { t: 'code', text: 'sand' },
    ]);
  });

  it('an unclosed [link]( shows its label, then becomes a link once complete', () => {
    for (const partial of ['See [the esti', 'See [the estimate]', 'See [the estimate](', 'See [the estimate](' + '/est']) {
      expect(plainText(parseInline(partial))).toBe(partial.startsWith('See [the esti') && !partial.includes('mate') ? 'See the esti' : 'See the estimate');
      expect(parseInline(partial).some((n) => n.t === 'link')).toBe(false);
    }
    expect(parseInline('See [the estimate](/estimate)').some((n) => n.t === 'link')).toBe(true);
  });

  it('keeps a literal footnote marker like [1]', () => {
    expect(plainText(parseInline('as noted [1]'))).toBe('as noted [1]');
  });

  it('keeps a mid-text lone asterisk that is not an opener', () => {
    expect(plainText(parseInline('5 * 3 = 15'))).toBe('5 * 3 = 15');
  });
});

describe('streaming: block markers held back until they have content', () => {
  it.each(['Intro\n\n##', 'Intro\n\n-', 'Intro\n\n1.', 'Intro\n\n>', 'Intro\n\n  -', 'Intro\n\n``'])('%j renders only the intro', (src) => {
    const blocks = parseMarkdown(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ t: 'p' });
  });

  it('a table header with no separator yet is held back, not shown as pipes', () => {
    expect(parseMarkdown('Compare:\n\n| Species | Finish |')).toHaveLength(1);
    expect(parseMarkdown('Compare:\n\n| Species | Finish |\n|-')).toHaveLength(1);
    expect(parseMarkdown('Compare:\n\n| Species | Finish |\n|---|---|')[1]).toMatchObject({ t: 'table', rows: [] });
  });

  it('a partial table row stays in the table', () => {
    const [, t] = parseMarkdown('Compare:\n\n| Species | Finish |\n|---|---|\n| Oak | Sat');
    expect(t).toMatchObject({ t: 'table' });
    expect((t as { rows: unknown[] }).rows).toHaveLength(1);
  });

  it('a table directly after a paragraph (no blank line) is still a table', () => {
    const blocks = parseMarkdown('Compare:\n| A | B |\n|---|---|\n| 1 | 2 |');
    expect(blocks.map((b) => b.t)).toEqual(['p', 'table']);
  });

  it('a fence opening mid-stream becomes an (empty) code block, then fills', () => {
    expect(parseMarkdown('Run:\n```')).toEqual([
      { t: 'p', children: [{ t: 'text', text: 'Run:' }] },
      { t: 'code', lang: '', text: '' },
    ]);
    expect(parseMarkdown('Run:\n```sh\nls')[1]).toEqual({ t: 'code', lang: 'sh', text: 'ls' });
  });

  it('a half-typed closing fence is not shown inside the code', () => {
    expect(parseMarkdown('```sh\nls\n``')[0]).toEqual({ t: 'code', lang: 'sh', text: 'ls' });
  });

  it('a heading immediately after a paragraph (no blank line) is a heading', () => {
    const blocks = parseMarkdown('Short answer first.\n### What to check');
    expect(blocks.map((b) => b.t)).toEqual(['p', 'h']);
  });

  it('normalises CRLF and lone CR the same as LF', () => {
    const lf = parseMarkdown('A\n\n- one\n- two\n\n### H');
    expect(parseMarkdown('A\r\n\r\n- one\r\n- two\r\n\r\n### H')).toEqual(lf);
    expect(parseMarkdown('A\r\r- one\r- two\r\r### H')).toEqual(lf);
  });
});

describe('lists', () => {
  const shape = (b: Block): unknown =>
    b.t === 'list' ? { o: b.ordered, n: b.start, items: b.items.map((it) => it.map(shape)) } : b.t === 'p' ? plainText(b.children) : b.t;

  it('nests by 2 spaces', () => {
    const blocks = parseMarkdown('- a\n  - b\n    - c\n- d');
    expect(blocks.map(shape)).toEqual([
      { o: false, n: 1, items: [['a', { o: false, n: 1, items: [['b', { o: false, n: 1, items: [['c']] }]] }], ['d']] },
    ]);
  });

  it('nests by 4 spaces, and by 3 under an ordered marker', () => {
    expect(parseMarkdown('- a\n    - b\n- c').map(shape)).toEqual([
      { o: false, n: 1, items: [['a', { o: false, n: 1, items: [['b']] }], ['c']] },
    ]);
    expect(parseMarkdown('1. a\n   - b\n2. c').map(shape)).toEqual([
      { o: true, n: 1, items: [['a', { o: false, n: 1, items: [['b']] }], ['c']] },
    ]);
  });

  it('keeps a mixed ordered > unordered > ordered tree', () => {
    const [l] = parseMarkdown('1. a\n   - b\n     1. c\n2. d');
    expect(shape(l!)).toEqual({
      o: true,
      n: 1,
      items: [['a', { o: false, n: 1, items: [['b', { o: true, n: 1, items: [['c']] }]] }], ['d']],
    });
  });

  it('blank-line-separated items stay ONE list (ordered and bullet)', () => {
    expect(parseMarkdown('1. a\n\n2. b\n\n3. c')).toHaveLength(1);
    const [bul] = parseMarkdown('- a\n\n- b');
    expect(bul).toMatchObject({ t: 'list', ordered: false });
    expect((bul as { items: unknown[] }).items).toHaveLength(2);
  });

  it('a blank line between a nested block and the next item keeps the nesting', () => {
    const [l] = parseMarkdown('- a\n  - b\n\n- c');
    expect(shape(l!)).toEqual({ o: false, n: 1, items: [['a', { o: false, n: 1, items: [['b']] }], ['c']] });
  });

  it('a different list type after a blank line starts a new list', () => {
    expect(parseMarkdown('- a\n\n1. b').map((b) => b.t)).toEqual(['list', 'list']);
  });

  it('preserves the start number, including past 9', () => {
    const [l] = parseMarkdown('9. nine\n10. ten\n11. eleven');
    expect(l).toMatchObject({ t: 'list', ordered: true, start: 9 });
    expect((l as { items: unknown[] }).items).toHaveLength(3);
  });

  it('an item with an indented paragraph continuation stays one item', () => {
    const [l] = parseMarkdown('1. First\n\n   More on first.\n2. Second');
    expect((l as { items: Block[][] }).items).toHaveLength(2);
    expect((l as { items: Block[][] }).items[0]).toHaveLength(2);
  });

  it('every prefix of a nested list parses without throwing and keeps a list', () => {
    const src = '1. Prep\n   - dust\n   - tape\n2. Sand\n\n3. Finish';
    for (let n = 1; n <= src.length; n++) {
      const blocks = parseMarkdown(src.slice(0, n));
      for (const t of visibleText(blocks)) expect(RAW.test(t), JSON.stringify(src.slice(0, n))).toBe(false);
    }
  });
});

describe('heading levels', () => {
  it('start at h3 whatever depth the model used and never skip a level', () => {
    expect(parseMarkdown('### A\n\ntext').find((b) => b.t === 'h')).toMatchObject({ level: 3 });
    expect(parseMarkdown('## A\n\n### B').filter((b) => b.t === 'h').map((b) => (b as { level: number }).level)).toEqual([3, 4]);
    expect(parseMarkdown('# A\n\n#### B\n\n###### C').filter((b) => b.t === 'h').map((b) => (b as { level: number }).level)).toEqual([3, 4, 4]);
  });
});
