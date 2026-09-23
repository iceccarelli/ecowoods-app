'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { JobCard as JobCardData } from '@/content/job-cards';
import { track } from '@/lib/analytics';

/**
 * JobCard — one finished job, stated in the units it was measured in.
 *
 * This is the site's answer to "have you actually done this, near me, at my
 * size?" — the question that decides a hardwood contractor, and the one a
 * gallery of beautiful floors does not answer. Every field is copied from a
 * published case study and held there by scripts/verify-job-cards.mjs.
 *
 * WHAT IT SHOWS AND WHY THAT IS THE LIST
 *
 *   neighbourhood · square feet · year · service   — the four facts a buyer
 *   uses to decide whether this job resembles theirs.
 *
 *   substrate + species                            — the two facts that decide
 *   whether it resembles it in the way that costs money.
 *
 *   one measurement, with its unit                 — the reason to believe the
 *   rest. "MVTR 9.8 lbs/1000 sqft/24h" is not a marketing sentence; nobody
 *   writes it who did not take the reading.
 *
 * NO CUSTOMER NAME. See the header of content/job-cards.ts: the testimonial
 * attributions the case studies carry have no consent record in this
 * repository. `imageSlot`, where set, is the job's own AFTER frame reused
 * from its ProofSlider plate — never a face, never someone else's floor.
 */

export function JobCard({ job, from }: { job: JobCardData; from: string }) {
  const href = `/case-studies/${job.slug}`;
  return (
    <article className="jc">
      <header className="jc-head">
        <p className="jc-place">
          {job.area}
          <span className="jc-dot" aria-hidden="true">
            ·
          </span>
          {job.city}
        </p>
        <h3 className="jc-service">{job.service}</h3>
      </header>

      {job.imageSlot && (
        <Image
          className="jc-img"
          src={job.imageSlot}
          alt={job.imageAlt ?? ''}
          sizes="(max-width: 640px) 100vw, 380px"
          style={{ width: '100%', height: 'auto' }}
          loading="lazy"
        />
      )}

      <dl className="jc-spec">
        <div>
          <dt>Size</dt>
          <dd>{job.squareFeet.toLocaleString('en-CA')} sq ft</dd>
        </div>
        <div>
          <dt>Year</dt>
          <dd>{job.year}</dd>
        </div>
        <div>
          <dt>Substrate</dt>
          <dd>{job.substrate}</dd>
        </div>
        <div>
          <dt>Species</dt>
          <dd>{job.species}</dd>
        </div>
      </dl>

      <p className="jc-outcome">{job.outcome}</p>

      <p className="jc-measure">
        <span className="jc-measure-label">{job.measurement.metric}</span>
        <span className="jc-measure-value">
          {job.measurement.value}
          <em>{job.measurement.unit}</em>
        </span>
      </p>

      <Link className="jc-link" href={href} onClick={() => track('jobcard_click', { slug: job.slug, from })}>
        Read what was measured <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

/**
 * A row of job cards with a heading. The `intro` says what the reader is
 * looking at; it never restates a figure from the cards themselves.
 */
export function JobCardRail({
  kicker = 'Finished work',
  heading,
  intro,
  jobs,
  from,
}: {
  kicker?: string;
  heading: string;
  intro?: string;
  jobs: readonly JobCardData[];
  /** Where this rail is rendered — recorded on the click event. */
  from: string;
}) {
  if (!jobs.length) return null;
  return (
    <section className="section-tight jc-rail" aria-label="Finished work">
      <div className="shell">
        <p className="tlx-kicker">{kicker}</p>
        <h2 className="tlx-h2">{heading}</h2>
        {intro && <p className="tlx-note jc-rail-intro">{intro}</p>}
        <div className="jc-grid">
          {jobs.map((j) => (
            <JobCard key={j.slug} job={j} from={from} />
          ))}
        </div>
        <p className="tlx-note">
          Every one of these is a published case study with its readings, its protocol and its
          failures in it — <Link href="/case-studies">all of them are here</Link>.
        </p>
      </div>
    </section>
  );
}
