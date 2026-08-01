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

/** Convert a markdown body to HTML for dangerouslySetInnerHTML. */
export function renderMarkdown(markdown: string): string {
  return marked.parse(stripLeadingH1(markdown), { async: false, gfm: true }) as string;
}
