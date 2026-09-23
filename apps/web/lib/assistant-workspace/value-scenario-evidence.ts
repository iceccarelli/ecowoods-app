/**
 * lib/assistant-workspace/value-scenario-evidence.ts — the ONLY I/O in the
 * ASSISTANT-05 call graph.
 *
 * `value-scenario.ts`'s `buildValueScenario` is pure and takes an evidence
 * pool as a parameter rather than reading `content/case-studies/*.mdx`
 * itself — `case-study-loader.ts` uses `fs`, so it can only run server-side,
 * and `/assistant`'s workspace components are client components. This
 * module is the thin, server-only adapter: it calls the REAL, already-
 * shipped `getCaseStudies()` (the same loader `/case-studies`, the registry
 * and llms.txt use — never a second case-study reader) and narrows each
 * entry to the minimal, serializable fields `CaseStudyEvidence` needs, so a
 * Server Component (`app/assistant/page.tsx`) can fetch it once and pass it
 * down as a plain prop.
 */
import { getAllCaseStudySlugs, getCaseStudy } from '@/lib/content/case-study-loader';
import type { CaseStudyEvidence } from './value-scenario';

/**
 * Whether a case study documents subfloor preparation for a NEW floor.
 * `substrateType` itself can't be the signal — `case-study-loader.ts`
 * defaults it to `'concrete'` when a case study's frontmatter omits it, so
 * it is never actually absent. `subfloorMoistureReading` (an MVTR
 * calcium-chloride reading, taken before laying new wood over a subfloor)
 * IS genuinely optional, and every case study in this repo today happens to
 * carry one — because all five document an install (see value-scenario.ts's
 * module comment). A future refinish-only case study, which resurfaces an
 * existing floor rather than prepping a subfloor, would have no reason to
 * record one, which is exactly the signal this checks for rather than
 * hardcoding today's five slugs.
 */
function documentsNewFloorInstall(subfloorMoistureReading: number | undefined): boolean {
  return typeof subfloorMoistureReading === 'number';
}

/**
 * A testimonial counts toward VALUE_SCENARIO_SPEC's E3 bar ("a published,
 * attributable testimonial") only when it carries a real attribution string
 * — not just a quote with nobody named.
 */
function hasAttributedTestimonial(testimonial: { quote: string; attribution: string } | undefined): boolean {
  return !!testimonial?.attribution?.trim();
}

/**
 * Loads every published case study and narrows it to `CaseStudyEvidence`.
 * Server-only (transitively imports `fs` via `case-study-loader.ts`) — call
 * this from a Server Component or route handler, never from a client
 * component or from `value-scenario.ts` itself.
 *
 * Uses `getCaseStudy` (full `CaseStudy`, not the `getCaseStudies()` list
 * projection) because `substrateType` and `testimonial` — the two fields
 * this module classifies evidence by — aren't carried on
 * `CaseStudyListItem` (see case-study-types.ts). Reads every published slug
 * in parallel rather than one at a time; five files today, still cheap at a
 * few hundred.
 */
export async function loadCaseStudyEvidence(): Promise<CaseStudyEvidence[]> {
  const slugs = await getAllCaseStudySlugs();
  const caseStudies = await Promise.all(slugs.map((slug) => getCaseStudy(slug)));
  return caseStudies
    .filter((cs): cs is NonNullable<typeof cs> => cs !== null)
    .map((cs) => ({
      slug: cs.slug,
      title: cs.title,
      url: `/case-studies/${cs.slug}`,
      squareFootage: cs.squareFootage,
      neighbourhood: cs.location.neighbourhood || cs.location.city,
      documentsNewFloorInstall: documentsNewFloorInstall(cs.subfloorMoistureReading),
      hasAttributedTestimonial: hasAttributedTestimonial(cs.testimonial),
    }));
}
