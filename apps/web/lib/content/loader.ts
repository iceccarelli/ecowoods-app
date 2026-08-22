/**
 * Article loader — read frontmatter + content from .mdx files.
 * Uses gray-matter for YAML parsing.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import grayMatter from 'gray-matter';
import { renderMarkdown, estimateReadingTime } from './markdown';
import type { ArticleMetadata, Article, ArticleListItem } from './types';

const ARTICLES_DIR = join(process.cwd(), 'content/articles');

/**
 * Parse YAML frontmatter + MDX content from a file.
 */
function parseArticleFile(filename: string, content: string): { metadata: ArticleMetadata; body: string } {
  const { data, content: body } = grayMatter(content);

  // Extract slug from filename (remove .mdx extension)
  const slug = filename.replace(/\.mdx$/, '');

  // gray-matter parses hyphenated keys; handle both hyphenated and camelCase variants
  const getField = (hyphenated: string, camelCase: string) => data[hyphenated] ?? data[camelCase];

  // Count words for reading time calculation
  const wordCount = getField('word-count', 'wordCount') ?? (body.match(/\\b\\w+\\b/g) || []).length;

  // Merge parsed frontmatter with required fields
  const metadata: ArticleMetadata = {
    slug,
    title: data.title || slug.replace(/-/g, ' '),
    description: data.description || '',
    author: data.author || 'The Ecowoods Team',
    authorTitle: getField('author-title', 'authorTitle') || 'Lead Architect',
    publishedAt: getField('published-at', 'publishedAt') || new Date().toISOString(),
    modifiedAt: getField('modified-at', 'modifiedAt'),
    category: data.category,
    tags: (data.tags as string[]) || [],
    keywords: data.keywords || '',
    image: data.image,
    wordCount: wordCount as number,
    readingTimeMinutes: getField('reading-time-minutes', 'readingTimeMinutes') ?? Math.ceil((wordCount as number) / 200),
    topics: (data.topics as string[]) || [],
    relatedArticles: getField('related-articles', 'relatedArticles') || [],
    published: data.published !== false, // default true
    featured: data.featured || false,
  };

  return { metadata, body };
}

/**
 * Read a single article by slug.
 */
export async function getArticle(slug: string): Promise<Article | null> {
  try {
    const filepath = join(ARTICLES_DIR, `${slug}.mdx`);
    const content = await fs.readFile(filepath, 'utf-8');
    const { metadata, body } = parseArticleFile(`${slug}.mdx`, content);

    if (!metadata.published) return null; // Hide unpublished articles

    return {
      ...metadata,
      readingTimeMinutes: metadata.readingTimeMinutes ?? estimateReadingTime(body),
      content: renderMarkdown(body),
    };
  } catch (error) {
    console.error(`Failed to load article ${slug}:`, error);
    return null;
  }
}

/**
 * List all published articles, sorted by date (newest first).
 */
export async function getArticles(options?: { category?: string; featured?: boolean }): Promise<ArticleListItem[]> {
  try {
    const files = await fs.readdir(ARTICLES_DIR);
    const mdxFiles = files.filter((f) => f.endsWith('.mdx'));

    const articles: ArticleListItem[] = [];

    for (const filename of mdxFiles) {
      const filepath = join(ARTICLES_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      const { metadata, body } = parseArticleFile(filename, content);

      if (!metadata.published) continue; // Skip unpublished

      if (options?.category && metadata.category !== options.category) continue;
      if (options?.featured !== undefined && metadata.featured !== options.featured) continue;

      articles.push({
        slug: metadata.slug,
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        publishedAt: metadata.publishedAt,
        image: metadata.image,
        readingTimeMinutes: metadata.readingTimeMinutes ?? estimateReadingTime(body),
        wordCount: metadata.wordCount,
        modifiedAt: metadata.modifiedAt,
        topics: metadata.topics ?? [],
        featured: metadata.featured,
      });
    }

    // Sort: featured first (by date desc), then all by date desc
    articles.sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return articles;
  } catch (error) {
    console.error('Failed to list articles:', error);
    return [];
  }
}

/**
 * Get article metadata for a slug, or null if not found/not published.
 */
export async function getArticleForSEO(slug: string): Promise<ArticleMetadata | null> {
  const article = await getArticle(slug);
  return article || null;
}

/**
 * Get all article slugs (for sitemap generation, etc.)
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(ARTICLES_DIR);
    return files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
  } catch (error) {
    console.error('Failed to list article slugs:', error);
    return [];
  }
}
