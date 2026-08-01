/**
 * Case Study detail page — renders single case study with schema injection and related content.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCaseStudy, getAllCaseStudySlugs, getCaseStudies } from '@/lib/content/case-study-loader';
import { getArticles } from '@/lib/content/loader';
import { buildCaseStudy, SchemaScript } from '@/lib/schema';
import { CaseStudyLayout } from './case-study-layout';
import {
  caseStudyToNode,
  articleToNode,
  findRelatedContent,
  getFallbackRelated,
} from '@/lib/graph/contentLinks';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Generate static params for all published case studies at build time.
 */
export async function generateStaticParams() {
  const slugs = await getAllCaseStudySlugs();
  return slugs.map((slug) => ({
    slug,
  }));
}

/**
 * Generate metadata for SEO (title, description, og:image, etc.)
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = await getCaseStudy(slug);

  if (!caseStudy) {
    return { title: 'Case Study Not Found' };
  }

  const url = `${SITE_URL}/case-studies/${slug}`;

  return {
    title: caseStudy.title,
    description: caseStudy.description,
    authors: caseStudy.author ? [{ name: caseStudy.author }] : undefined,
    openGraph: {
      title: caseStudy.title,
      description: caseStudy.description,
      url,
      type: 'article',
      authors: caseStudy.author ? [caseStudy.author] : undefined,
      publishedTime: caseStudy.publishedAt,
      modifiedTime: caseStudy.modifiedAt,
      images: caseStudy.images && caseStudy.images.length > 0 ? [{ url: caseStudy.images[0] }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: caseStudy.title,
      description: caseStudy.description,
      images: caseStudy.images && caseStudy.images.length > 0 ? [caseStudy.images[0]] : undefined,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params;
  const caseStudy = await getCaseStudy(slug);

  if (!caseStudy) {
    notFound();
  }

  // Build JSON-LD schema for this case study
  const caseStudySchema = buildCaseStudy({
    id: slug,
    headline: caseStudy.title,
    description: caseStudy.description,
    content: caseStudy.content,
    location: caseStudy.location,
    projectType: caseStudy.projectType,
    projectDate: new Date(caseStudy.projectDate),
    squareFootage: caseStudy.squareFootage,
    woodSpecies: caseStudy.woodSpecies,
    finishType: caseStudy.finishType,
    author: {
      name: caseStudy.author || 'Ecowoods',
      title: caseStudy.authorTitle || 'Lead Architect',
    },
    publishedAt: new Date(caseStudy.publishedAt),
    modifiedAt: caseStudy.modifiedAt ? new Date(caseStudy.modifiedAt) : undefined,
    wordCount: caseStudy.wordCount,
    challenges: caseStudy.challenges,
    results: caseStudy.results,
    testimonial: caseStudy.testimonial,
    imageUrl: caseStudy.images?.[0],
    siteUrl: SITE_URL,
    topics: caseStudy.topics,
  });

  // Load all content for related content calculation
  const allArticles = await getArticles();
  const allCaseStudies = await getCaseStudies();

  // Build content graph
  const articleNodes = allArticles.map(articleToNode);
  const caseStudyNodes = allCaseStudies.map(caseStudyToNode);
  const allContentNodes = [...articleNodes, ...caseStudyNodes];

  // Find related content (2–4 items)
  const sourceNode = caseStudyToNode(caseStudy);
  let relatedContent = findRelatedContent(sourceNode, allContentNodes, 4);

  // Fallback to predefined relationships if topic matching returns < 2 results
  if (relatedContent.length < 2) {
    relatedContent = getFallbackRelated(slug, allContentNodes, 4);
  }

  return (
    <>
      {/* Inject CaseStudy JSON-LD schema */}
      <SchemaScript schema={caseStudySchema} />

      {/* Render case study with layout and related content */}
      <CaseStudyLayout metadata={caseStudy} relatedContent={relatedContent}>
        <div className="tlx-body" dangerouslySetInnerHTML={{ __html: caseStudy.content }} />
      </CaseStudyLayout>
    </>
  );
}
