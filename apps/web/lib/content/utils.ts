/**
 * Article utilities — formatting, date handling, etc.
 */

/**
 * Format a date string to readable format (e.g., "July 31, 2026").
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Calculate reading time in minutes based on word count.
 * Average reader: ~200 words per minute.
 */
export function calculateReadingTime(wordCount: number): number {
  return Math.ceil(wordCount / 200);
}

/**
 * Count words in text content.
 */
export function countWords(text: string): number {
  return (text.match(/\\b\\w+\\b/g) || []).length;
}

/**
 * Generate a URL-safe slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, '')
    .replace(/\\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate SEO description (first 160 characters of content).
 */
export function generateSEODescription(content: string, length: number = 160): string {
  return content.slice(0, length).trim() + (content.length > length ? '...' : '');
}
