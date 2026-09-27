import type { AudioTrack } from '@/lib/films';

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
 */
export function AudioStage({ track, className = '' }: { track: AudioTrack; className?: string }) {
  return (
    <figure className={`audiostage ${className}`.trim()}>
      <div className="audiostage-frame">
        <p className="audiostage-kicker">{track.kicker}</p>
        <p className="audiostage-title">{track.title}</p>
        <audio className="audiostage-player" src={track.src} controls preload="none" aria-label={track.title} />
        <p className="audiostage-dur">{track.durationLabel}</p>
      </div>
      <figcaption className="audiostage-caption">{track.caption}</figcaption>
    </figure>
  );
}
