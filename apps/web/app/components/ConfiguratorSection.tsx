'use client';

/**
 * ConfiguratorSection — "Design Your Floor".
 *
 * Desktop: the configurator inline, exactly as before — a three-column tool
 * with room to breathe that earns its place in the scroll.
 *
 * Mobile: that same tool is five screens of swatches, sliders and inputs which
 * every non-interested visitor has to thumb past. On phones it collapses to one
 * compact teaser card and opens full-screen on demand — less scroll for the
 * uninterested, more room for the interested.
 *
 * The sheet chrome lives in MobileSheet, shared with the booking panel.
 */

import { useRef, useState } from 'react';
import FloorConfigurator from './FloorConfigurator';
import MobileSheet from './MobileSheet';
import { useIsMobile } from './SwipeDeck';

export default function ConfiguratorSection() {
  const { mounted, isMobile } = useIsMobile();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  // SSR + desktop: unchanged inline tool.
  if (!mounted || !isMobile) return <FloorConfigurator />;

  return (
    <section className="section-tight" id="configurator">
      <div className="shell">
        <div className="teaser reveal">
          <span className="eyebrow">Design Your Floor</span>
          <h2 className="teaser-title">
            Build it here. <span className="serif-italic">Then stand on it.</span>
          </h2>
          <p className="teaser-body">
            Species, finish, pattern, size — priced live with the same numbers our estimator
            carries in the truck. A range, not a quote.
          </p>
          <button
            ref={opener}
            type="button"
            className="teaser-btn"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
          >
            <span>Open the floor designer</span>
            <span aria-hidden="true">→</span>
          </button>
          <span className="teaser-note">Takes about a minute · nothing to fill in</span>
        </div>
      </div>

      <MobileSheet
        open={open}
        onClose={() => {
          setOpen(false);
          opener.current?.focus?.();
        }}
        title="Design your floor"
      >
        <FloorConfigurator />
      </MobileSheet>
    </section>
  );
}
