'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BLUR_WARM } from '@/lib/image';
import { machines, machineImages, type Machine } from '../data/machines';

const N = machines.length;
const SHOT_KEYS = ['inuse', 'detail', 'context'] as const;
type ShotKey = (typeof SHOT_KEYS)[number];

const IMAGE_MS = 4000;
const FLOOR_MS = 6000;
const THROW_MS = 340;
const THRESHOLD = 90;
const CARD_SIZES = '(max-width: 767px) 90vw, 640px';
const PEEK_SIZES = '260px';
const LIGHTBOX_SIZES = '(max-width: 900px) 92vw, 640px';

const SHOT_LABEL: Record<ShotKey, string> = { inuse: 'In use', detail: 'The detail', context: 'On the job' };
function shotCaption(m: Machine, s: ShotKey): string {
  if (s === 'inuse') return m.does;
  if (s === 'detail') return 'The working detail, up close';
  return m.stage;
}

/* ─────────────────────────── Lightbox ─────────────────────────── */
function MachineLightbox({ index, onClose, onNav }: { index: number; onClose: () => void; onNav: (d: 1 | -1) => void }) {
  const m = machines[index];
  const imgs = machineImages(m.slug);
  const [shot, setShot] = useState<ShotKey>('inuse');
  useEffect(() => setShot('inuse'), [index]);
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
    <div className="fc-scrim" role="dialog" aria-modal="true" aria-label={`${m.name} — details`} onClick={onClose}>
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fc-close" onClick={onClose} aria-label="Close">×</button>
        <div className="fc-modal-media">
          <div className="fc-modal-stage">
            <div className="fc-kb" key={shot}>
              <Image src={imgs[shot]} alt={`${m.name} — ${SHOT_LABEL[shot]}`} fill sizes={LIGHTBOX_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
            </div>
          </div>
          <div className="fc-thumbs" role="tablist" aria-label="Views of this tool">
            {SHOT_KEYS.map((k) => (
              <button key={k} role="tab" aria-selected={shot === k} className={`fc-thumb ${shot === k ? 'is-active' : ''}`} onClick={() => setShot(k)}>
                <Image src={imgs[k]} alt="" fill sizes="120px" placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} />
                <span className="fc-thumb-label">{SHOT_LABEL[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fc-modal-body">
          <span className="fc-eyebrow">{m.stage}</span>
          <h3 className="fc-modal-title">{m.name}</h3>
          <p className="fc-tagline">{m.tagline}</p>
          <p className="fc-desc">{m.description}</p>
          <dl className="fc-specs">
            <div><dt>Stage</dt><dd>{m.stage}</dd></div>
            <div><dt>What it does</dt><dd>{m.does}</dd></div>
          </dl>
          <a href="#quote" className="fc-cta" onClick={onClose}>Book your free in-home estimate</a>
          <div className="fc-modal-nav">
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
function Stage({ machine, shot, kbIndex, dx, transition, onOpen, drag }: {
  machine: Machine; shot: ShotKey; kbIndex: number; dx: number; transition: boolean;
  onOpen: () => void; drag: React.DOMAttributes<HTMLDivElement>;
}) {
  const imgs = machineImages(machine.slug);
  const rot = dx * 0.04;
  return (
    <div className="fc-stage"
      style={{ transform: `translateX(${dx}px) rotate(${rot}deg)`, transition: transition ? `transform ${THROW_MS}ms cubic-bezier(0.22,1,0.36,1)` : 'none' }}
      role="group" aria-label={`${machine.name}. Tap for photos and details.`} onClick={onOpen} {...drag}>
      <div className={`fc-kb fc-kb-${kbIndex % 4}`} key={`${machine.slug}-${shot}`}>
        <Image src={imgs[shot]} alt={`${machine.name} — ${SHOT_LABEL[shot]}`} fill sizes={CARD_SIZES} priority placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} draggable={false} />
      </div>
      <span className="fc-card-scrim" />
      <span className="fc-shot-badge">{SHOT_LABEL[shot]}</span>
      <span className="fc-card-chip">{machine.stage}</span>
      <span className="fc-tap-hint">Tap for 3 photos + what it does</span>
      <span className="fc-card-cap">
        <span className="fc-card-eyebrow">{machine.stage}</span>
        <span className="fc-card-title">{machine.name}</span>
        <span className="fc-shot-cap" key={shot}>{shotCaption(machine, shot)}</span>
      </span>
      <span className="fc-shot-dots">
        {SHOT_KEYS.map((k) => <span key={k} className={`fc-shot-dot ${k === shot ? 'is-active' : ''}`} />)}
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

  const shot = SHOT_KEYS[shotIdx];
  const active = playing && !hovering && !dragging && lightbox === null && mounted;

  const go = useCallback((step: 1 | -1) => { setIdx((i) => (i + step + N) % N); setShotIdx(0); }, []);
  const jump = useCallback((i: number) => { setIdx(i); setShotIdx(0); }, []);

  useEffect(() => { if (!active) return; const t = window.setInterval(() => setShotIdx((s) => (s + 1) % 3), IMAGE_MS); return () => window.clearInterval(t); }, [active, idx]);
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
      <div className="fc-show" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div className="fc-viewport">
          <button className="fc-peek fc-peek-prev" aria-label={`Previous: ${prev.name}`} onClick={() => go(-1)}>
            <div className="fc-kb fc-kb-1"><Image src={machineImages(prev.slug).inuse} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>
          <Stage machine={machines[idx]} shot={shot} kbIndex={idx + shotIdx} dx={dx} transition={transition} onOpen={() => setLightbox(idx)} drag={drag} />
          <button className="fc-peek fc-peek-next" aria-label={`Next: ${next.name}`} onClick={() => go(1)}>
            <div className="fc-kb fc-kb-2"><Image src={machineImages(next.slug).inuse} alt="" fill sizes={PEEK_SIZES} placeholder="blur" blurDataURL={BLUR_WARM} style={{ objectFit: 'cover' }} /></div>
          </button>
        </div>

        <div className="fc-controls">
          <button className="fc-nav-btn" onClick={() => go(-1)} aria-label="Previous tool">‹</button>
          <button className="fc-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <span className="fc-ic-pause" /> : <span className="fc-ic-play" />}
          </button>
          <span className="fc-counter">{idx + 1} / {N}</span>
          <button className="fc-nav-btn" onClick={() => go(1)} aria-label="Next tool">›</button>
        </div>

        <div className="fc-dots" role="tablist" aria-label="Tools">
          {machines.map((m, i) => (
            <button key={m.slug} role="tab" aria-selected={i === idx} aria-label={m.name}
              className={`fc-dot ${i === idx ? 'is-active' : ''}`} onClick={() => jump(i)} />
          ))}
        </div>

        <p className="fc-deck-hint">
          {playing ? 'Auto-playing' : 'Paused'} <span className="fc-hint-sep">·</span> swipe or use the arrows <span className="fc-hint-sep">·</span> tap to see what each tool does
        </p>

        <div className="fc-cta-row">
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
