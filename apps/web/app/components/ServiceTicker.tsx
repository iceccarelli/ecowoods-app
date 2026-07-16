'use client';

/**
 * ServiceTicker — the service list as a continuously flowing exchange ticker.
 *
 * Replaces the static wrapped chip row that sat directly above "How It Works".
 * Items flow left -> right, fading in at the left edge and dissolving at the
 * right, then looping seamlessly (the track holds two copies of the list and
 * translates by exactly 50%, so the wrap is invisible).
 *
 * Accessibility:
 *  - the moving track is aria-hidden; a static, screen-reader-only list carries
 *    the real content, so nothing depends on catching a moving target.
 *  - `prefers-reduced-motion` falls back to the original static chip row.
 *    Perpetual motion is a genuine vestibular/attention problem, and a ticker
 *    is the classic offender — this is not optional polish.
 *  - motion pauses on hover and on keyboard focus so values can be read.
 */

import { useEffect, useState } from 'react';

export type TickerItem = {
  label: string;
  /** share of recent project mix, in percent. Omit for a plain label marquee. */
  share?: number;
  trend?: 'up' | 'down' | 'flat';
};

const TREND_GLYPH: Record<'up' | 'down' | 'flat', string> = {
  up: '▲',
  down: '▼',
  flat: '·',
};

export default function ServiceTicker({
  items,
  label = 'Services',
  tone = 'auto',
}: {
  items: TickerItem[];
  label?: string;
  /**
   * 'auto' follows the site theme (correct on light/paper sections).
   * 'dark' pins light-on-dark chips for the photo-backed #services section,
   * where themed chips would be invisible.
   */
  tone?: 'auto' | 'dark';
}) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Static fallback — also the pre-hydration / reduced-motion render.
  if (reduced) {
    return (
      <div className={`svt svt--static ${tone === 'dark' ? 'svt--dark' : ''}`} aria-label={label}>
        {items.map((s) => (
          <span key={s.label} className="svt-item">
            <span className="svt-label">{s.label}</span>
            {s.share !== undefined && (
              <span className={`svt-value svt-value--${s.trend ?? 'flat'}`}>{s.share}%</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  // Duration scales with item count so speed stays constant regardless of list
  // length (~4.2s per item feels readable rather than frantic).
  const duration = Math.max(18, items.length * 4.2);

  const row = items.map((s) => (
    <span className="svt-item" key={s.label}>
      <span className="svt-label">{s.label}</span>
      {s.share !== undefined && (
        <span className={`svt-value svt-value--${s.trend ?? 'flat'}`}>
          <span className="svt-trend" aria-hidden="true">
            {TREND_GLYPH[s.trend ?? 'flat']}
          </span>
          {s.share}%
        </span>
      )}
    </span>
  ));

  return (
    <div className={`svt reveal ${tone === 'dark' ? 'svt--dark' : ''}`} aria-label={label}>
      <div className="svt-viewport">
        <div
          className="svt-track"
          style={{ animationDuration: `${duration}s` }}
          aria-hidden="true"
        >
          {/* two identical copies — the loop wraps at exactly -50% */}
          <div className="svt-run">{row}</div>
          <div className="svt-run">{row}</div>
        </div>
      </div>

      {/* real content for assistive tech — never a moving target */}
      <ul className="svt-sr">
        {items.map((s) => (
          <li key={s.label}>
            {s.share !== undefined ? `${s.label}: ${s.share}% of recent projects` : s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
