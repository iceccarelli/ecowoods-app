/**
 * ContentLibraryPromo — compact homepage teaser below Pricing.
 * No cards: headline block + two buttons, into the papers and into the
 * technical library, mirroring the "Design your floor" teaser above it.
 */
import Link from 'next/link';

export function ContentLibraryPromo() {
  return (
    <section className="section-tight section--tint">
      <div className="shell">
        <div className="section-head reveal" style={{ maxWidth: '640px' }}>
          <span className="eyebrow">Still researching?</span>
          <h2>
            The science behind <span className="serif-italic">the price.</span>
          </h2>
          <p>
            Moisture testing, finish chemistry, dust-free methodology — the technical standards
            the estimate is built on, documented from the job site.
          </p>
          <div className="clp-actions">
            <Link href="/papers" className="btn btn-copper">
              Read the technical papers <span aria-hidden>→</span>
            </Link>
            <Link href="/technical-library" className="btn btn-ghost">
              Browse the library
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
