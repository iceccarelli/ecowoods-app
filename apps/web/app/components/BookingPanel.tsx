'use client';

/**
 * BookingPanel — the calendar column of the Free In-Home Estimate section.
 *
 * Desktop: unchanged — the calendar sits beside the contact details, which is
 * exactly where it belongs on a wide screen.
 *
 * Mobile: the month grid plus its time slots is the long block in this section
 * (the estimate form is already behind its own modal, and the contact details
 * are four short rows worth keeping in the scroll). Inline at 390px the grid is
 * cramped and fiddly to tap; behind a sheet it gets the full screen and becomes
 * genuinely easier to use, while everyone else passes a single card.
 *
 * Deliberately NOT hidden: the phone number and the primary estimate CTA stay
 * inline in page.tsx. This is the conversion section — the calendar is a second
 * path to booking, so it can live one tap away, but the primary path never
 * should.
 */

import { HOURS_LINE_SHORT } from '@ecowoods/shared/constants';
import { useRef, useState } from 'react';
import { BookingScheduler } from './BookingScheduler';
import MobileSheet from './MobileSheet';
import { useIsMobile } from './SwipeDeck';
import type { ReactNode } from 'react';

export default function BookingPanel({ clockIcon }: { clockIcon: ReactNode }) {
  const { mounted, isMobile } = useIsMobile();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  // SSR + desktop: the original inline column.
  if (!mounted || !isMobile) {
    return (
      <div className="booking-column reveal">
        <div className="booking-step-label">
          <span>{clockIcon}</span> Bookings
        </div>
        <BookingScheduler />
      </div>
    );
  }

  return (
    <div className="booking-column booking-column--compact reveal">
      <div className="teaser teaser--onDark">
        <div className="booking-step-label">
          <span>{clockIcon}</span> Bookings
        </div>
        <h3 className="teaser-title teaser-title--sm">
          Pick a day that <span className="serif-italic">suits you.</span>
        </h3>
        <p className="teaser-body">
          Free in-home estimate · {HOURS_LINE_SHORT}. Most weeks have openings within a few
          days.
        </p>
        <button
          ref={opener}
          type="button"
          className="teaser-btn"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          <span>See available dates</span>
          <span aria-hidden="true">→</span>
        </button>
        <span className="teaser-note">Takes 3 steps · no obligation</span>
      </div>

      <MobileSheet
        open={open}
        onClose={() => {
          setOpen(false);
          opener.current?.focus?.();
        }}
        title="Pick a day"
      >
        <div className="sheet-pad">
          <BookingScheduler />
        </div>
      </MobileSheet>
    </div>
  );
}
