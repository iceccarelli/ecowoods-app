/**
 * Case Study loader — read frontmatter + content from .mdx files.
 * Similar to article loader, but for engineering case studies.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import grayMatter from 'gray-matter';
import type { CaseStudyMetadata, CaseStudy, CaseStudyListItem, CaseStudyChallenge, CaseStudyResult } from './case-study-types';
import { renderMarkdown } from './markdown';

const CASE_STUDIES_DIR = join(process.cwd(), 'content/case-studies');

/**
 * Parse YAML frontmatter + MDX content from a case study file.
 */
function parseCaseStudyFile(
  filename: string,
  content: string,
): { metadata: CaseStudyMetadata; body: string } {
  const { data, content: body } = grayMatter(content);

  // Extract slug from filename (remove .mdx extension)
  const slug = filename.replace(/\.mdx$/, '');

  // Helper to get field (handles hyphenated and camelCase)
  const getField = (hyphenated: string, camelCase: string) => data[hyphenated] ?? data[camelCase];

  // Count words for reading time
  const wordCount = getField('word-count', 'wordCount') ?? (body.match(/\\b\\w+\\b/g) || []).length;

  // Parse challenges array
  const challenges = (data.challenges as CaseStudyChallenge[]) || [];

  // Parse results array
  const results = (data.results as CaseStudyResult[]) || [];

  // Parse location object
  /* Street addresses were removed from every case study on 2026-08-22 (F-176).
     A case study named a private Toronto residence — 89 Russell Hill Road,
     142 Scrivener Square — with latitude and longitude, presented as a completed
     job. If the project is real that is a client's home address published
     without any reason to think they agreed; if it is not, it is a fabricated
     record with a real address attached to it. Both are unacceptable, and the
     neighbourhood is the field that was doing the SEO work anyway: nobody
     searches "142 Scrivener Square hardwood", they search "Rosedale hardwood". */
  const location = data.location || {
    neighbourhood: '',
    city: 'Toronto',
    province: 'ON',
  };

  // Parse relative humidity range
  const relativeHumidityRange = data['relative-humidity-range'] || getField('relative-humidity-range', 'relativeHumidityRange');

  // Merge parsed frontmatter with required fields
  const metadata: CaseStudyMetadata = {
    slug,
    title: data.title || slug.replace(/-/g, ' '),
    description: data.description || '',
    location:
      typeof location === 'object' ? location : { neighbourhood: '', city: 'Toronto', province: 'ON' },
    projectDate: getField('project-date', 'projectDate') || new Date().toISOString(),
    publishedAt: getField('published-at', 'publishedAt') || new Date().toISOString(),
    modifiedAt: getField('modified-at', 'modifiedAt'),
    squareFootage: data['square-footage'] ?? data.squareFootage ?? 0,
    projectType: data['project-type'] ?? data.projectType ?? 'residential',
    substrateType: data['substrate-type'] ?? data.substrateType ?? 'concrete',
    woodSpecies: data['wood-species'] ?? data.woodSpecies ?? '',
    finishType: data['finish-type'] ?? data.finishType ?? '',
    installationDays: data['installation-days'] ?? data.installationDays ?? 0,
    cureDays: data['cure-days'] ?? data.cureDays ?? 0,
    initialMoistureReading: data['initial-moisture-reading'] ?? data.initialMoistureReading,
    finalMoistureReading: data['final-moisture-reading'] ?? data.finalMoistureReading,
    subfloorMoistureReading: data['subfloor-moisture-reading'] ?? data.subfloorMoistureReading,
    relativeHumidityRange,
    challenges,
    solution: data.solution || '',
    results,
    testimonial: data.testimonial,
    author: data.author || 'The Ecowoods Team',
    authorTitle: getField('author-title', 'authorTitle') || 'Lead Architect',
    images: (data.images as string[]) || [],
    keywords: data.keywords || '',
    topics: (data.topics as string[]) || [],
    relatedCaseStudies: getField('related-case-studies', 'relatedCaseStudies') || [],
    relatedArticles: getField('related-articles', 'relatedArticles') || [],
    published: data.published !== false, // default true
    featured: data.featured || false,
  };

  return { metadata, body };
}

/**
 * Read a single case study by slug.
 */
export async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  try {
    const filepath = join(CASE_STUDIES_DIR, `${slug}.mdx`);
    const content = await fs.readFile(filepath, 'utf-8');
    const { metadata, body } = parseCaseStudyFile(`${slug}.mdx`, content);

    if (!metadata.published) return null; // Hide unpublished

    return {
      ...metadata,
      content: renderMarkdown(body),
      wordCount: (body.match(/\\b\\w+\\b/g) || []).length,
    };
  } catch (error) {
    console.error(`Failed to load case study ${slug}:`, error);
    return null;
  }
}

/**
 * List all published case studies, sorted by date (newest first).
 * Optional filtering by project type.
 */
export async function getCaseStudies(options?: {
  projectType?: string;
  featured?: boolean;
}): Promise<CaseStudyListItem[]> {
  try {
    const files = await fs.readdir(CASE_STUDIES_DIR);
    const mdxFiles = files.filter((f) => f.endsWith('.mdx'));

    const caseStudies: CaseStudyListItem[] = [];

    for (const filename of mdxFiles) {
      const filepath = join(CASE_STUDIES_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      const { metadata } = parseCaseStudyFile(filename, content);

      if (!metadata.published) continue; // Skip unpublished

      if (options?.projectType && metadata.projectType !== options.projectType) continue;
      if (options?.featured !== undefined && metadata.featured !== options.featured) continue;

      caseStudies.push({
        slug: metadata.slug,
        title: metadata.title,
        description: metadata.description,
        location: metadata.location,
        projectType: metadata.projectType,
        projectDate: metadata.projectDate,
        squareFootage: metadata.squareFootage,
        woodSpecies: metadata.woodSpecies,
        topics: metadata.topics ?? [],
        publishedAt: metadata.publishedAt,
        modifiedAt: metadata.modifiedAt,
        featured: metadata.featured ?? false,
      });
    }

    // Sort: featured first (by date desc), then all by date desc
    caseStudies.sort((a, b) => {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      return new Date(b.projectDate).getTime() - new Date(a.projectDate).getTime();
    });

    return caseStudies;
  } catch (error) {
    console.error('Failed to list case studies:', error);
    return [];
  }
}

/**
 * Get all case study slugs (for sitemap generation, static params, etc.)
 */
export async function getAllCaseStudySlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(CASE_STUDIES_DIR);
    return files.filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
  } catch (error) {
    console.error('Failed to list case study slugs:', error);
    return [];
  }
}
