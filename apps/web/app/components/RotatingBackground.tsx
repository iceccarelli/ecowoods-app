'use client';
import { useEffect, useMemo, useState } from 'react';

type Bg = { url: string; alt: string; credit: string; creditUrl: string };
type Props = { theme?: 'hero' | 'craft' | 'homes' | 'finish'; interval?: number; scrim?: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function RotatingBackground({
  theme = 'hero',
  interval = 7000,
  scrim = 'linear-gradient(115deg, rgba(26,15,8,0.55) 0%, rgba(26,15,8,0.25) 45%, rgba(26,15,8,0.6) 100%)',
}: Props) {
  const [pool, setPool] = useState<Bg[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/backgrounds?theme=${theme}`).then((r) => r.json())
      .then((d) => { if (alive && d.images?.length) setPool(d.images); }).catch(() => {});
    return () => { alive = false; };
  }, [theme]);

  const images = useMemo(() => shuffle(pool), [pool]);

  useEffect(() => { images.forEach((img) => { const p = new Image(); p.src = img.url; }); }, [images]);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), interval);
    return () => clearInterval(t);
  }, [images.length, interval]);

  if (images.length === 0) return null;
  const current = images[idx];

  return (
    <>
      <style>{`
        @keyframes kb-pan { from { transform: scale(1.08); } to { transform: scale(1.18); } }
        .rb-layer { position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat; opacity: 0; transition: opacity 2.4s cubic-bezier(0.4,0,0.2,1); will-change: opacity, transform; }
        .rb-layer.is-active { opacity: 1; animation: kb-pan 9s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .rb-layer { transition: opacity 0.6s ease; } .rb-layer.is-active { animation: none; transform: scale(1.08); } }
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        {images.map((img, i) => (
          <div key={img.url} className={`rb-layer${i === idx ? ' is-active' : ''}`} style={{ backgroundImage: `url(${img.url})` }} />
        ))}
        <div style={{ position: 'absolute', inset: 0, background: scrim }} />
      </div>
      {current && (
        <a href={`${current.creditUrl}?utm_source=ecowoods&utm_medium=referral`} target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', bottom: 10, right: 14, zIndex: 3, fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', letterSpacing: '0.02em' }}>
          Photo: {current.credit} / Unsplash
        </a>
      )}
    </>
  );
}
