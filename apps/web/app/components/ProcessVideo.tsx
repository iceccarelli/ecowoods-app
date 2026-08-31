'use client';

import { useState } from 'react';
import Image from 'next/image';
import poster from '../../public/gallery-machines/dust-containment-01-inuse.webp';

/**
 * ProcessVideo — the film slot, and an honest page when there is no film.
 *
 * THE ONE THING THIS MUST NEVER DO is embed a video that is not ours. A
 * flooring channel's sanding footage on this page would be the visual
 * equivalent of quoting somebody else's moisture reading, and this repository
 * fails builds over that in five other places.
 *
 * So the slot is env-gated. Set NEXT_PUBLIC_YOUTUBE_PROCESS_ID and it renders
 * the film. Unset — which is the state today — it renders the poster and says
 * what the film will show, in two sentences that are true whether or not the
 * film ever gets made. A visitor who reads the fallback still learns the thing
 * the video exists to teach; that is the test a placeholder has to pass before
 * it is allowed to ship.
 *
 * FACADE PATTERN, NOT AN IFRAME. Even with an ID set, the YouTube iframe is
 * NOT in the initial HTML. A cold YouTube embed pulls roughly half a megabyte
 * of third-party JavaScript and sets cookies before anyone presses play — on a
 * page whose LCP work (P2.5) exists to get the price and the form in front of
 * someone quickly. The poster is a local image; the iframe is created on click,
 * from youtube-nocookie.com, with autoplay so the click is not wasted.
 */

const VIDEO_ID = process.env.NEXT_PUBLIC_YOUTUBE_PROCESS_ID;

export function ProcessVideo({
  title = 'Dust-free hardwood sanding in an occupied Toronto home',
  className = '',
}: {
  title?: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className={`pv ${className}`.trim()}>
      <div className="pv-frame">
        {playing && VIDEO_ID ? (
          <iframe
            className="pv-iframe"
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <Image
              src={poster}
              alt="HEPA-sealed dust containment set up around a work zone"
              placeholder="blur"
              sizes="(max-width: 768px) 100vw, 720px"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {VIDEO_ID ? (
              <button type="button" className="pv-play" onClick={() => setPlaying(true)} aria-label={`Play: ${title}`}>
                <span className="pv-play-glyph" aria-hidden="true">
                  ▶
                </span>
              </button>
            ) : (
              <span className="pv-badge">Film coming</span>
            )}
          </>
        )}
      </div>

      <figcaption className="pv-caption">
        <strong>{title}</strong>
        {!VIDEO_ID && (
          <span className="pv-fallback">
            Extraction runs at each machine and a sealed barrier is built at the room, which is what
            makes it possible to sand a floor in a house nobody has moved out of. The containment is
            struck and rebuilt every shift, so the space is handed back usable at the end of each day
            rather than at the end of the job.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
