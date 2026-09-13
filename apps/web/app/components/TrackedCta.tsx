'use client';

import Link from 'next/link';
import { track, type AnalyticsEvent } from '@/lib/analytics';

/**
 * A call to action that reports being used.
 *
 * WHY THIS EXISTS
 *
 * `commercial_cta` and `realtor_cta` have been declared in the AnalyticsEvent
 * union since the union was written, and PG0 found that neither has ever
 * fired from anywhere. The reason is structural rather than an oversight:
 * /commercial and /realtors are server components, `track()` is browser-only,
 * and nobody had built the one-line client boundary that lets a server-rendered
 * page carry a measured link. So the events sat in the contract looking like
 * coverage while the two highest-intent commercial pages on the site reported
 * nothing at all.
 *
 * This is that boundary, and it is deliberately the whole of it: a link, an
 * event name, and an optional label. It renders `next/link` for internal
 * routes and a plain anchor for a fragment or an external URL, because
 * `next/link` to `#estimate` on the same page is a router round trip for a
 * scroll.
 *
 * It carries no personal data and takes no arbitrary parameters — a `label`
 * chosen by the caller from its own copy, and nothing else.
 */
export function TrackedCta({
  event,
  href,
  label,
  className,
  children,
}: {
  event: AnalyticsEvent;
  href: string;
  /** Which CTA on the page this is. Copy, not data about the visitor. */
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const onClick = () => track(event, label ? { label } : undefined);
  const external = href.startsWith('#') || href.startsWith('http') || href.startsWith('tel:');

  if (external) {
    return (
      <a className={className} href={href} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}
