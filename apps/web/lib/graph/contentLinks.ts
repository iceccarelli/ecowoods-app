/**
 * Content Graph — Semantic linking system for articles and case studies.
 * Calculates topic/tag-based relationships and surfaces related content.
 * Used by detail pages to automatically show 2–4 related pieces.
 */


export type ContentType = 'article' | 'case-study';

export interface ContentNode {
  type: ContentType;
  slug: string;
  title: string;
  topics: string[];
  description: string;
}

/**
 * Minimal structural shape the node builders actually read — satisfied by
 * Article, ArticleListItem, CaseStudy, and CaseStudyListItem alike.
 */
export type NodeSource = {
  slug: string;
  title: string;
  description: string;
  topics?: string[];
};

export interface RelatedContent {
  type: ContentType;
  slug: string;
  title: string;
  description: string;
  relevanceScore: number; // 0–1, higher = more relevant
  sharedTopics: string[];
}

/**
 * Convert article to content node
 */
export function articleToNode(article: NodeSource): ContentNode {
  return {
    type: 'article',
    slug: article.slug,
    title: article.title,
    topics: article.topics || [],
    description: article.description,
  };
}

/**
 * Convert case study to content node
 */
export function caseStudyToNode(caseStudy: NodeSource): ContentNode {
  return {
    type: 'case-study',
    slug: caseStudy.slug,
    title: caseStudy.title,
    topics: caseStudy.topics || [],
    description: caseStudy.description,
  };
}

/**
 * Calculate semantic similarity between two content nodes
 * Based on shared topics (Jaccard similarity)
 */
export function calculateSimilarity(
  nodeA: ContentNode,
  nodeB: ContentNode,
): { score: number; sharedTopics: string[] } {
  if (nodeA.slug === nodeB.slug) {
    return { score: 0, sharedTopics: [] }; // Don't relate content to itself
  }

  const topicsA = new Set(nodeA.topics.map((t) => t.toLowerCase()));
  const topicsB = new Set(nodeB.topics.map((t) => t.toLowerCase()));

  // Find shared topics
  const sharedTopics = Array.from(topicsA).filter((topic) => topicsB.has(topic));

  if (sharedTopics.length === 0) {
    return { score: 0, sharedTopics: [] };
  }

  // Jaccard similarity: intersection / union
  const unionSize = new Set([...topicsA, ...topicsB]).size;
  const intersectionSize = sharedTopics.length;
  const score = intersectionSize / unionSize;

  return {
    score,
    sharedTopics: sharedTopics.map(
      // Restore original casing from nodeA or nodeB
      (topic) =>
        nodeA.topics.find((t) => t.toLowerCase() === topic) ||
        nodeB.topics.find((t) => t.toLowerCase() === topic) ||
        topic,
    ),
  };
}

/**
 * Find related content for a given article or case study
 * Returns top N most similar pieces, ranked by relevance
 */
export function findRelatedContent(
  sourceNode: ContentNode,
  allContent: ContentNode[],
  limit: number = 4,
): RelatedContent[] {
  const scored = allContent
    .map((node) => {
      const { score, sharedTopics } = calculateSimilarity(sourceNode, node);
      return {
        node,
        score,
        sharedTopics,
      };
    })
    .filter((item) => item.score > 0) // Only include items with shared topics
    .sort((a, b) => b.score - a.score) // Sort by relevance (highest first)
    .slice(0, limit);

  return scored.map((item) => ({
    type: item.node.type,
    slug: item.node.slug,
    title: item.node.title,
    description: item.node.description,
    relevanceScore: item.score,
    sharedTopics: item.sharedTopics,
  }));
}

/**
 * Predefined topic mappings for cross-linking
 * Maps article/case study slugs to related slugs (used if topics are sparse)
 */
export const CONTENT_RELATIONSHIPS: Record<string, string[]> = {
  // Phase 1 Articles (original 3)
  'subfloor-moisture-testing-protocol': [
    'white-oak-vs-red-oak-tannin-behavior',
    'wood-acclimation-timeline-toronto-gta',
    'dust-free-sanding-hepa-extraction-explained',
    'distillery-district-victorian-condo',
  ],
  'white-oak-vs-red-oak-tannin-behavior': [
    'subfloor-moisture-testing-protocol',
    'species-comparison-matrix-toronto-renovations',
    'water-based-vs-oil-based-polyurethane-chemistry',
    'distillery-district-victorian-condo',
  ],
  'dust-free-sanding-hepa-extraction-explained': [
    'subfloor-moisture-testing-protocol',
    'white-oak-vs-red-oak-tannin-behavior',
    'water-based-vs-oil-based-polyurethane-chemistry',
    'distillery-district-victorian-condo',
  ],

  // Phase 2 Articles (new 3)
  'wood-acclimation-timeline-toronto-gta': [
    'subfloor-moisture-testing-protocol',
    'species-comparison-matrix-toronto-renovations',
    'white-oak-vs-red-oak-tannin-behavior',
    'water-based-vs-oil-based-polyurethane-chemistry',
  ],
  'species-comparison-matrix-toronto-renovations': [
    'white-oak-vs-red-oak-tannin-behavior',
    'wood-acclimation-timeline-toronto-gta',
    'water-based-vs-oil-based-polyurethane-chemistry',
    'distillery-district-victorian-condo',
  ],
  'water-based-vs-oil-based-polyurethane-chemistry': [
    'white-oak-vs-red-oak-tannin-behavior',
    'species-comparison-matrix-toronto-renovations',
    'dust-free-sanding-hepa-extraction-explained',
    'wood-acclimation-timeline-toronto-gta',
  ],

  // Case Studies (Phase 1 & 3)
  'distillery-district-victorian-condo': [
    'subfloor-moisture-testing-protocol',
    'white-oak-vs-red-oak-tannin-behavior',
    'species-comparison-matrix-toronto-renovations',
    'dust-free-sanding-hepa-extraction-explained',
    'yorkville-loft-basement-conversion-moisture-mitigation',
  ],
  'rosedale-estate-stairs-radiant-heat': [
    'subfloor-moisture-testing-protocol',
    'wood-acclimation-timeline-toronto-gta',
    'dust-free-sanding-hepa-extraction-explained',
    'water-based-vs-oil-based-polyurethane-chemistry',
    'midtown-townhouse-three-level-transition',
  ],

  // Case Studies (Phase 3 Expansion)
  'yorkville-loft-basement-conversion-moisture-mitigation': [
    'subfloor-moisture-testing-protocol',
    'wood-acclimation-timeline-toronto-gta',
    'species-comparison-matrix-toronto-renovations',
    'distillery-district-victorian-condo',
  ],
  'midtown-townhouse-three-level-transition': [
    'subfloor-moisture-testing-protocol',
    'wood-acclimation-timeline-toronto-gta',
    'white-oak-vs-red-oak-tannin-behavior',
    'species-comparison-matrix-toronto-renovations',
    'water-based-vs-oil-based-polyurethane-chemistry',
    'rosedale-estate-stairs-radiant-heat',
  ],
  'forest-hill-walnut-wide-plank-color-stability': [
    'water-based-vs-oil-based-polyurethane-chemistry',
    'species-comparison-matrix-toronto-renovations',
    'dust-free-sanding-hepa-extraction-explained',
    'distillery-district-victorian-condo',
  ],
};

/**
 * Get fallback related content based on predefined relationships
 * Used when topic-based matching returns too few results
 */
export function getFallbackRelated(
  slug: string,
  allContent: ContentNode[],
  limit: number = 4,
): RelatedContent[] {
  const relatedSlugs = CONTENT_RELATIONSHIPS[slug] || [];

  return relatedSlugs
    .slice(0, limit)
    .map((relatedSlug) => {
      const node = allContent.find((n) => n.slug === relatedSlug);
      if (!node) return null;
      return {
        type: node.type,
        slug: node.slug,
        title: node.title,
        description: node.description,
        relevanceScore: 0.5, // Fallback scores are moderate
        sharedTopics: ['Content Cluster'],
      };
    })
    .filter((item) => item !== null) as RelatedContent[];
}
