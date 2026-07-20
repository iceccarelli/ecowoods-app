'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BLUR_WARM } from '@/lib/image';
import { floors, floorImages, type Floor } from '../data/floors';

const N = floors.length;
const SHOT_KEYS = ['room', 'detail', 'lifestyle'] as const;
type ShotKey = (typeof SHOT_KEYS)[number];

const IMAGE_MS = 4000;   // rotate the 3 photos within a floor
const FLOOR_MS = 6000;   // auto-advance to the next floor
const THROW_MS = 340;
const THRESHOLD = 90;

const CARD_SIZES = '(max-width: 767px) 90vw, 640px';
const PEEK_SIZES = '260px';
const LIGHTBOX_SIZES = '(max-width: 900px) 92vw, 640px';

// per-photo caption so each of the 3 images "speaks" as it rotates
function shotCaption(f: Floor, s: ShotKey): string {
  if (s === 'room') return 'Seen in the room';
  if (s === 'detail') return `Grain & finish up close · ${f.finish}`;
  return `Lived-in · ${f.bestFor}`;
}
const SHOT_LABEL: Record<ShotKey, string> = { room: 'In the room', detail: 'Grain detail', lifestyle: 'Lived-in' };

/* ─────────────────────────── Lightbox ─────────────────────────── */
function FloorLightbox({ index, onClose, onNav }: { index: number; onClose: () => void; onNav: (d: 1 | -1) => void }) {
  const floor = floors[index];
  const imgs = floorImages(floor.slug);
  const [shot, setShot] = useState<ShotKey>('room');
  useEffect(() => setShot('room'), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNav(1);
      else if (e.key === 'ArrowLeft') onNav(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, onNav]);

  return createPortal(
    <div className="gc-scrim" role="dialog" aria-modal="true" aria-label={`${floor.name} — details`} onClick={onClose}>
      <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gc-close" onClick={onClose} aria-label="Close">×</button>
        <div className="gc-modal-media">
          <div className="gc-modal-stage">
            <div className="gc-kb" key={shot}>
              <Image src={imgs[shot]} alt={`${floor.name} — ${shot}`} fill sizes={LIGHTBOX_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
            </div>
          </div>
          <div className="gc-thumbs" role="tablist" aria-label="Views of this floor">
            {SHOT_KEYS.map((k) => (
              <button key={k} role="tab" aria-selected={shot === k} className={`gc-thumb ${shot === k ? 'is-active' : ''}`} onClick={() => setShot(k)}>
                <Image src={imgs[k]} alt="" fill sizes="120px" placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
                <span className="gc-thumb-label">{SHOT_LABEL[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="gc-modal-body">
          <span className="gc-eyebrow">{floor.species} · {floor.format}</span>
          <h3 className="gc-modal-title">{floor.name}</h3>
          <p className="gc-tagline">{floor.tagline}</p>
          <p className="gc-desc">{floor.description}</p>
          <dl className="gc-specs">
            <div><dt>Hardness</dt><dd>Janka {floor.janka}</dd></div>
            <div><dt>Origin</dt><dd>{floor.origin}</dd></div>
            <div><dt>Finish</dt><dd>{floor.finish}</dd></div>
            <div><dt>Best for</dt><dd>{floor.bestFor}</dd></div>
          </dl>
          <a href="#quote" className="gc-cta" onClick={onClose}>Get a fixed-price estimate for this floor</a>
          <div className="gc-modal-nav">
            <button onClick={() => onNav(-1)} aria-label="Previous floor">‹ Prev</button>
            <span>{index + 1} / {N}</span>
            <button onClick={() => onNav(1)} aria-label="Next floor">Next ›</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────── Stage (shared desktop + mobile) ───────────── */
function Stage({ floor, shot, kbIndex, dx, transition, onOpen, drag }: {
  floor: Floor; shot: ShotKey; kbIndex: number; dx: number; transition: boolean;
  onOpen: () => void; drag: React.DOMAttributes<HTMLDivElement>;
}) {
  const imgs = floorImages(floor.slug);
  const rot = dx * 0.04;
  return (
    <div
      className="gc-stage"
      style={{ transform: `translateX(${dx}px) rotate(${rot}deg)`, transition: transition ? `transform ${THROW_MS}ms cubic-bezier(0.22,1,0.36,1)` : 'none' }}
      role="group" aria-label={`${floor.name}. Tap for photos and specs.`}
      onClick={onOpen} {...drag}
    >
      {/* ken-burns image, remounts (and restarts the pan/zoom) on every floor+shot change */}
      <div className={`gc-kb gc-kb-${kbIndex % 4}`} key={`${floor.slug}-${shot}`}>
        <Image src={imgs[shot]} alt={`${floor.name} — ${SHOT_LABEL[shot]}`} fill sizes={CARD_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} draggable={false} />
      </div>
      <span className="gc-card-scrim" />
      <span className="gc-shot-badge">{SHOT_LABEL[shot]}</span>
      <span className="gc-card-chip">Janka {floor.janka}</span>
      <span className="gc-tap-hint">Tap for 3 photos + details</span>
      <span className="gc-card-cap">
        <span className="gc-card-eyebrow">{floor.species} · {floor.format}</span>
        <span className="gc-card-title">{floor.name}</span>
        <span className="gc-shot-cap" key={shot}>{shotCaption(floor, shot)}</span>
      </span>
      <span className="gc-shot-dots">
        {SHOT_KEYS.map((k) => <span key={k} className={`gc-shot-dot ${k === shot ? 'is-active' : ''}`} />)}
      </span>
    </div>
  );
}

/* ───────────────────────────── Show ────────────────────────────── */
export default function FloorCatalog() {
  const [floor, setFloor] = useState(0);
  const [shotIdx, setShotIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // drag / throw
  const [dx, setDx] = useState(0);
  const [throwing, setThrowing] = useState(false);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const shot = SHOT_KEYS[shotIdx];
  const active = playing && !hovering && !dragging && lightbox === null && mounted;

  const goFloor = useCallback((step: 1 | -1) => { setFloor((f) => (f + step + N) % N); setShotIdx(0); }, []);
  const jumpFloor = useCallback((i: number) => { setFloor(i); setShotIdx(0); }, []);

  // autoplay — photos every 4s, floors every 6s (independent, both pausable)
  useEffect(() => {
    if (!active) return;
    const img = window.setInterval(() => setShotIdx((s) => (s + 1) % 3), IMAGE_MS);
    return () => window.clearInterval(img);
  }, [active, floor]);
  useEffect(() => {
    if (!active) return;
    const flr = window.setInterval(() => { setFloor((f) => (f + 1) % N); setShotIdx(0); }, FLOOR_MS);
    return () => window.clearInterval(flr);
  }, [active]);

  // keyboard
  useEffect(() => {
    if (lightbox !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goFloor(1);
      else if (e.key === 'ArrowLeft') goFloor(-1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, goFloor]);

  const fling = useCallback((step: 1 | -1) => {
    if (throwing) return;
    setThrowing(true);
    setDx(step === 1 ? -window_w() * 1.2 : window_w() * 1.2);
    window.setTimeout(() => { goFloor(step); setDx(0); setThrowing(false); }, THROW_MS);
  }, [throwing, goFloor]);

  const onDown = (e: React.PointerEvent) => {
    if (throwing) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    movedRef.current = false; setDragging(true);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = startRef.current; if (!s) return;
    const d = e.clientX - s.x;
    if (Math.abs(d) > 6) movedRef.current = true;
    setDx(d);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = startRef.current; startRef.current = null; setDragging(false);
    if (!s) return;
    const d = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
    if (!movedRef.current && Math.abs(d) < 8 && Math.abs(dy) < 8 && dt < 400) { setDx(0); setLightbox(floor); return; }
    if (d <= -THRESHOLD) fling(1);
    else if (d >= THRESHOLD) fling(-1);
    else setDx(0);
  };
  const drag = {
    onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp,
    onPointerCancel: () => { startRef.current = null; setDragging(false); setDx(0); },
  };

  const prevFloor = floors[(floor - 1 + N) % N];
  const nextFloor = floors[(floor + 1) % N];
  const transition = throwing || (!dragging && dx === 0);

  return (
    <>
      <div className="gc-show" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div className="gc-viewport">
          {/* desktop peek — previous */}
          <button className="gc-peek gc-peek-prev" aria-label={`Previous: ${prevFloor.name}`} onClick={() => goFloor(-1)}>
            <div className="gc-kb gc-kb-1"><Image src={floorImages(prevFloor.slug).room} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>

          <Stage floor={floors[floor]} shot={shot} kbIndex={floor + shotIdx} dx={dx} transition={transition} onOpen={() => setLightbox(floor)} drag={drag} />

          {/* desktop peek — next */}
          <button className="gc-peek gc-peek-next" aria-label={`Next: ${nextFloor.name}`} onClick={() => goFloor(1)}>
            <div className="gc-kb gc-kb-2"><Image src={floorImages(nextFloor.slug).room} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>
        </div>

        {/* AWS-style control pill */}
        <div className="gc-controls">
          <button className="gc-nav-btn" onClick={() => goFloor(-1)} aria-label="Previous floor">‹</button>
          <button className="gc-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <span className="gc-ic-pause" /> : <span className="gc-ic-play" />}
          </button>
          <span className="gc-counter">{floor + 1} / {N}</span>
          <button className="gc-nav-btn" onClick={() => goFloor(1)} aria-label="Next floor">›</button>
        </div>

        <div className="gc-dots" role="tablist" aria-label="Floors">
          {floors.map((f, i) => (
            <button key={f.slug} role="tab" aria-selected={i === floor} aria-label={f.name}
              className={`gc-dot ${i === floor ? 'is-active' : ''}`} onClick={() => jumpFloor(i)} />
          ))}
        </div>

        <p className="gc-deck-hint">
          {playing ? 'Auto-playing' : 'Paused'} <span className="gc-hint-sep">·</span> swipe or use the arrows <span className="gc-hint-sep">·</span> tap for photos &amp; specs
        </p>

        <div className="gc-cta-row">
          <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
        </div>
      </div>

      {mounted && lightbox !== null && (
        <FloorLightbox index={lightbox} onClose={() => setLightbox(null)} onNav={(d) => setLightbox((i) => (i === null ? i : (i + d + N) % N))} />
      )}
    </>
  );
}

function window_w(): number {
  if (typeof window === 'undefined') return 800;
  return window.innerWidth || 800;
}
