'use client';

import { useRef, useEffect } from 'react';
import type { AudioTrack } from '@/lib/films';
import { registerMediaElement } from '@/lib/media-coordinator';

/**
 * AudioStage — the one first-party audio track this site plays, presented as
 * audio rather than forced into FilmStage's video frame.
 *
 * Native <audio controls>, not a custom play button: at 38 minutes this is a
 * long-form listen, not a 90-second clip, so a visitor needs real seek and
 * volume controls from the first render — the browser's own transport already
 * gives that, with full keyboard and screen-reader support, at zero JS cost.
 * `preload="none"` keeps the 74MB file off the network until a visitor
 * presses play; nothing on this page auto-loads or autoplays it.
 *
 * Registered with the same media-coordinator every FilmStage uses: playing
 * this track pauses any film mid-play on the same page (the-price-menu's
 * section mounts two FilmStage chapters and this audio together), and
 * playing a film pauses this if it was running.
 */
export function AudioStage({ track, className = '' }: { track: AudioTrack; className?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    return registerMediaElement(el);
  }, []);

  return (
    <figure className={`audiostage ${className}`.trim()}>
      <div className="audiostage-frame">
        <p className="audiostage-kicker">{track.kicker}</p>
        <p className="audiostage-title">{track.title}</p>
        <audio
          ref={audioRef}
          className="audiostage-player"
          src={track.src}
          controls
          preload="none"
          aria-label={track.title}
        />
        <p className="audiostage-dur">{track.durationLabel}</p>
      </div>
      <figcaption className="audiostage-caption">{track.caption}</figcaption>
    </figure>
  );
}
