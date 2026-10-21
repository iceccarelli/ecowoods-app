/**
 * Minimal, dependency-free Markdown parser for Ask Francisco replies.
 *
 * Output is a typed tree, rendered to React elements by
 * `app/assistant/components/AssistantMarkdown.tsx` — never to an HTML string,
 * so model output can not inject markup. Tolerates partial input because the
 * reply streams in token by token (an unclosed fence or list is still valid).
 */

export type InlineNode =
  | { t: 'text'; text: string }
  | { t: 'strong'; children: InlineNode[] }
  | { t: 'em'; children: InlineNode[] }
  | { t: 'code'; text: string }
  | { t: 'link'; href: string; children: InlineNode[] };

export type Block =
  | { t: 'p'; children: InlineNode[] }
  | { t: 'h'; level: 2 | 3 | 4; children: InlineNode[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'quote'; blocks: Block[] }
  | { t: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { t: 'table'; head: InlineNode[][]; rows: InlineNode[][][] }
  | { t: 'hr' };

const SAFE_HREF = /^(https?:\/\/|\/(?!\/)|mailto:|tel:)/i;
const INLINE = /(`[^`\n]+`)|(\*\*[^\n]+?\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\s][^*\n]*?\*)|(\b_[^_\s][^_\n]*?_\b)/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const FENCE = /^\s*```\s*([\w+-]*)\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function isSafeHref(href: string): boolean {
  return SAFE_HREF.test(href);
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let rest = src;
  while (rest.length > 0) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ t: 'text', text: rest });
      break;
    }
    if (m.index > 0) out.push({ t: 'text', text: rest.slice(0, m.index) });
    const tok = m[0];
    if (m[1]) {
      out.push({ t: 'code', text: tok.slice(1, -1) });
    } else if (m[2]) {
      out.push({ t: 'strong', children: parseInline(tok.slice(2, -2)) });
    } else if (m[3]) {
      const close = tok.indexOf('](');
      const label = tok.slice(1, close);
      const href = tok.slice(close + 2, -1);
      out.push(isSafeHref(href) ? { t: 'link', href, children: parseInline(label) } : { t: 'text', text: label });
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

export function parseMarkdown(src: string): Block[] {
  return parseBlocks(src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (absent while streaming)
      blocks.push({ t: 'code', lang: fence[1], text: body.join('\n') });
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      // The page already owns h1; clamp reply headings to h2–h4.
      const level = Math.min(4, Math.max(2, heading[1].length + 1)) as 2 | 3 | 4;
      blocks.push({ t: 'h', level, children: parseInline(heading[2]) });
      i++;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) body.push(lines[i++].replace(/^\s{0,3}>\s?/, ''));
      blocks.push({ t: 'quote', blocks: parseBlocks(body) });
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line).map(parseInline);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
        rows.push(splitRow(lines[i++]).map(parseInline));
      }
      blocks.push({ t: 'table', head, rows });
      continue;
    }

    const li = LIST_ITEM.exec(line);
    if (li) {
      const base = indentOf(line);
      const ordered = /\d/.test(li[2]);
      const start = ordered ? parseInt(li[2], 10) : 1;
      const items: Block[][] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m || indentOf(lines[i]) !== base || /\d/.test(m[2]) !== ordered) break;
        const itemLines = [m[3]];
        i++;
        while (i < lines.length) {
          const next = lines[i];
          if (next.trim() === '') {
            // A blank line stays inside the item only if indented content follows.
            let j = i;
            while (j < lines.length && lines[j].trim() === '') j++;
            if (j < lines.length && indentOf(lines[j]) > base) {
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
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i], para.length === 0)) {
      para.push(lines[i++].trim());
    }
    if (para.length === 0) para.push(lines[i++].trim());
    blocks.push({ t: 'p', children: parseInline(para.join(' ')) });
  }
  return blocks;
}

function startsBlock(line: string, first: boolean): boolean {
  if (first) return false;
  return FENCE.test(line) || /^\s{0,3}#{1,6}\s/.test(line) || /^\s{0,3}>/.test(line) || LIST_ITEM.test(line);
}

function dedent(lines: string[]): string[] {
  const indents = lines.slice(1).filter((l) => l.trim() !== '').map(indentOf);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l, idx) => (idx === 0 ? l : l.slice(Math.min(cut, indentOf(l)))));
}
