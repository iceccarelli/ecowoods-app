'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BLUR_WARM } from '@/lib/image';
import { floors, floorImages, type Floor } from '../data/floors';

const N = floors.length;
const SHOTS = [
  { key: 'room' as const, label: 'In the room' },
  { key: 'detail' as const, label: 'Grain detail' },
  { key: 'lifestyle' as const, label: 'Lived-in' },
];
const CARD_SIZES = '(max-width: 767px) 90vw, 660px';
const LIGHTBOX_SIZES = '(max-width: 900px) 92vw, 640px';
const THROW_MS = 340;
const THRESHOLD = 96; // px of horizontal drag to commit a throw

/* ─────────────────────────── Lightbox ─────────────────────────── */
function FloorLightbox({
  index,
  onClose,
  onNav,
}: {
  index: number;
  onClose: () => void;
  onNav: (dir: 1 | -1) => void;
}) {
  const floor: Floor = floors[index];
  const imgs = floorImages(floor.slug);
  const [shot, setShot] = useState<'room' | 'detail' | 'lifestyle'>('room');
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
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onNav]);

  return createPortal(
    <div className="fc-scrim" role="dialog" aria-modal="true" aria-label={`${floor.name} — details`} onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fc-close" onClick={onClose} aria-label="Close">×</button>
        <div className="fc-modal-media">
          <div className="fc-modal-stage">
            <Image key={shot} src={imgs[shot]} alt={`${floor.name} — ${shot}`} fill sizes={LIGHTBOX_SIZES}
              placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
          </div>
          <div className="fc-thumbs" role="tablist" aria-label="Views of this floor">
            {SHOTS.map((s) => (
              <button key={s.key} role="tab" aria-selected={shot === s.key}
                className={`fc-thumb ${shot === s.key ? 'is-active' : ''}`} onClick={() => setShot(s.key)}>
                <Image src={imgs[s.key]} alt="" fill sizes="120px" placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
                <span className="fc-thumb-label">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fc-modal-body">
          <span className="fc-eyebrow">{floor.species} · {floor.format}</span>
          <h3 className="fc-modal-title">{floor.name}</h3>
          <p className="fc-tagline">{floor.tagline}</p>
          <p className="fc-desc">{floor.description}</p>
          <dl className="fc-specs">
            <div><dt>Hardness</dt><dd>Janka {floor.janka}</dd></div>
            <div><dt>Origin</dt><dd>{floor.origin}</dd></div>
            <div><dt>Finish</dt><dd>{floor.finish}</dd></div>
            <div><dt>Best for</dt><dd>{floor.bestFor}</dd></div>
          </dl>
          <a href="#quote" className="fc-cta" onClick={onClose}>Get a fixed-price estimate for this floor</a>
          <div className="fc-modal-nav">
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

/* ─────────────────────── Single deck card face ─────────────────── */
function CardFace({ floor, priority = false }: { floor: Floor; priority?: boolean }) {
  return (
    <>
      <Image src={floorImages(floor.slug).room} alt={floor.name} fill sizes={CARD_SIZES}
        priority={priority} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} draggable={false} />
      <span className="fc-card-scrim" />
      <span className="fc-card-cap">
        <span className="fc-card-eyebrow">{floor.species} · {floor.format}</span>
        <span className="fc-card-title">{floor.name}</span>
        <span className="fc-card-sub">{floor.tagline}</span>
      </span>
      <span className="fc-card-chip">Janka {floor.janka}</span>
    </>
  );
}

/* ───────────────────────────── Deck ────────────────────────────── */
export default function FloorCatalog() {
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // drag / throw state for the top card
  const [dx, setDx] = useState(0);
  const [throwing, setThrowing] = useState<0 | 1 | -1>(0); // 0 idle · 1 exit-left(next) · -1 exit-right(prev)
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const movedRef = useRef(false);

  const advance = useCallback((step: 1 | -1) => setCurrent((i) => (i + step + N) % N), []);

  // step: +1 next / -1 prev.  Exit direction: next flies left, prev flies right.
  const fling = useCallback((step: 1 | -1) => {
    if (throwing) return;
    setThrowing(step === 1 ? 1 : -1);
    setDx(0);
    window.setTimeout(() => {
      advance(step);
      setThrowing(0);
    }, THROW_MS);
  }, [throwing, advance]);

  // keyboard nav (only when lightbox closed)
  useEffect(() => {
    if (lightbox !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') fling(1);
      else if (e.key === 'ArrowLeft') fling(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, fling]);

  const onDown = (e: React.PointerEvent) => {
    if (throwing) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    movedRef.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const d = e.clientX - s.x;
    if (Math.abs(d) > 6) movedRef.current = true;
    setDx(d);
  };
  const onUp = (e: React.PointerEvent) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s) return;
    const d = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const dt = Date.now() - s.t;
    // treat as a tap → open the lightbox
    if (!movedRef.current && Math.abs(d) < 8 && Math.abs(dy) < 8 && dt < 400) {
      setDx(0);
      setLightbox(current);
      return;
    }
    if (d <= -THRESHOLD) fling(1);
    else if (d >= THRESHOLD) fling(-1);
    else setDx(0); // snap back
  };

  // transform for the top (motion) card
  const rot = throwing ? throwing * -14 : dx * 0.05;
  const tx = throwing ? throwing * -window_w() * 1.25 : dx;
  const motionStyle: React.CSSProperties = {
    transform: `translateX(${tx}px) rotate(${rot}deg)`,
    transition: throwing || startRef.current === null ? `transform ${throwing ? THROW_MS : 260}ms cubic-bezier(0.22,1,0.36,1)` : 'none',
    opacity: throwing ? 0 : 1,
  };
  // while actively dragging we want no transition (follow finger)
  if (movedRef.current && startRef.current) motionStyle.transition = 'none';

  const peek1 = floors[(current + 1) % N];
  const peek2 = floors[(current + 2) % N];
  const top = floors[current];

  const dragHint = dx <= -40 ? 'next' : dx >= 40 ? 'prev' : '';

  return (
    <>
      <div className="fc-deck">
        <div className="fc-stack" aria-roledescription="carousel">
          {/* depth layers */}
          <div className="fc-card fc-peek fc-peek-2" aria-hidden><CardFace floor={peek2} /></div>
          <div className="fc-card fc-peek fc-peek-1" aria-hidden><CardFace floor={peek1} /></div>
          {/* live, draggable top card */}
          <div
            key={current}
            className={`fc-card fc-motion ${dragHint ? `hint-${dragHint}` : ''}`}
            style={motionStyle}
            role="group"
            aria-label={`${top.name} — floor ${current + 1} of ${N}. Drag or use arrow keys to browse, tap to view photos.`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { startRef.current = null; setDx(0); }}
          >
            <CardFace floor={top} priority />
            <span className="fc-swipe-tag fc-tag-next">Next →</span>
            <span className="fc-swipe-tag fc-tag-prev">← Back</span>
            <span className="fc-tap-hint">Tap for 3 photos + details</span>
          </div>
        </div>

        <div className="fc-controls">
          <button className="fc-nav-btn" onClick={() => fling(-1)} aria-label="Previous floor">‹</button>
          <div className="fc-dots" role="tablist" aria-label="Floors">
            {floors.map((f, i) => (
              <button key={f.slug} role="tab" aria-selected={i === current} aria-label={f.name}
                className={`fc-dot ${i === current ? 'is-active' : ''}`}
                onClick={() => { if (!throwing) setCurrent(i); }} />
            ))}
          </div>
          <button className="fc-nav-btn" onClick={() => fling(1)} aria-label="Next floor">›</button>
        </div>

        <p className="fc-deck-hint">
          <span className="fc-counter">{current + 1} / {N}</span>
          <span className="fc-hint-sep">·</span>
          Swipe the card, use the arrows, or tap for photos &amp; specs
        </p>

        <div className="fc-cta-row">
          <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
        </div>
      </div>

      {mounted && lightbox !== null && (
        <FloorLightbox
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={(dir) => setLightbox((i) => (i === null ? i : (i + dir + N) % N))}
        />
      )}
    </>
  );
}

// SSR-safe viewport width for the throw distance
function window_w(): number {
  if (typeof window === 'undefined') return 800;
  return window.innerWidth || 800;
}
