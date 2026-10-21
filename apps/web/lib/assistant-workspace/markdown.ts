/**
 * Minimal, dependency-free Markdown parser for Ask Francisco replies.
 *
 * Output is a typed tree, rendered to React elements by
 * `app/assistant/components/AssistantMarkdown.tsx` — never to an HTML string,
 * so model output can not inject markup. Tolerates partial input because the
 * reply streams in token by token: an unclosed fence, list, `**bold`, `` `code ``
 * or `[link](` is rendered as the thing it is about to become, and a block
 * marker or table header that has just started is held back until it has
 * content, so the reader never sees raw syntax flash up and vanish.
 */
import { resolveSiteHref } from './links';

export type InlineNode =
  | { t: 'text'; text: string }
  | { t: 'strong'; children: InlineNode[] }
  | { t: 'em'; children: InlineNode[] }
  | { t: 'code'; text: string }
  | { t: 'link'; href: string; children: InlineNode[] };

export type Block =
  | { t: 'p'; children: InlineNode[] }
  | { t: 'h'; level: 3 | 4; children: InlineNode[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; blocks: Block[] }
  | { t: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { t: 'table'; head: InlineNode[][]; rows: InlineNode[][][] }
  | { t: 'hr' };

const INLINE =
  /(`[^`\n]+`)|(\*\*[^\n]+?\*\*)|(\*\*[^*\n]+\*$)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*)|(\b_[^_\s][^_\n]*?_\b)/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const FENCE = /^\s*```\s*([\w+-]*)\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** True when `href` may be rendered as a link at all — see links.ts for the rules. */
export function isSafeHref(href: string): boolean {
  return resolveSiteHref(href) !== null;
}

/** Plain text of inline nodes — for accessible names, never for display. */
export function plainText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.text : plainText(n.children))).join('');
}

/**
 * Text with no complete token left in it: plain text, or the tail of a reply
 * that is still streaming. An opener whose closer has not arrived yet is
 * rendered as what it is about to become (`**bo` is already bold, `[Book a me`
 * is already label text).
 */
function parseTail(rest: string): InlineNode[] {
  // A marker typed at the very end, with nothing after it yet.
  const text = rest.replace(/(\*{1,2}|`{1,2})$/, '');
  const cands: { idx: number; kind: 'strong' | 'code' | 'em' | 'link' }[] = [];
  const strong = /\*\*(?=[^\s*])/.exec(text);
  if (strong) cands.push({ idx: strong.index, kind: 'strong' });
  const code = /`(?=[^`\s])/.exec(text);
  if (code) cands.push({ idx: code.index, kind: 'code' });
  const em = /(?:^|\s)(\*)(?=[^\s*])/.exec(text);
  if (em) cands.push({ idx: em.index + em[0].length - 1, kind: 'em' });
  const link = /\[([^\]\n]*)(\](\([^)\n]*)?)?$/.exec(text);
  // `[1]` alone is a footnote-style literal, not a link that is still arriving.
  if (link && (link[3] !== undefined || link[2] === undefined || (link[1] !== '' && !/^\d+$/.test(link[1]!)))) {
    cands.push({ idx: link.index, kind: 'link' });
  }
  if (!cands.length) return text ? [{ t: 'text', text }] : [];
  cands.sort((a, b) => a.idx - b.idx);
  const { idx, kind } = cands[0]!;
  const out: InlineNode[] = [];
  if (idx > 0) out.push({ t: 'text', text: text.slice(0, idx) });
  if (kind === 'link') {
    const label = link![1]!;
    if (label) out.push(...parseInline(label));
    return out;
  }
  const inner = text.slice(idx + (kind === 'strong' ? 2 : 1));
  if (!inner) return out;
  if (kind === 'code') out.push({ t: 'code', text: inner });
  else out.push({ t: kind, children: parseInline(inner) });
  return out;
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = src;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(...parseTail(rest));
      break;
    }
    if (m.index > 0) out.push({ t: 'text', text: rest.slice(0, m.index) });
    const tok = m[0];
    if (m[1]) {
      out.push({ t: 'code', text: tok.slice(1, -1) });
    } else if (m[2]) {
      out.push({ t: 'strong', children: parseInline(tok.slice(2, -2)) });
    } else if (m[3]) {
      out.push({ t: 'strong', children: parseInline(tok.slice(2, -1)) });
    } else if (m[4]) {
      const close = tok.indexOf('](');
      const label = tok.slice(1, close);
      const resolved = resolveSiteHref(tok.slice(close + 2, -1));
      // Unknown route, unsafe scheme or someone else's phone number: words only.
      if (resolved) out.push({ t: 'link', href: resolved.href, children: parseInline(label) });
      else out.push(...parseInline(label));
    } else {
      out.push({ t: 'em', children: parseInline(tok.slice(1, -1)) });
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

function indentOf(line: string): number {
  const m = /^(\s*)/.exec(line.replace(/\t/g, '    '));
  return m ? m[1].length : 0;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/**
 * Drop what a streaming reply has typed but not yet said: a lone block marker
 * (`##`, `-`, `1.`, `>`, a half-typed fence), a table header row whose
 * separator has not arrived, or a separator row still being typed. Each would
 * otherwise render as a paragraph of raw punctuation for a token or two.
 */
function trimStreamTail(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.trim() === '') end--;
  if (end === 0) return lines;
  const last = lines[end - 1]!;
  if (/^\s*(#{1,6}|[-*+]|\d{1,3}[.)]|>|`{1,2})\s*$/.test(last)) return lines.slice(0, end - 1);
  if (last.trimStart().startsWith('|') && !TABLE_SEP.test(last)) {
    const prev = end >= 2 ? lines[end - 2]! : '';
    // A row of an existing table (previous line has pipes) is kept, even partial.
    if (prev.trim() === '' || !prev.includes('|')) return lines.slice(0, end - 1);
  }
  if (/^[\s|:-]+$/.test(last) && last.includes('-') && !TABLE_SEP.test(last) && end >= 2 && lines[end - 2]!.includes('|')) {
    return lines.slice(0, end - 2);
  }
  return lines;
}

export function parseMarkdown(src: string): Block[] {
  const lines = trimStreamTail(src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
  return normaliseHeadings(parseBlocks(lines));
}

/**
 * The page owns h1 (sr-only) and the workspace bar owns h2, so reply headings
 * start at h3 whatever depth the model used for its shallowest one, and never
 * skip a level below that. Deeper headings clamp at h4.
 */
function normaliseHeadings(blocks: Block[]): Block[] {
  let min = 7;
  const scan = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'h') min = Math.min(min, b.level);
      else if (b.t === 'quote') scan(b.blocks);
      else if (b.t === 'list') b.items.forEach(scan);
    }
  };
  scan(blocks);
  if (min === 7) return blocks;
  const apply = (bs: Block[]) => {
    for (const b of bs) {
      if (b.t === 'h') b.level = Math.min(4, 3 + (b.level - min)) as 3 | 4;
      else if (b.t === 'quote') apply(b.blocks);
      else if (b.t === 'list') b.items.forEach(apply);
    }
  };
  apply(blocks);
  return blocks;
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i]!)) body.push(lines[i++]!);
      i++; // closing fence (absent while streaming)
      blocks.push({ t: 'code', lang: fence[1]!, text: body.join('\n') });
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      // Raw depth for now (clamped to 2–4 later by normaliseHeadings).
      blocks.push({ t: 'h', level: heading[1]!.length as 3 | 4, children: parseInline(heading[2]!) });
      i++;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ t: 'quote', blocks: parseBlocks(body) });
      continue;
    }

    if (isTableStart(lines, i)) {
      const head = splitRow(line).map(parseInline);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i]!.trim() !== '' && lines[i]!.includes('|')) {
        rows.push(splitRow(lines[i++]!).map(parseInline));
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }

    const li = LIST_ITEM.exec(line);
    if (li) {
      const base = indentOf(line);
      const ordered = /\d/.test(li[2]!);
      const start = ordered ? parseInt(li[2]!, 10) : 1;
      const items: Block[][] = [];
      while (i < lines.length) {
        // Items separated by blank lines are still one list.
        if (lines[i]!.trim() === '') {
          let j = i;
          while (j < lines.length && lines[j]!.trim() === '') j++;
          const peek = j < lines.length ? LIST_ITEM.exec(lines[j]!) : null;
          if (!peek || indentOf(lines[j]!) !== base || /\d/.test(peek[2]!) !== ordered) break;
          i = j;
        }
        const m = LIST_ITEM.exec(lines[i]!);
        if (!m || indentOf(lines[i]!) !== base || /\d/.test(m[2]!) !== ordered) break;
        const itemLines = [m[3]!];
        i++;
        while (i < lines.length) {
          const next = lines[i]!;
          if (next.trim() === '') {
            // A blank line stays inside the item only if indented content follows.
            let j = i;
            while (j < lines.length && lines[j]!.trim() === '') j++;
            if (j < lines.length && indentOf(lines[j]!) > base) {
              itemLines.push('');
              i = j;
              continue;
            }
            break;
          }
          if (indentOf(next) > base) {
            itemLines.push(next);
            i++;
            continue;
          }
          break;
        }
        items.push(parseBlocks(dedent(itemLines)));
      }
      blocks.push({ t: 'list', ordered, start, items });
      continue;
    }

    // Paragraph: gather until a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !startsBlock(lines, i, para.length === 0)) {
      para.push(lines[i++]!.trim());
    }
    if (para.length === 0) para.push(lines[i++]!.trim());
    blocks.push({ t: 'p', children: parseInline(para.join(' ')) });
  }
  return blocks;
}

function isTableStart(lines: string[], i: number): boolean {
  const next = lines[i + 1];
  return lines[i]!.includes('|') && next !== undefined && TABLE_SEP.test(next) && next.includes('-');
}

function startsBlock(lines: string[], i: number, first: boolean): boolean {
  if (first) return false;
  const line = lines[i]!;
  return (
    FENCE.test(line) ||
    /^\s{0,3}#{1,6}\s/.test(line) ||
    /^\s{0,3}>/.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, i)
  );
}

function dedent(lines: string[]): string[] {
  const indents = lines.slice(1).filter((l) => l.trim() !== '').map(indentOf);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l, idx) => (idx === 0 ? l : l.slice(Math.min(cut, indentOf(l)))));
}
