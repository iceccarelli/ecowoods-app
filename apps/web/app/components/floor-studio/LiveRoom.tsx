'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EW_MARK } from '@/lib/brand';
import { SITE_URL } from '@/lib/seo-data';
import { track } from '@/lib/analytics';
import { describeConfiguration, type FloorConfiguration } from '@/lib/floor-studio/catalog';
import { compositeFloor } from '@/lib/floor-studio/render';
import {
  CAMERA_MESSAGES,
  advanceLive,
  cameraAvailable,
  classifyCameraError,
  liveCaption,
  openingQuad,
  startingLadder,
  stepLadder,
  type Ladder,
} from '@/lib/floor-studio/live';
import type { Pixels, Quad } from '@/lib/floor-studio/room';

/**
 * LiveRoom — point the camera at the floor and watch it change.
 *
 * WHAT IS ACTUALLY HAPPENING, BECAUSE THE WORD "AI" GETS USED LOOSELY HERE
 *
 * Every frame: the camera image is drawn into a small canvas, the floor plane
 * is found in it, a mask decides which of those pixels are floor rather than
 * furniture, and a floor FROM THE ECOWOODS CATALOGUE is drawn into them through
 * an exact projective map, keeping the room's own light. Thirty times a second.
 *
 * Nothing is generated. There is no diffusion model, no style transfer, no
 * invented floor — and that is a deliberate product decision written down in
 * render.ts: a beautiful floor that exists nowhere cannot be bought, and a
 * homeowner who falls in love with one has been defrauded with a nice colour
 * palette. What this shows is every floor this company can actually lay, in the
 * room the visitor is standing in, at the price on /pricing.
 *
 * NOTHING LEAVES THE DEVICE
 *
 * There is no upload in this component and no endpoint for one. The MediaStream
 * is attached to a <video> that never leaves the page, every frame is read into
 * an ImageData and discarded, and the stream's tracks are stopped the moment
 * the view closes or the tab is hidden. A visitor can verify all of it from the
 * network panel: pointing a camera at their living room produces zero requests.
 *
 * THE FRAME BUDGET IS A LADDER, NOT A CONSTANT
 *
 * A flagship phone and a five-year-old tablet are a factor of five apart. The
 * analysis size climbs and falls with what the device is actually managing —
 * see lib/floor-studio/live.ts, where the rule lives as a pure function with
 * its own tests, because a frame loop cannot be tested and a number can.
 */

export type LiveRoomProps = {
  config: FloorConfiguration;
  squareFeet: number;
  boardScale: number;
  priceLine: string;
  /** Freeze this frame and continue in the still-photo flow. */
  onCapture: (pixels: Pixels, quad: Quad) => void;
  onClose: () => void;
};

export default function LiveRoom({
  config,
  squareFeet,
  boardScale,
  priceLine,
  onCapture,
  onClose,
}: LiveRoomProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const markRef = useRef<HTMLImageElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const quadRef = useRef<Quad | null>(null);
  const ladderRef = useRef<Ladder>(startingLadder());
  const runRef = useRef({ slow: 0, fast: 0 });
  const lastRef = useRef<{ pixels: Pixels; quad: Quad } | null>(null);

  /* The loop must see the newest configuration without being torn down and
     rebuilt every time somebody taps a swatch — that would restart the camera
     on every change. A ref is read inside the loop; state is for the UI. */
  const liveRef = useRef({ config, squareFeet, boardScale });
  liveRef.current = { config, squareFeet, boardScale };

  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('Starting the camera…');
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!cameraAvailable()) {
      setError(CAMERA_MESSAGES.unsupported);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      await video.play();
      setRunning(true);
      track('studio_live_opened');
    } catch (err) {
      setError(CAMERA_MESSAGES[classifyCameraError(err)]);
      track('studio_live_blocked', { reason: classifyCameraError(err) });
    }
  }, []);

  /* Open on mount; close on unmount, and whenever the tab goes away — a camera
     light that stays on after someone switches apps is the thing that makes a
     person uninstall a product. */
  useEffect(() => {
    void start();
    const onHide = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      stop();
    };
  }, [start, stop]);

  useEffect(() => {
    if (!running) return;
    let frames = 0;
    let since = performance.now();
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const work = workRef.current;
      const view = viewRef.current;
      if (!video || !work || !view || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const t0 = performance.now();
      const w = ladderRef.current.width;
      const h = Math.max(2, Math.round((w * video.videoHeight) / (video.videoWidth || 1)));
      if (work.width !== w || work.height !== h) {
        work.width = w;
        work.height = h;
      }

      const wctx = work.getContext('2d', { willReadFrequently: true });
      if (!wctx) return;
      wctx.drawImage(video, 0, 0, w, h);
      const frame = wctx.getImageData(0, 0, w, h);
      const pixels: Pixels = { data: frame.data, width: w, height: h };

      const reading = advanceLive(quadRef.current, pixels);
      quadRef.current = reading.quad;

      const { config: cfg, squareFeet: sqft, boardScale: scale } = liveRef.current;
      const result = compositeFloor(pixels, reading.quad, cfg, { squareFeet: sqft, boardScale: scale });
      wctx.putImageData(new ImageData(result.pixels.data, w, h), 0, 0);
      lastRef.current = { pixels, quad: reading.quad };

      /* Present. The view canvas is sized to the element, so the small
         analysis frame is scaled up once by the GPU rather than composited at
         display resolution on the CPU. */
      if (view.width !== view.clientWidth * 2 || view.height !== view.clientHeight * 2) {
        view.width = Math.max(2, view.clientWidth * 2);
        view.height = Math.max(2, view.clientHeight * 2);
      }
      const vctx = view.getContext('2d');
      if (vctx) {
        vctx.imageSmoothingQuality = 'high';
        vctx.drawImage(work, 0, 0, view.width, view.height);
        drawChrome(vctx, view.width, view.height, markRef.current, describeConfiguration(cfg), priceLine);
      }

      const dt = performance.now() - t0;
      const next = stepLadder(ladderRef.current, dt, runRef.current);
      ladderRef.current = next.ladder;
      runRef.current = next.run;

      frames += 1;
      if (t0 - since > 500) {
        setFps(Math.round((frames * 1000) / (t0 - since)));
        setCaption(liveCaption(reading, result.painted));
        frames = 0;
        since = t0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, priceLine]);

  const capture = useCallback(() => {
    const last = lastRef.current;
    if (!last) return;
    track('studio_live_captured', { config: `${config.productId}|${config.finishId}|${config.patternId}|${config.widthId}` });
    stop();
    /* Hand over a COPY: the loop reuses its ImageData buffer. */
    onCapture(
      { data: new Uint8ClampedArray(last.pixels.data), width: last.pixels.width, height: last.pixels.height },
      last.quad,
    );
  }, [config, onCapture, stop]);

  return (
    <div className="fs-live">
      {/* Never rendered, never uploaded — the frame source and nothing else. */}
      <video ref={videoRef} className="fs-live-source" muted playsInline aria-hidden="true" />
      <canvas ref={workRef} className="fs-live-work" aria-hidden="true" />
      {/* The mark is composited into the canvas, so it survives a screenshot
          and a saved frame. It is a real <img> at a real URL (see lib/brand)
          rather than a data URI, which is why it can be drawn at all. */}
      <img ref={markRef} src={EW_MARK} alt="" width={192} height={192} className="fs-live-mark" aria-hidden="true" />

      {error ? (
        <div className="fs-live-error" role="alert">
          <p>{error}</p>
          <div className="fs-live-actions">
            <button type="button" className="btn btn-copper" onClick={() => void start()}>
              Try the camera again
            </button>
            <button type="button" className="fs-link-btn" onClick={onClose}>
              Use a photo instead
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="fs-live-stage">
            <canvas
              ref={viewRef}
              className="fs-live-view"
              role="img"
              aria-label={`Live view of your room with ${describeConfiguration(config)}`}
            />
            <p className="fs-live-caption" role="status" aria-live="polite">
              {caption}
            </p>
          </div>
          <div className="fs-live-actions">
            <button type="button" className="btn btn-copper btn-lg" onClick={capture}>
              Freeze this view
            </button>
            <button type="button" className="fs-link-btn" onClick={onClose}>
              Close the camera
            </button>
            <span className="fs-live-meta">
              {fps > 0 ? `${fps} fps · ` : ''}nothing is uploaded
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/**
 * The mark, the floor and the range, drawn INTO the frame.
 *
 * A screenshot of a live camera view is the single most shared artefact this
 * feature will produce, and a screenshot carries no DOM. If the mark and the
 * configuration live in HTML around the canvas, every one of those screenshots
 * is an anonymous picture of somebody's living room. Drawn into the pixels they
 * travel with it — to a partner, a group chat, a contractor.
 */
function drawChrome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mark: HTMLImageElement | null,
  floor: string,
  price: string,
): void {
  const pad = Math.round(w * 0.028);
  const size = Math.round(w * 0.062);
  const fontL = Math.round(w * 0.028);
  const fontS = Math.round(w * 0.021);

  ctx.save();
  /* A readable plate under the type, because a camera frame can be any colour
     and white text on a white wall is not a design. */
  const plateH = size + pad;
  const grad = ctx.createLinearGradient(0, h - plateH * 1.6, 0, h);
  grad.addColorStop(0, 'rgba(24, 18, 12, 0)');
  grad.addColorStop(1, 'rgba(24, 18, 12, 0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - plateH * 1.6, w, plateH * 1.6);

  if (mark?.complete && mark.naturalWidth > 0) {
    ctx.drawImage(mark, pad, h - pad - size, size, size);
  }

  ctx.fillStyle = 'rgba(255, 252, 245, 0.96)';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${fontL}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillText(floor, pad + size + pad * 0.6, h - pad - size * 0.52);
  ctx.font = `400 ${fontS}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255, 252, 245, 0.82)';
  ctx.fillText(`${price} · estimated installed, not a quote`, pad + size + pad * 0.6, h - pad - size * 0.08);

  ctx.textAlign = 'right';
  ctx.font = `600 ${fontS}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.fillStyle = 'rgba(255, 252, 245, 0.7)';
  /* The host, from the one place the site's URL is defined — never a typed
     string, which is how a wordmark ends up saying a domain nobody owns. */
  ctx.fillText(SITE_HOST, w - pad, h - pad - size * 0.3);
  ctx.restore();
}
