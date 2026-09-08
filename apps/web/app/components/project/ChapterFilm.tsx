'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectFilm, ProjectStill } from '@/lib/projects';

/**
 * A chapter film that behaves like part of a page rather than an interruption.
 *
 * THE RULES IT KEEPS
 *
 * · MUTED, ALWAYS, UNTIL A PERSON ASKS. Autoplaying sound is the single most
 *   hostile thing a website does. It starts muted, it stays muted, and the
 *   unmute control is a real button with a real label.
 * · preload="metadata" AND A POSTER. The LCP element on this page is the
 *   poster still, which is a 200 KB webp, not a 3 MB mp4. The video downloads
 *   when it is about to play, not when the page loads.
 * · IT PLAYS WHEN IT IS ON SCREEN AND PAUSES WHEN IT IS NOT. Sixty percent
 *   visible, so it does not start on a frame nobody can see.
 * · prefers-reduced-motion FREEZES IT ON THE POSTER. No autoplay, no loop —
 *   the controls still work, so a person who wants it can still have it. That
 *   is what the query asks for: no unrequested motion, not no video.
 */
export default function ChapterFilm({
  film,
  poster,
}: {
  film: ProjectFilm;
  poster: ProjectStill;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || reduced) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) void el.play().catch(() => undefined);
          else el.pause();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const toggle = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, []);

  return (
    <figure className="pj-film">
      <video
        ref={videoRef}
        className="pj-film-video"
        poster={poster.src}
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={film.title}
        width={film.width}
        height={film.height}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
      >
        <source src={film.src} type="video/mp4" />
      </video>

      <div className="pj-film-bar">
        <button type="button" className="pj-film-btn" onClick={toggle} aria-pressed={playing}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="pj-film-btn" onClick={toggleMute} aria-pressed={!muted}>
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <div className="pj-film-track" role="presentation">
          <span className="pj-film-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <figcaption className="pj-film-cap">
        {film.title}. No commentary track and no music — the file is the cut as it was
        graded, and nothing has been added to it here.
      </figcaption>
    </figure>
  );
}
