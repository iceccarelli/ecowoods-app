'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BLUR_WARM } from '@/lib/image';
import { floors, floorImages, type Floor } from '../data/floors';

const SHOTS = [
  { key: 'room' as const, label: 'In the room' },
  { key: 'detail' as const, label: 'Grain detail' },
  { key: 'lifestyle' as const, label: 'Lived-in' },
];

const CARD_SIZES = '(max-width: 767px) 82vw, (max-width: 1023px) 50vw, 33vw';
const LIGHTBOX_SIZES = '(max-width: 900px) 92vw, 640px';

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

  // reset to the room shot whenever we move to a different product
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
    <div
      className="fc-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`${floor.name} — details`}
      onClick={onClose}
    >
      <div className="fc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="fc-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="fc-modal-media">
          <div className="fc-modal-stage">
            <Image
              key={shot}
              src={imgs[shot]}
              alt={`${floor.name} — ${shot}`}
              fill
              sizes={LIGHTBOX_SIZES}
              placeholder="blur"
              blurDataURL={BLUR_WARM}
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div className="fc-thumbs" role="tablist" aria-label="Views of this floor">
            {SHOTS.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={shot === s.key}
                className={`fc-thumb ${shot === s.key ? 'is-active' : ''}`}
                onClick={() => setShot(s.key)}
              >
                <Image
                  src={imgs[s.key]}
                  alt=""
                  fill
                  sizes="120px"
                  placeholder="blur"
                  blurDataURL={BLUR_WARM}
                  style={{ objectFit: 'cover' }}
                />
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

          <a href="#quote" className="fc-cta" onClick={onClose}>
            Get a fixed-price estimate for this floor
          </a>

          <div className="fc-modal-nav">
            <button onClick={() => onNav(-1)} aria-label="Previous floor">‹ Prev</button>
            <span>{index + 1} / {floors.length}</span>
            <button onClick={() => onNav(1)} aria-label="Next floor">Next ›</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function FloorCatalog() {
  const [open, setOpen] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nav = useCallback(
    (dir: 1 | -1) =>
      setOpen((i) => (i === null ? i : (i + dir + floors.length) % floors.length)),
    [],
  );

  return (
    <>
      <div className="fc-grid">
        {floors.map((f, i) => {
          const imgs = floorImages(f.slug);
          return (
            <button
              key={f.slug}
              className={`fc-card ${f.span} reveal`}
              data-delay={(i % 4) + 1}
              onClick={() => setOpen(i)}
              aria-label={`View ${f.name}`}
            >
              <Image
                src={imgs.room}
                alt={f.name}
                fill
                sizes={CARD_SIZES}
                priority={i === 0}
                placeholder="blur"
                blurDataURL={BLUR_WARM}
                style={{ objectFit: 'cover' }}
              />
              <span className="fc-card-scrim" />
              <span className="fc-card-cap">
                <span className="fc-card-title">{f.name}</span>
                <span className="fc-card-sub">{f.tagline}</span>
              </span>
              <span className="fc-card-chip">Janka {f.janka}</span>
            </button>
          );
        })}
      </div>

      <div className="fc-cta-row">
        <a href="#quote" className="btn btn-copper btn-lg">Book your free in-home estimate</a>
      </div>

      {mounted && open !== null && (
        <FloorLightbox index={open} onClose={() => setOpen(null)} onNav={nav} />
      )}
    </>
  );
}
