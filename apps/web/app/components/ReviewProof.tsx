import Link from 'next/link';
import { PRIMARY_REVIEW_EVIDENCE, SECONDARY_REVIEW_EVIDENCE } from '@ecowoods/shared/constants';

/**
 * ReviewProof — the dated, cited review figures, beside a call to action.
 *
 * Reads the review registry (REVIEW_EVIDENCE) only: each platform on its own row with the date its
 * profile was read, never blended into one number and never turned into
 * aggregateRating markup (that is /reviews' job, and verify:reviews enforces
 * it). Linked to the platform profile so the visitor can check the figure, and
 * to /reviews for the full record. Server component; no client JS.
 */
export function ReviewProof({ className = 'fw-meta' }: { className?: string }) {
  const rows = [PRIMARY_REVIEW_EVIDENCE, ...SECONDARY_REVIEW_EVIDENCE];
  return (
    <p className={className} style={{ marginTop: '0.75rem', fontSize: '0.88rem' }}>
      {rows.map((r, i) => (
        <span key={r.platform}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <a href={r.href} target="_blank" rel="noopener noreferrer">
            {r.count} reviews at {r.rating.toFixed(1)}/{r.outOf} on {r.platform}
          </a>{' '}
          (read {r.asOf})
        </span>
      ))}
      <span aria-hidden="true"> · </span>
      <Link href="/reviews">How these are cited</Link>
    </p>
  );
}
