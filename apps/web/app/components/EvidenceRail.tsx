import Link from 'next/link';

/**
 * EvidenceRail — "has this been done, and where can I check".
 *
 * WHAT PROBLEM THIS SOLVES
 *
 * `pnpm seo:density` was written to check that every commercial page reaches
 * two service pages, two decision guides, two case studies, a technical paper,
 * the framework and a CTA. On its first run, five of the nine commercial and
 * decision canonicals reached ZERO case studies. The site has five published
 * case studies with real measurements in them — subfloor MVTR readings, particle
 * counts, deflection over eighteen months — and none of the pages a buyer
 * actually lands on linked to any of them.
 *
 * That is the most expensive omission on this site, and it is not an SEO one.
 * A commercial page's whole job is to move someone from "this sounds right" to
 * "these people have done this". The evidence existed; nothing pointed at it.
 *
 * WHY THE SLUGS ARE PASSED IN RATHER THAN MATCHED AUTOMATICALLY
 *
 * There are five case studies. Automatic topic matching over five documents is
 * a machine guessing at a judgement a person can make correctly in ten seconds,
 * and it fails in the direction that matters — surfacing a radiant-heat estate
 * on a page about a peeling finish reads as filler and costs trust. Each page
 * names the two or three that actually bear on it, and the `why` line says what
 * the reader will find there. When the library outgrows hand-curation, that is
 * the moment to write the matcher, not before.
 *
 * NO FIGURES ARE RESTATED HERE. The `why` lines describe what a case study
 * covers; they never repeat its measurements. A number quoted in two places is
 * a number that can drift, and the case study is the one place it is sourced.
 */

export type EvidenceItem = {
  /** Case-study slug under /case-studies. */
  slug: string;
  /** The short name a reader recognises — the place, not the full title. */
  name: string;
  /** What this job proves, in one line, in the words of the page linking to it. */
  why: string;
};

export function EvidenceRail({
  kicker = 'Proof, with the numbers',
  heading,
  intro,
  items,
}: {
  kicker?: string;
  heading: string;
  intro?: string;
  items: EvidenceItem[];
}) {
  if (!items.length) return null;
  return (
    <section className="tlx-section" aria-label="Related project evidence">
      <div className="shell">
        <p className="tlx-kicker">{kicker}</p>
        <h2 className="tlx-h2">{heading}</h2>
        {intro && <p className="tlx-note">{intro}</p>}
        <div className="tlx-grid">
          {items.map((c) => (
            <Link key={c.slug} className="tlx-card" href={`/case-studies/${c.slug}`}>
              <h3>{c.name}</h3>
              <p>{c.why}</p>
            </Link>
          ))}
        </div>
        <p className="tlx-note">
          Every case study publishes what was measured, not only what was achieved —{' '}
          <Link href="/case-studies">all of them are here</Link>, and each one names the
          substrate, the species, the readings and the protocol it followed.
        </p>
      </div>
    </section>
  );
}

/**
 * The five published jobs, named once.
 *
 * A page imports the two or three that bear on it and writes its own `why`.
 * The slug and the display name live here so a rename is one edit rather than
 * a hunt — and so a slug that stops existing fails `pnpm verify:links` at the
 * one place it is declared.
 */
export const CASES = {
  yorkville: { slug: 'yorkville-loft-basement-conversion-moisture-mitigation', name: 'Yorkville loft, below grade' },
  distillery: { slug: 'distillery-district-victorian-condo', name: 'Distillery District, over concrete' },
  forestHill: { slug: 'forest-hill-walnut-wide-plank-color-stability', name: 'Forest Hill, wide-plank walnut' },
  midtown: { slug: 'midtown-townhouse-three-level-transition', name: 'Midtown townhouse, three levels' },
  rosedale: { slug: 'rosedale-estate-stairs-radiant-heat', name: 'Rosedale estate, stairs over radiant heat' },
} as const;
