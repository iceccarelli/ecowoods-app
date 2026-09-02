import type { Metadata } from 'next';
import { PROOF_PLATES } from '@/content/proof-sliders';
import { ProofSlider } from '../components/ProofSlider';

/**
 * /proof-review — every registered plate on one page, for the owner.
 *
 * NOINDEX, AND NOT A GALLERY. It exists because 18 plates were registered and
 * one was mounted, so there was no way to look at the other 17 without reading
 * the registry. That is a review surface, not a public one: the briefs are
 * explicit that a second gallery is not wanted and that three sliders on
 * ranking pages beat sixteen on pages nobody opens.
 *
 * Each card names the routes that plate is DESTINED for, so this page doubles
 * as the mounting worksheet. Delete it once the placements are done.
 */
export const metadata: Metadata = {
  title: 'Proof plate review',
  robots: { index: false, follow: false },
  alternates: { canonical: '/proof-review' },
};

export default function ProofReviewPage() {
  const plates = Object.values(PROOF_PLATES);
  return (
    <div className="tlx-page">
      <section className="tlx-section">
        <div className="shell">
          <p className="tlx-kicker">Internal</p>
          <h1 className="tlx-title">All {plates.length} proof plates</h1>
          <p className="tlx-lede">
            Every registered before/after pair. Not linked from anywhere and not indexed. Each one
            lists the routes it is destined for; only the first is mounted on the site so far.
          </p>
          {plates.map((p) => (
            <div key={p.id} style={{ margin: '4rem 0' }}>
              <ProofSlider plate={p} />
              <p className="tlx-note" style={{ marginTop: '0.75rem' }}>
                <code>{p.id}</code> · {p.source} ·{' '}
                {p.routes.length ? `destined for ${p.routes.join(', ')}` : 'no route assigned yet'}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
