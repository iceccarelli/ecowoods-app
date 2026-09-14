'use client';

import { useEffect, useRef, useState } from 'react';
import { createPlateBuffer, renderFloorPlate, type PlateOptions } from '@/lib/floor-studio/plate';
import { loadGrainTexture } from '@/lib/floor-studio/grain-loader';
import type { GrainTexture } from '@/lib/floor-studio/render';
import type { FloorConfiguration } from '@/lib/floor-studio/catalog';

/* ────────────────────────────────────────────────────────────────────────────
   THE PREVIEW ON /design

   What was here: a CSS perspective plane. Three repeating-linear-gradient
   layers over a two-hex ground, laid down with rotateX. It cost nothing on
   first paint and it read as exactly what it was — a diagram of a floor, shown
   to somebody deciding how to spend five figures.

   What is here now is the visualiser's own renderer, running on a canvas, over
   a photograph of the species. Same code path as the camera: same board
   geometry, same catalogue pigment, same photographed tile, same measured mip
   level. The floor a person designs here and the floor they later point their
   camera at cannot disagree, because there is only one of them.

   THREE THINGS THIS HAS TO GET RIGHT, AND HOW

   1. IT MUST NEVER BLOCK. A photographic plate at preview size is about a fifth
      of a second of arithmetic. Spending that in one call means a fifth of a
      second in which the page ignores every click — on a phone, closer to a
      second, which is indistinguishable from broken. So the render is banded:
      a slice of rows per animation frame, inside a time budget, yielding
      between. The floor fills in from the top over two or three frames and the
      page never drops one.

   2. IT MUST SHOW SOMETHING IMMEDIATELY. The drawn floor needs no photograph
      and costs a third as much, so it goes up first, and the photographic pass
      replaces it when the tile has decoded. Nobody watches an empty box.

   3. IT MUST WORK WITHOUT ANY OF THIS. No canvas, no JavaScript, a tile that
      404s, a locked-down network: the CSS plane is still in the markup,
      underneath, and it is what a person gets. The canvas is an upgrade laid
      over a page that was already complete.
   ──────────────────────────────────────────────────────────────────────────── */

type Props = {
  config: FloorConfiguration;
  /** Long description for assistive technology — the floor, in words. */
  label: string;
  /** The CSS fallback plane, rendered underneath and hidden once painted. */
  children: React.ReactNode;
};

/* Above this, the arithmetic stops buying anything a person can see on a
   preview this size, and starts costing frames on a phone. Two is retina; the
   third device pixel on a modern phone is spent on text, not on wood. */
const MAX_DPR = 2;
/* A frame is 16.7ms. Ten leaves room for the browser to do its own work, which
   is what keeps scrolling smooth while the floor is still arriving. */
const FRAME_BUDGET_MS = 10;

export function FloorPlate({ config, label, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  /* The element decides the size, not a prop: the preview is fluid and a fixed
     canvas would be soft on one breakpoint and oversized on another. */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;

    const dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    const w = Math.max(16, Math.round(size.w * dpr));
    const h = Math.max(16, Math.round(size.h * dpr));
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let raf = 0;

    const paint = (grain: GrainTexture | undefined) => {
      const buffer = createPlateBuffer(w, h);
      const image = ctx.createImageData(w, h);
      /* One band tall enough that the first frame already shows the wall and
         the front of the floor, then let the budget decide. */
      let row = 0;
      let band = Math.max(8, Math.round(h / 8));

      const step = () => {
        if (cancelled) return;
        const started = performance.now();
        while (row < h && performance.now() - started < FRAME_BUDGET_MS) {
          const to = Math.min(h, row + band);
          const options: PlateOptions = {
            width: w,
            height: h,
            config,
            grain,
            into: buffer,
            rows: [row, to],
          };
          renderFloorPlate(options);
          row = to;
          /* Adapt: if a band came in well inside the budget the next one can be
             larger, which keeps the number of putImageData calls down without
             ever risking a long frame. */
          const spent = performance.now() - started;
          if (spent < FRAME_BUDGET_MS / 2) band = Math.round(band * 1.6);
        }
        image.data.set(buffer.data);
        ctx.putImageData(image, 0, 0);
        setPainted(true);
        if (row < h) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };

    /* The drawn floor first — it needs nothing and it is on screen in two
       frames — then the photograph over the top of it when it has decoded. */
    paint(undefined);
    loadGrainTexture(config.productId).then((grain) => {
      if (cancelled || !grain) return;
      cancelAnimationFrame(raf);
      paint(grain);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [config, size]);

  return (
    <div className="fc-plate" ref={hostRef} role="img" aria-label={label}>
      {/* The wrapper carries role="img" and the label, so everything inside it
          is decoration as far as assistive technology is concerned — both the
          fallback and the canvas, whichever is currently visible.
          `data-painted` is what CSS reads to hand over. */}
      <div className="fc-plate-fallback" aria-hidden="true" data-painted={painted ? '1' : '0'}>
        {children}
      </div>
      <canvas className="fc-plate-canvas" ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
