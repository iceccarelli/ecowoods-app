/**
 * Case Studies index — list all published case studies.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getCaseStudies } from '@/lib/content/case-study-loader';
import { formatDate } from '@/lib/content/utils';
import { buildBreadcrumbList, SchemaScript } from '@/lib/schema';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export const metadata: Metadata = {
  title: 'Case Studies — EcoWoods Hardwood Flooring',
  description: 'Real installation projects. Engineering case studies from Toronto hardwood flooring installations with moisture data, thermal management, and technical lessons.',
  openGraph: {
    title: 'Case Studies — EcoWoods Hardwood Flooring',
    description: 'Real installation projects and engineering case studies.',
    images: [
      {
        url: `${SITE_URL}/og-image.jpg`,
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default async function CaseStudiesPage() {
  const caseStudies = await getCaseStudies();

  const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Home', url: SITE_URL },
    { name: 'Case Studies', url: `${SITE_URL}/case-studies` },
  ]);

  return (
    <>
      <SchemaScript schema={breadcrumbSchema} />
      <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white dark:from-stone-900 dark:to-stone-950">
        {/* Header */}
        <header className="border-b border-stone-200 dark:border-stone-800">
          <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
            <nav className="mb-4 text-sm text-stone-600 dark:text-stone-400">
              <Link href="/" className="hover:text-stone-900 dark:hover:text-stone-200">
                Home
              </Link>
              <span className="mx-2">/</span>
              <span>Case Studies</span>
            </nav>
            <h1 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl text-stone-900 dark:text-stone-50">Case Studies</h1>
            <p className="text-lg text-stone-600 dark:text-stone-300">
              Real installation projects from Toronto homes and estates. Engineering solutions with moisture data, thermal management, and technical lessons from 25+ years of installations.
            </p>
          </div>
        </header>

        {/* Case Studies Grid */}
        <main className="mx-auto max-w-4xl px-6 py-12">
          {caseStudies.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center dark:border-stone-800 dark:bg-stone-900">
              <p className="text-stone-600 dark:text-stone-400">No case studies published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Featured Case Studies */}
              {caseStudies.filter((c) => c.featured).length > 0 && (
                <section>
                  <h2 className="mb-4 text-2xl font-bold text-stone-900 dark:text-stone-50">Featured Projects</h2>
                  <div className="space-y-4">
                    {caseStudies
                      .filter((c) => c.featured)
                      .map((caseStudy) => (
                        <CaseStudyCard key={caseStudy.slug} caseStudy={caseStudy} featured />
                      ))}
                  </div>
                </section>
              )}

              {/* All Case Studies */}
              <section>
                <h2 className="mb-4 text-2xl font-bold text-stone-900 dark:text-stone-50">All Projects</h2>
                <div className="space-y-4">
                  {caseStudies.map((caseStudy) => (
                    <CaseStudyCard key={caseStudy.slug} caseStudy={caseStudy} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function CaseStudyCard(
  {
  caseStudy,
  featured = false,
}: {
  caseStudy: Awaited<ReturnType<typeof getCaseStudies>>[number];
  featured?: boolean;
}) {
  const woodSpeciesText = Array.isArray(caseStudy.woodSpecies)
    ? caseStudy.woodSpecies.join(', ')
    : caseStudy.woodSpecies;

  return (
    <article
      className={`group overflow-hidden rounded-lg border transition-colors hover:border-amber-300 dark:hover:border-amber-700 ${
        featured
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'
          : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900'
      }`}
    >
      <Link href={`/case-studies/${caseStudy.slug}`} className="block p-6 no-underline">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-bold text-stone-900 group-hover:text-amber-700 dark:text-stone-50 dark:group-hover:text-amber-400">
            {caseStudy.title}
          </h3>
          {featured && <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">FEATURED</span>}
        </div>

        <p className="mb-4 text-stone-600 dark:text-stone-400">{caseStudy.description}</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {/* Project Type Badge */}
          <span className="inline-block rounded bg-stone-200 px-2 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {caseStudy.projectType.replace(/-/g, ' ')}
          </span>

          {/* Wood Species Badge */}
          <span className="inline-block rounded bg-stone-200 px-2 py-1 text-xs font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {woodSpeciesText}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-stone-500 dark:text-stone-500">
          {/* Location */}
          <span>{caseStudy.location.city}, {caseStudy.location.province}</span>
          <span>·</span>

          {/* Project Date */}
          <time dateTime={caseStudy.projectDate}>{new Date(caseStudy.projectDate).getFullYear()}</time>
          <span>·</span>

          {/* Square Footage */}
          <span>{caseStudy.squareFootage.toLocaleString()} sqft</span>
        </div>
      </Link>
    </article>
  );
}
