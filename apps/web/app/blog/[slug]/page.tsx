/**
 * Article detail page — renders single article with schema injection and related content.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticle, getArticles } from '@/lib/content/loader';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { ArticleLayout } from '@/app/components/ArticleLayout';
import { buildArticle, SchemaScript } from '@/lib/schema';
import { ArticleContent } from './article-content';
import {
  articleToNode,
  caseStudyToNode,
  findRelatedContent,
  getFallbackRelated,
} from '@/lib/graph/contentLinks';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Generate static params for all published articles at build time.
 */
export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

/**
 * Generate metadata for SEO (title, description, og:image, etc.)
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return { title: 'Article Not Found' };
  }

  const url = `${SITE_URL}/blog/${slug}`;

  return {
    title: article.title,
    description: article.description,
    authors: article.author ? [{ name: article.author }] : undefined,
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      type: 'article',
      authors: article.author ? [article.author] : undefined,
      publishedTime: article.publishedAt,
      modifiedTime: article.modifiedAt,
      images: article.image ? [{ url: article.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.description,
      images: article.image ? [article.image] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  // Build JSON-LD schema for this article
  const articleSchema = buildArticle({
    id: slug,
    headline: article.title,
    description: article.description,
    content: article.content,
    author: {
      name: article.author || 'Mark Carelli',
      title: article.authorTitle || 'Lead Architect',
    },
    publishedAt: new Date(article.publishedAt),
    modifiedAt: article.modifiedAt ? new Date(article.modifiedAt) : undefined,
    wordCount: article.wordCount,
    readingTimeMinutes: article.readingTimeMinutes,
    imageUrl: article.image,
    siteUrl: SITE_URL,
    topics: article.topics,
  });

  // Load all content for related content calculation
  const allArticles = await getArticles();
  const allCaseStudies = await getCaseStudies();

  // Build content graph
  const articleNodes = allArticles.map(articleToNode);
  const caseStudyNodes = allCaseStudies.map(caseStudyToNode);
  const allContentNodes = [...articleNodes, ...caseStudyNodes];

  // Find related content (2–4 items)
  const sourceNode = articleToNode(article);
  let relatedContent = findRelatedContent(sourceNode, allContentNodes, 4);

  // Fallback to predefined relationships if topic matching returns < 2 results
  if (relatedContent.length < 2) {
    relatedContent = getFallbackRelated(slug, allContentNodes, 4);
  }

  return (
    <>
      {/* Inject Article JSON-LD schema */}
      <SchemaScript schema={articleSchema} />

      {/* Render article with layout and related content */}
      <ArticleLayout metadata={article} relatedContent={relatedContent}>
        <ArticleContent content={article.content} />
      </ArticleLayout>
    </>
  );
}
