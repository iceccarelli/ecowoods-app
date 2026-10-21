import { Fragment, type ReactNode } from 'react';
import { parseMarkdown, plainText, type Block, type InlineNode } from '@/lib/assistant-workspace/markdown';

/**
 * Renders an Ask Francisco reply as structured, accessible HTML. Pure React
 * elements (no innerHTML), so streamed model text can't inject markup.
 */
export function AssistantMarkdown({ text }: { text: string }) {
  return <>{parseMarkdown(text).map((b, i) => renderBlock(b, i))}</>;
}

function renderInline(nodes: InlineNode[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.text}</Fragment>;
      case 'strong':
        return <strong key={i}>{renderInline(n.children)}</strong>;
      case 'em':
        return <em key={i}>{renderInline(n.children)}</em>;
      case 'code':
        return <code key={i}>{n.text}</code>;
      case 'link': {
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a key={i} href={n.href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {renderInline(n.children)}
          </a>
        );
      }
    }
  });
}

function renderBlock(b: Block, key: number): ReactNode {
  switch (b.t) {
    case 'p':
      return <p key={key}>{renderInline(b.children)}</p>;
    case 'h': {
      const H = `h${b.level}` as 'h3' | 'h4';
      return <H key={key}>{renderInline(b.children)}</H>;
    }
    case 'code':
      return (
        <pre
          key={key}
          className="aha-md-pre"
          tabIndex={0}
          role="region"
          aria-label={b.lang ? `Code, ${b.lang}` : 'Code'}
        >
          <code data-lang={b.lang || undefined}>{b.text}</code>
        </pre>
      );
    case 'quote':
      return <blockquote key={key}>{b.blocks.map((x, i) => renderBlock(x, i))}</blockquote>;
    case 'list': {
      const items = b.items.map((blocks, i) => <li key={i}>{blocks.map((x, j) => renderBlock(x, j))}</li>);
      return b.ordered ? (
        <ol
          key={key}
          start={b.start !== 1 ? b.start : undefined}
          data-digits={String(b.start + b.items.length - 1).length}
        >
          {items}
        </ol>
      ) : (
        <ul key={key}>{items}</ul>
      );
    }
    case 'table':
      return (
        <div
          key={key}
          className="aha-md-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={tableLabel(b.head)}
        >
          <table>
            <thead>
              <tr>
                {b.head.map((c, i) => (
                  <th key={i} scope="col">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{renderInline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'hr':
      return <hr key={key} />;
  }
}

/** "Table: Species, Finish" — names the region for a screen-reader user tabbing past it. */
function tableLabel(head: InlineNode[][]): string {
  const cols = head.map((c) => plainText(c).trim()).filter(Boolean).slice(0, 4);
  return cols.length ? `Table: ${cols.join(', ')}` : 'Table';
}
