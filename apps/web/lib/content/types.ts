/**
 * Article content types and metadata.
 * Every article has frontmatter defining its identity, SEO properties, and schema.
 */

export interface ArticleMetadata {
  /** Unique article slug (matches filename) */
  slug: string;

  /** Article title (H1) */
  title: string;

  /** Short description for previews and meta tags */
  description: string;

  /** Author name (default: Mark Carelli) */
  author?: string;

  /** Author title/role (default: Lead Architect) */
  authorTitle?: string;

  /** Publication date (ISO 8601) */
  publishedAt: string;

  /** Last update date (ISO 8601, optional) */
  modifiedAt?: string;

  /** Article category (for organization) */
  category?: 'hardwood-science' | 'installation' | 'maintenance' | 'toronto-climate' | 'species-guide' | 'raas-products';

  /** Tags for semantic linking and search */
  tags?: string[];

  /** SEO keywords (comma-separated) */
  keywords?: string;

  /** Feature image URL */
  image?: string;

  /** Approximate word count (for reading time) */
  wordCount?: number;

  /** Estimated reading time in minutes */
  readingTimeMinutes?: number;

  /** Semantic density self-assessment (for internal QA) */
  semanticDensity?: number; // 1-10, target 8+

  /** Primary and secondary topics for entity linking */
  topics?: string[];

  /** Related articles (by slug) for internal linking */
  relatedArticles?: string[];

  /** Whether article is published (hidden if false) */
  published?: boolean;

  /** Pinned/featured articles appear at top of blog list */
  featured?: boolean;
}

export interface Article extends ArticleMetadata {
  /** Full HTML/MDX content */
  content: string;
}

export interface ArticleListItem {
  slug: string;
  title: string;
  description: string;
  category?: ArticleMetadata['category'];
  publishedAt: string;
  image?: string;
  readingTimeMinutes?: number;
  featured?: boolean;
}
"