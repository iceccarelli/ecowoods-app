import Link from 'next/link';
import { designCodeFor, designFor } from '@/lib/floor-studio/lead-design';
import { describeStudioDesign, studioHref, studioRef } from '@/lib/floor-studio/studio-config';
import { priceConfiguration, productById } from '@/lib/floor-studio/catalog';
import { formatDesignId } from '@/lib/floor-studio/design-id';

/**
 * The floor this lead designed, on the estimator's screen.
 *
 * WHY THIS IS THE PATCH
 *
 * Until now the only way to see it was to find the code in the note, select
 * it, and paste it into /floor-studio. PG0 verified: zero uses of
 * decodeStudioDesign anywhere under app/admin/. Every quote that came out of
 * the studio cost an estimator a copy, a paste and a context switch, and the
 * one thing a homeowner most wants discussed on the call was the thing hardest
 * to look at before it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not render the floor. The renderer needs the visitor's own room
 * photo, which this business does not have and by design never will — Floor
 * Studio reads photos in the browser and retains none. A picture here would
 * have to invent a room, and an estimator looking at an invented room before a
 * call is worse off than one looking at a specification.
 *
 * It does not restate the price as a fixed figure. The range is the same
 * estimate the visitor was shown, labelled as such, because the whole pricing
 * posture of this site is that the fixed price comes after the measure.
 */
export function StudioDesignCard({
  quote,
}: {
  quote: { designCode?: string | null; notes?: string | null; designId?: string | null };
}) {
  const design = designFor(quote);
  const code = designCodeFor(quote);

  /* No code at all is the ordinary case — a phone lead, a service page, the
     assistant. Render nothing rather than an empty card announcing an absence. */
  if (!code) return null;

  if (!design) {
    /* A code that will not decode is a real signal, not an error to hide: it
       means a floor we have retired, or a truncated link. The estimator needs
       to know the visitor was looking at SOMETHING and that we can no longer
       say what, rather than seeing a blank space that reads as "no design". */
    return (
      <section className="admin-card">
        <h3>Floor Studio design</h3>
        <p>
          This lead carried a design code that no longer resolves against the current
          catalogue — most likely a floor we have retired, or a truncated link. The raw
          code is kept below so it can be read by hand.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{code}</pre>
      </section>
    );
  }

  const product = productById(design.config.productId);
  const estimate = priceConfiguration(design.config, design.squareFeet, design.country);

  return (
    <section className="admin-card">
      <h3>Floor Studio design</h3>

      <p>
        <strong>{describeStudioDesign(design)}</strong>
      </p>

      <dl className="detail-list">
        <div className="detail-row">
          <dt>Reference</dt>
          <dd>
            {studioRef(design)}
            {design.designId && <> · design {formatDesignId(design.designId)}</>}
          </dd>
        </div>
        <div className="detail-row">
          <dt>Species</dt>
          <dd>{product?.name ?? design.config.productId}</dd>
        </div>
        <div className="detail-row">
          <dt>Area</dt>
          <dd>{design.squareFeet.toLocaleString('en-CA')} sq ft</dd>
        </div>
        <div className="detail-row">
          <dt>Estimated installed</dt>
          {/* The SAME figure the visitor saw, from the same function, in the
              currency their band set was written in. An estimator quoting
              against a different number than the one on the customer's screen
              is the argument this row exists to prevent. */}
          <dd>
            {estimate.perSqftCad} {estimate.currency} — estimate, fixed after the measure
          </dd>
        </div>
        <div className="detail-row">
          <dt>Priced against</dt>
          <dd>{design.country === 'US' ? 'New York bands (USD)' : 'Ontario bands (CAD)'}</dd>
        </div>
        {design.feels.length > 0 && (
          <div className="detail-row">
            <dt>They asked for</dt>
            <dd>{design.feels.join(', ')}</dd>
          </div>
        )}
        {design.room && (
          <div className="detail-row">
            <dt>Their photo read as</dt>
            {/* A reading, never a photograph. Nothing here came off an image
                that reached a server — the browser measured it and sent three
                words. */}
            <dd>
              {design.room.lightLevel} light · {design.room.wallUndertone} walls ·{' '}
              {design.room.existingFloorTone} existing floor
            </dd>
          </div>
        )}
        {design.budgetCad && (
          <div className="detail-row">
            <dt>Budget they typed</dt>
            <dd>
              {design.budgetCad.toLocaleString('en-CA')} {estimate.currency}
            </dd>
          </div>
        )}
      </dl>

      <p>
        <Link href={studioHref(design)} target="_blank" rel="noopener">
          Open this exact floor in Floor Studio →
        </Link>
      </p>
    </section>
  );
}
