/**
 * Markdown rendering pipeline for the content library.
 *
 * Articles and case studies are authored as GFM markdown in .mdx files;
 * this module converts them to HTML server-side (marked, GFM enabled:
 * tables, task lists) and derives reading time. Content is first-party
 * and repo-controlled, so no sanitizer pass is applied.
 */
import { marked } from 'marked';

const WORDS_PER_MINUTE = 225;

/** Estimated reading time in whole minutes (never 0). */
export function estimateReadingTime(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Drop a leading `# Heading` — the page layout renders the title itself,
 * so a body-level H1 would duplicate it (and break heading hierarchy).
 */
export function stripLeadingH1(markdown: string): string {
  return markdown.replace(/^\s*#\s[^\n]+\n+/, '');
}

/**
 * Wrap every rendered <table> in a horizontally scrollable container.
 *
 * `.tlx-body` is capped at a 720px reading measure, so a wide spec table
 * overflows its column long before it overflows the viewport — and since
 * nothing between the table and <body> clips, the whole document gains a
 * horizontal scrollbar. The stylesheet only handled this below a 640px
 * viewport, which left the entire 641px-and-up range unprotected on the six
 * articles that carry tables (species-comparison-matrix has 44 table rows,
 * water-based-vs-oil-based has 67).
 *
 * Wrapping is the intrinsic fix rather than another breakpoint: the constraint
 * is the measure, not the viewport, so the guard should not be conditional on
 * viewport width at all. `display: block; overflow-x: auto` directly on the
 * <table> would also work but changes table layout at every width; a wrapper
 * leaves the table rendering untouched. See audit/FINDINGS.md F-29.
 */
function wrapTables(html: string): string {
  return html.replace(
    /<table(?=[\s>])/g,
    '<div class="tlx-table-wrap" role="region" tabindex="0"><table',
  ).replace(/<\/table>/g, '</table></div>');
}

/** Convert a markdown body to HTML for dangerouslySetInnerHTML. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(stripLeadingH1(markdown), { async: false, gfm: true }) as string;
  return wrapTables(html);
}
