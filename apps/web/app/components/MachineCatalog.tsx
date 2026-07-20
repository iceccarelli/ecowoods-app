'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BLUR_WARM } from '@/lib/image';
import { machines, machineImages, type Machine } from '../data/machines';
import { SHOT_TYPE, type ShotType } from '../data/machine-images';

const N = machines.length;
const SHOTS = 6; // 6 photos per machine (set 1 = 01-03, set 2 = 04-06)
const IMAGE_MS = 3500;
const FLOOR_MS = 6000;
const THROW_MS = 340;
const THRESHOLD = 90;
const CARD_SIZES = '(max-width: 767px) 90vw, 640px';
const PEEK_SIZES = '260px';
const LIGHTBOX_SIZES = '(max-width: 900px) 92vw, 640px';

const SHOT_LABEL: Record<ShotType, string> = { inuse: 'In use', detail: 'The detail', context: 'On the job' };
function shotCaption(m: Machine, t: ShotType): string {
  if (t === 'inuse') return m.does;
  if (t === 'detail') return 'The working detail, up close';
  return m.stage;
}

/* ─────────────────────────── Lightbox ─────────────────────────── */
function MachineLightbox({ index, onClose, onNav }: { index: number; onClose: () => void; onNav: (d: 1 | -1) => void }) {
  const m = machines[index];
  const imgs = machineImages(m.slug);
  const [shot, setShot] = useState(0);
  useEffect(() => setShot(0), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onNav(1);
      else if (e.key === 'ArrowLeft') onNav(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, onNav]);

  return createPortal(
    <div className="gc-scrim" role="dialog" aria-modal="true" aria-label={`${m.name} — details`} onClick={onClose}>
      <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gc-close" onClick={onClose} aria-label="Close">×</button>
        <div className="gc-modal-media">
          <div className="gc-modal-stage">
            <div className="gc-kb" key={shot}>
              <Image src={imgs[shot]} alt={`${m.name} — ${SHOT_LABEL[SHOT_TYPE[shot]]}`} fill sizes={LIGHTBOX_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
            </div>
          </div>
          <div className="gc-thumbs" role="tablist" aria-label="Photos of this tool">
            {imgs.map((im, i) => (
              <button key={i} role="tab" aria-selected={shot === i} className={`gc-thumb ${shot === i ? 'is-active' : ''}`} onClick={() => setShot(i)}>
                <Image src={im} alt="" fill sizes="120px" placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
                <span className="gc-thumb-label">{SHOT_LABEL[SHOT_TYPE[i]]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="gc-modal-body">
          <span className="gc-eyebrow">{m.stage}</span>
          <h3 className="gc-modal-title">{m.name}</h3>
          <p className="gc-tagline">{m.tagline}</p>
          <p className="gc-desc">{m.description}</p>
          <dl className="gc-specs">
            <div><dt>Stage</dt><dd>{m.stage}</dd></div>
            <div><dt>What it does</dt><dd>{m.does}</dd></div>
          </dl>
          <a href="#quote" className="gc-cta" onClick={onClose}>Book your free in-home estimate</a>
          <div className="gc-modal-nav">
            <button onClick={() => onNav(-1)} aria-label="Previous tool">‹ Prev</button>
            <span>{index + 1} / {N}</span>
            <button onClick={() => onNav(1)} aria-label="Next tool">Next ›</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────── Stage (shared desktop + mobile) ───────────── */
function Stage({ machine, shotIdx, kbIndex, dx, transition, onOpen, drag }: {
  machine: Machine; shotIdx: number; kbIndex: number; dx: number; transition: boolean;
  onOpen: () => void; drag: React.DOMAttributes<HTMLDivElement>;
}) {
  const imgs = machineImages(machine.slug);
  const type = SHOT_TYPE[shotIdx];
  const rot = dx * 0.04;
  return (
    <div className="gc-stage"
      style={{ transform: `translateX(${dx}px) rotate(${rot}deg)`, transition: transition ? `transform ${THROW_MS}ms cubic-bezier(0.22,1,0.36,1)` : 'none' }}
      role="group" aria-label={`${machine.name}. Tap for photos and details.`} onClick={onOpen} {...drag}>
      <div className={`gc-kb gc-kb-${kbIndex % 4}`} key={`${machine.slug}-${shotIdx}`}>
        <Image src={imgs[shotIdx]} alt={`${machine.name} — ${SHOT_LABEL[type]}`} fill sizes={CARD_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} draggable={false} />
      </div>
      <span className="gc-card-scrim" />
      <span className="gc-shot-badge">{SHOT_LABEL[type]}</span>
      <span className="gc-card-chip">{machine.stage}</span>
      <span className="gc-tap-hint">Tap for 6 photos + what it does</span>
      <span className="gc-card-cap">
        <span className="gc-card-eyebrow">{machine.stage}</span>
        <span className="gc-card-title">{machine.name}</span>
        <span className="gc-shot-cap" key={shotIdx}>{shotCaption(machine, type)}</span>
      </span>
      <span className="gc-shot-dots">
        {Array.from({ length: SHOTS }).map((_, i) => <span key={i} className={`gc-shot-dot ${i === shotIdx ? 'is-active' : ''}`} />)}
      </span>
    </div>
  );
}

/* ───────────────────────────── Show ────────────────────────────── */
export default function MachineCatalog() {
  const [idx, setIdx] = useState(0);
  const [shotIdx, setShotIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [dx, setDx] = useState(0);
  const [throwing, setThrowing] = useState(false);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const active = playing && !hovering && !dragging && lightbox === null && mounted;

  const go = useCallback((step: 1 | -1) => { setIdx((i) => (i + step + N) % N); setShotIdx(0); }, []);
  const jump = useCallback((i: number) => { setIdx(i); setShotIdx(0); }, []);

  useEffect(() => { if (!active) return; const t = window.setInterval(() => setShotIdx((s) => (s + 1) % SHOTS), IMAGE_MS); return () => window.clearInterval(t); }, [active, idx]);
  useEffect(() => { if (!active) return; const t = window.setInterval(() => { setIdx((i) => (i + 1) % N); setShotIdx(0); }, FLOOR_MS); return () => window.clearInterval(t); }, [active]);

  useEffect(() => {
    if (lightbox !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, go]);

  const fling = useCallback((step: 1 | -1) => {
    if (throwing) return; setThrowing(true); setDx(step === 1 ? -window_w() * 1.2 : window_w() * 1.2);
    window.setTimeout(() => { go(step); setDx(0); setThrowing(false); }, THROW_MS);
  }, [throwing, go]);

  const onDown = (e: React.PointerEvent) => { if (throwing) return; startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; movedRef.current = false; setDragging(true); (e.currentTarget as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const s = startRef.current; if (!s) return; const d = e.clientX - s.x; if (Math.abs(d) > 6) movedRef.current = true; setDx(d); };
  const onUp = (e: React.PointerEvent) => {
    const s = startRef.current; startRef.current = null; setDragging(false); if (!s) return;
    const d = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
    if (!movedRef.current && Math.abs(d) < 8 && Math.abs(dy) < 8 && dt < 400) { setDx(0); setLightbox(idx); return; }
    if (d <= -THRESHOLD) fling(1); else if (d >= THRESHOLD) fling(-1); else setDx(0);
  };
  const drag = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: () => { startRef.current = null; setDragging(false); setDx(0); } };

  const prev = machines[(idx - 1 + N) % N];
  const next = machines[(idx + 1) % N];
  const transition = throwing || (!dragging && dx === 0);

  return (
    <>
      <div className="gc-show" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div className="gc-viewport">
          <button className="gc-peek gc-peek-prev" aria-label={`Previous: ${prev.name}`} onClick={() => go(-1)}>
            <div className="gc-kb gc-kb-1"><Image src={machineImages(prev.slug)[0]} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>
          <Stage machine={machines[idx]} shotIdx={shotIdx} kbIndex={idx + shotIdx} dx={dx} transition={transition} onOpen={() => setLightbox(idx)} drag={drag} />
          <button className="gc-peek gc-peek-next" aria-label={`Next: ${next.name}`} onClick={() => go(1)}>
            <div className="gc-kb gc-kb-2"><Image src={machineImages(next.slug)[0]} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>
        </div>

        <div className="gc-controls">
          <button className="gc-nav-btn" onClick={() => go(-1)} aria-label="Previous tool">‹</button>
          <button className="gc-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <span className="gc-ic-pause" /> : <span className="gc-ic-play" />}
          </button>
          <span className="gc-counter">{idx + 1} / {N}</span>
          <button className="gc-nav-btn" onClick={() => go(1)} aria-label="Next tool">›</button>
        </div>

        <div className="gc-dots" role="tablist" aria-label="Tools">
          {machines.map((m, i) => (
            <button key={m.slug} role="tab" aria-selected={i === idx} aria-label={m.name}
              className={`gc-dot ${i === idx ? 'is-active' : ''}`} onClick={() => jump(i)} />
          ))}
        </div>

        <p className="gc-deck-hint">
          {playing ? 'Auto-playing' : 'Paused'} <span className="gc-hint-sep">·</span> 6 photos per tool <span className="gc-hint-sep">·</span> swipe, use arrows, or tap to explore
        </p>

        <div className="gc-cta-row">
          <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
        </div>
      </div>

      {mounted && lightbox !== null && (
        <MachineLightbox index={lightbox} onClose={() => setLightbox(null)} onNav={(d) => setLightbox((i) => (i === null ? i : (i + d + N) % N))} />
      )}
    </>
  );
}

function window_w(): number { if (typeof window === 'undefined') return 800; return window.innerWidth || 800; }
