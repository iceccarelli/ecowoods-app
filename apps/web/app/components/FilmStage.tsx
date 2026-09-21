'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Film } from '@/lib/films';

/**
 * FilmStage — one first-party film, three chapters, one video element.
 *
 * WHY THIS IS NOT ProcessVideo
 *
 * ProcessVideo is a documented, deliberate facade for a film that does not
 * exist yet: poster, two sentences, and — only if an env var names one — a
 * YouTube embed on click. Every route this component mounts on now HAS the
 * film, so there is nothing to gate and nothing borrowed to disclaim.
 * ProcessVideo is left in place, untouched, for a route that still wants the
 * "poster and an honest placeholder, or a linked YouTube ID" contract.
 *
 * THE ONE <video> RULE
 *
 * Three chapters share a single <video> element — switching chapters swaps
 * `src`, it does not mount a second player. The chapter strip is the same
 * numbered-tab grammar the trilogy `FigureRotator` uses for its prev/next
 * bar, so a visitor who has already met that pattern elsewhere on the site
 * meets it again here.
 *
 * CLICK-TO-PLAY, WITH SOUND, NEVER BEFORE A CLICK
 *
 * The <video> tag itself is not in the DOM until a person presses play, so
 * there is nothing for the browser to fetch before that — the poster (a real,
 * static-imported `<Image>`, the same trick ProcessVideo's own poster uses)
 * is the only thing that can ever be this page's LCP element. `autoPlay` on
 * the mounted video is not a policy violation: a browser only honours
 * autoplay-with-sound when it follows directly from a user gesture, which a
 * play-button click is.
 *
 * No muted homepage loop. The brief allows one, optionally, behind
 * prefers-reduced-motion; this ships the click-to-play behaviour everywhere
 * instead, uniformly, which makes "does this page autoplay" a question this
 * component never has to answer per-route.
 *
 * `preload="none"` on the mounted <video>, not "metadata" — belt and braces
 * over the not-in-the-DOM-until-clicked design above. It costs nothing: by
 * the time this element exists at all, `playing` is already true and
 * `autoPlay` is about to request the file regardless of what `preload` says,
 * same as a `<button onclick>` firing a fetch — the attribute governs idle
 * behaviour this component never reaches.
 *
 * PORTRAIT VS LANDSCAPE. `.filmstage-frame` stays a fixed 16:9 box for every
 * film — the-how ships portrait (9:16) source, so `film.frame === 'portrait'`
 * adds `.filmstage--portrait`, which lets the video's own black background
 * letterbox it via `object-fit:contain` instead of stretching it. the-work
 * and the-brief carry `frame: 'landscape'` and render exactly as before.
 */
export function FilmStage({
  film,
  defaultChapter,
  priority = false,
  className = '',
}: {
  film: Film;
  defaultChapter?: 1 | 2 | 3;
  priority?: boolean;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<1 | 2 | 3>(defaultChapter ?? film.defaultChapter);
  const [playing, setPlaying] = useState(false);
  const active = film.chapters.find((c) => c.id === activeId) ?? film.chapters[0];

  return (
    <figure
      className={[
        'filmstage',
        film.frame === 'portrait' ? 'filmstage--portrait' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="filmstage-frame">
        {playing ? (
          <video
            key={active.src}
            className="filmstage-video"
            src={active.src}
            controls
            autoPlay
            playsInline
            preload="none"
            aria-label={active.title}
          />
        ) : (
          <>
            <Image
              src={film.poster}
              alt={`${film.headline} — poster`}
              placeholder="blur"
              priority={priority}
              sizes="(max-width: 768px) 100vw, 960px"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              type="button"
              className="filmstage-play"
              onClick={() => setPlaying(true)}
              aria-label={`Play: ${active.title}`}
            >
              <span className="filmstage-play-glyph" aria-hidden="true">
                ▶
              </span>
            </button>
          </>
        )}
      </div>

      <div className="filmstage-strip" role="tablist" aria-label={`${film.headline} chapters`}>
        {film.chapters.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={c.id === activeId}
            className={`filmstage-tab${c.id === activeId ? ' is-active' : ''}`}
            onClick={() => {
              setActiveId(c.id);
              setPlaying(true);
            }}
          >
            <span className="filmstage-tab-num">{String(c.id).padStart(2, '0')}</span>
            <span className="filmstage-tab-title">{c.title}</span>
            <span className="filmstage-tab-dur">{c.durationLabel}</span>
          </button>
        ))}
      </div>

      <figcaption className="filmstage-caption">{active.caption}</figcaption>
    </figure>
  );
}
