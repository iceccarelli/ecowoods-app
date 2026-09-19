'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RotatingTile } from './RotatingTile';
import type { Trilogy, TrilogyKind } from '@/lib/trilogies';

/**
 * TrilogyLibraryGrid — the /library grid for the 20-trilogy photo set.
 *
 * Same `.lib-grid` / `.lib-card--photo` markup the floor collection and
 * machine sections on this page already use, and the same RotatingTile —
 * Ken Burns, staggered so the grid does not blink in unison, paused
 * off-screen, still under prefers-reduced-motion. A quiet grid, on purpose:
 * this page's own section below explains why the photographs move and the
 * diagrams do not, and a trilogy card is closer kin to a floor-collection
 * tile than to an explanatory diagram.
 *
 * Filter chips are five, not the seven actual `kind` values on a Trilogy —
 * "hero", "residential" and "grand" all read as "a floor, in a room" to a
 * visitor filtering a photo library, so they share the "Floors" chip. Stairs,
 * Inlays, Commercial and Detail each keep their own.
 */
const CHIPS: { label: string; kinds: TrilogyKind[] }[] = [
  { label: 'All', kinds: [] },
  { label: 'Floors', kinds: ['hero', 'residential', 'grand'] },
  { label: 'Stairs', kinds: ['stairs'] },
  { label: 'Inlays', kinds: ['inlay'] },
  { label: 'Commercial', kinds: ['commercial'] },
  { label: 'Detail', kinds: ['detail'] },
];

export function TrilogyLibraryGrid({ trilogies }: { trilogies: Trilogy[] }) {
  const [active, setActive] = useState('All');
  const chip = CHIPS.find((c) => c.label === active) ?? CHIPS[0]!;
  const shown = chip.kinds.length ? trilogies.filter((t) => chip.kinds.includes(t.kind)) : trilogies;

  return (
    <>
      <div className="lib-trilogy-chips" role="group" aria-label="Filter by kind">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            className={`lib-trilogy-chip${c.label === active ? ' is-active' : ''}`}
            aria-pressed={c.label === active}
            onClick={() => setActive(c.label)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <ul className="lib-grid">
        {shown.map((t, n) => (
          <li key={t.slug} className="lib-item">
            <Link href={`/projects/${t.slug}`} className="lib-card lib-card--photo">
              <RotatingTile
                shots={t.frames.map((f) => f.src)}
                alt={`${t.kicker} — ${t.headline}`}
                index={n}
              />
              <span className="lib-caption">
                <strong>{t.kicker}</strong>
                {t.headline}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
