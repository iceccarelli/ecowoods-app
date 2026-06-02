'use client';
import { useEffect, useMemo, useState } from 'react';

type Bg = { url: string; alt: string; credit: string; creditUrl: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RotatingBackground() {
  const [pool, setPool] = useState<Bg[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/backgrounds')
      .then((r) => r.json())
      .then((d) => { if (alive && d.images?.length) setPool(d.images); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const images = useMemo(() => shuffle(pool), [pool]);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 9000);
    return () => clearInterval(t);
  }, [images.length]);

  if (images.length === 0) return null;

  const current = images[idx];

  return (
    <>
      <style>{`
        @keyframes kenburns {
          0%   { transform: scale(1.05) translate(0, 0); }
          100% { transform: scale(1.16) translate(-1.5%, -1.5%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kb-layer { animation: none !important; transform: scale(1.05) !important; }
        }
      `}</style>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
        {images.map((img, i) => (
          <div
            key={img.url}
            className="kb-layer"
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${img.url})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: i === idx ? 1 : 0,
              transition: 'opacity 1.8s ease-in-out',
              animation: i === idx ? 'kenburns 10s ease-out forwards' : 'none',
            }}
          />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(115deg, rgba(26,15,8,0.92) 0%, rgba(26,15,8,0.6) 45%, rgba(26,15,8,0.85) 100%)',
        }} />
      </div>

      {current && (
        <a
          href={`${current.creditUrl}?utm_source=ecowoods&utm_medium=referral`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute', bottom: 10, right: 14, zIndex: 3,
            fontSize: 11, color: 'rgba(255,255,255,0.65)', textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Photo: {current.credit} / Unsplash
        </a>
      )}
    </>
  );
}
