'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Link from 'next/link';
import { FINISH_OPTIONS, PATTERN_OPTIONS } from '@ecowoods/shared/ai';
import { NEW_INSTALL, US_NEW_INSTALL, formatBand } from '@/content/constants/pricing';
import { publishedStudioProducts } from '@/content/constants/studio-products';
import { track } from '@/lib/analytics';
import {
  BOARD_WIDTHS,
  FLOOR_PRODUCTS,
  configurationId,
  describeConfiguration,
  incompatibilities,
  movementFor,
  parseConfigurationId,
  priceConfiguration,
  widthById,
  withAxis,
  type FloorConfiguration,
} from '@/lib/floor-studio/catalog';
import { FEELS, ROOM_TYPES, matchFloors, type Match } from '@/lib/floor-studio/match';
import { compositeFloor } from '@/lib/floor-studio/render';
import { decodePhoto, paintPixels, pixelsToDataUrl } from '@/lib/floor-studio/render-canvas';
import { drawSignature, loadMark } from '@/lib/floor-studio/signature';
import { EW_MARK } from '@/lib/brand';
import { cameraAvailable } from '@/lib/floor-studio/live';
import LiveRoom from './LiveRoom';
import {
  UNMEASURABLE_FROM_A_PHOTO,
  analyseRoom,
  type Pixels,
  type Quad,
  type RoomReading,
} from '@/lib/floor-studio/room';
import {
  SQFT_MAX,
  SQFT_MIN,
  decodeStudioDesign,
  describeStudioDesign,
  designHref,
  STUDIO_COUNTRIES,
  countryOf,
  emptyStudioDesign,
  encodeStudioDesign,
  estimateHref,
  roomFactsFrom,
  saveStudioDesign,
  studioHref,
  studioRef,
  type StudioDesign,
} from '@/lib/floor-studio/studio-config';

/**
 * ECOWOODS FLOOR STUDIO — the client experience.
 *
 * Everything that decides an answer lives in lib/floor-studio, where it is pure
 * and tested. This file is the sequence a person moves through, and its job is
 * to be so uneventful that they never think about it:
 *
 *   photo → what we measured (and what you fix) → how you want it to feel →
 *   three real floors in your room → change anything → the range → the exit
 *
 * FOUR RULES IT OBEYS
 *
 * 1. THE PHOTOGRAPH NEVER LEAVES THE DEVICE. Decoding, analysis, masking and
 *    compositing all happen here. There is no upload in this component and no
 *    endpoint for one. A share link carries the floor, never the room. The live
 *    camera (LIVE-01) is held to exactly the same rule: the MediaStream is
 *    attached to a <video> that never leaves the page, every frame is read into
 *    an ImageData and dropped, and the tracks are stopped when the view closes
 *    or the tab is hidden. Pointing a camera at a living room makes zero
 *    network requests, and that is checkable from the network panel.
 *
 * 2. THE CORRECTION IS A FIRST-CLASS CONTROL, NOT AN ERROR PATH. The four
 *    corners are draggable AND keyboard-operable from the moment the analysis
 *    finishes, whether or not it went well, because the person looking at the
 *    screen can see their own floor and we cannot.
 *
 * 3. NOTHING SAYS QUOTE. The figure is an estimated installed range, labelled,
 *    every time, next to the sentence about the measure. The published band it
 *    comes from is linked rather than retyped.
 *
 * 4. A CONTROL THAT CANNOT BE CHOSEN SAYS WHY. Fuming needs tannin; herringbone
 *    is cut as blocks. A disabled button with no explanation teaches a visitor
 *    that the product is broken.
 */

type Stage = 'start' | 'live' | 'analysing' | 'verify' | 'feel' | 'studio';

const ANALYSING_STEPS = [
  'Reading your photo…',
  'Measuring the light in the room…',
  'Finding where the floor meets the walls…',
  'Matching against floors we can actually lay…',
];

const MAX_COMPARE = 5;

/**
 * MONEY FOLLOWS THE BAND (GEO-006).
 *
 * This was `Intl.NumberFormat('en-CA', { currency: 'CAD' })`, hard-coded, and
 * it was the last place on this site that assumed a visitor's country. GEO-004
 * established the rule — a New York surface shows no Canadian figure — and
 * verify-geo holds it on every page that names a market. The studio names none,
 * so the rule never reached it, while the header and footer link it from all 26
 * New York markets.
 *
 * EstimateResult has carried `currency` from the band it was given since
 * GEO-005, so nothing here has to know a country: it reads the currency the
 * arithmetic actually used. The locale follows it too, because a US visitor
 * reading "US$" is being told the same thing twice, and en-US simply writes $.
 */
const money = (n: number, currency: string) =>
  new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-CA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);

/** A neutral plan-view ground for "start with a floor", with a little falloff
    so the boards are lit rather than flat. Not a room, and not pretending. */
function swatchGround(width: number, height: number): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const fall = 1 - 0.28 * Math.hypot((x / width - 0.5) * 1.1, (y / height - 0.5) * 1.4);
      const v = Math.round(168 * fall);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const CORNER_LABELS = ['Far left corner', 'Far right corner', 'Near right corner', 'Near left corner'];

export default function FloorStudio() {
  const [stage, setStage] = useState<Stage>('start');
  const [analysingStep, setAnalysingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<Pixels | null>(null);
  const [reading, setReading] = useState<RoomReading | null>(null);
  const [quad, setQuad] = useState<Quad>(FULL_QUAD);
  const [boardScale, setBoardScale] = useState(1);

  const [design, setDesign] = useState<StudioDesign>(() => emptyStudioDesign());
  const regionNotedRef = useRef(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [split, setSplit] = useState(60);
  const [repaired, setRepaired] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const beforeRef = useRef<HTMLCanvasElement | null>(null);
  const afterRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const openedRef = useRef(false);

  /* ── entry: a shared link opens on the floor it names ──────────────────── */
  useEffect(() => {
    let search = '';
    try {
      search = window.location.search;
    } catch {
      /* no location — nothing to read */
    }
    if (!openedRef.current) {
      openedRef.current = true;
      /* `src` says which surface sent them: a species dossier, the head term,
         the homepage band, the chrome. It is set by <SeeInMyRoom> and is read
         here rather than there, because a reference page should not ship a
         kilobyte of JavaScript to fire one event. */
      const src = new URLSearchParams(search).get('src');
      track('studio_open', src ? { src } : undefined);
      /* WHICH BANDS TO OPEN ON (GEO-006).
         `?region=US` is set by the links on the New York city pages, so a
         homeowner in Amherst who taps "see it in your room" arrives already
         priced in the currency their own city page quoted them. It is a
         DEFAULT, not a verdict: the control below says which bands are in use
         and changes them, and nothing is inferred from an IP or a locale — a
         visitor on a Toronto laptop planning a Buffalo rental is not a Canadian
         job, and guessing would put the wrong currency in front of them with no
         way to see why. */
      const region = new URLSearchParams(search).get('region');
      if (region) setDesign((d) => ({ ...d, country: countryOf(region) }));
    }
    /* `/floor-studio#live` opens the camera directly. The header, the mobile
       drawer, ⌘K and the homepage all use it, so the fastest thing this site
       does is one tap from anywhere (LIVE-01). A device with no camera falls
       through to the ordinary start screen rather than showing an error for a
       thing the visitor never asked for. */
    try {
      if (window.location.hash === '#live' && cameraAvailable()) setStage('live');
    } catch {
      /* no location — start where we always do */
    }

    try {
      if (!search) return;
      const shared = decodeStudioDesign(search);
      if (shared) {
        setDesign(shared);
        setStage('studio');
      }
    } catch {
      /* a malformed link opens the studio empty rather than breaking it */
    }
  }, []);

  /* The mark, loaded once and shared with every canvas that signs. */
  const [mark, setMark] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    void loadMark(EW_MARK).then(setMark);
  }, []);

  /* ── the ground the floor is laid into ─────────────────────────────────── */
  const ground = useMemo(() => photo ?? swatchGround(960, 640), [photo]);
  const activeQuad = photo ? quad : FULL_QUAD;

  const render = useMemo(
    () =>
      compositeFloor(ground, activeQuad, design.config, {
        squareFeet: design.squareFeet,
        boardScale,
      }),
    [ground, activeQuad, design.config, design.squareFeet, boardScale],
  );


  const visualisedRef = useRef<string | null>(null);
  useEffect(() => {
    if (stage !== 'studio') return;
    const id = configurationId(design.config);
    if (visualisedRef.current === id) return;
    visualisedRef.current = id;
    track('studio_visualised', { config: id, with_photo: photo !== null });
  }, [stage, design.config, photo]);

  /* ── the recommendations ───────────────────────────────────────────────── */
  const matches = useMemo(
    () =>
      matchFloors({
        feels: design.feels,
        room: design.room,
        roomTypeId: design.roomTypeId,
        squareFeet: design.squareFeet,
        budgetCad: design.budgetCad,
        country: design.country,
      }),
    [design.feels, design.room, design.roomTypeId, design.squareFeet, design.budgetCad, design.country],
  );

  const matchesShownRef = useRef(false);
  useEffect(() => {
    if (stage !== 'studio' || matchesShownRef.current || matches.length === 0) return;
    matchesShownRef.current = true;
    track('studio_match_shown', { count: matches.length, top: matches[0]!.id });
  }, [stage, matches]);

  const estimate = useMemo(
    () => priceConfiguration(design.config, design.squareFeet, design.country),
    [design.config, design.squareFeet, design.country],
  );
  const movement = useMemo(() => movementFor(design.config), [design.config]);

  /* THE PAINT EFFECT SITS BELOW `estimate`, AND THAT IS NOT COSMETIC.
     It was written above the useMemo that declares `estimate` while naming it
     in its dependency array — a temporal dead zone. tsc caught it as TS2448,
     "Block-scoped variable 'estimate' used before its declaration", and the
     build stopped, which is the guard working. Moving the effect is the fix; a
     ref would have hidden the ordering rather than corrected it. */
  useEffect(() => {
    if (beforeRef.current) paintPixels(beforeRef.current, ground);
    if (!afterRef.current) return;
    paintPixels(afterRef.current, render.pixels);
    /* SIGNED IN THE PIXELS (VIS-04).
       Everything a visitor is shown of their own room with a new floor in it
       carries the mark, the floor's name, the range and ecowoods.ca — because
       the artefact this feature produces is a SCREENSHOT, and a screenshot
       carries no DOM. A mark in the HTML around the canvas is a mark that is
       not in the thing that gets sent to a partner. */
    const ctx = afterRef.current.getContext('2d');
    if (ctx) {
      drawSignature(ctx, afterRef.current.width, afterRef.current.height, {
        floor: describeConfiguration(design.config),
        price: `${money(estimate.estimatedLowCad, estimate.currency)} – ${money(estimate.estimatedHighCad, estimate.currency)}`,
        mark,
      });
    }
    /* `stage` IS A DEPENDENCY, and leaving it out is how this feature breaks in
       exactly the way it was reported broken. The verify screen and the studio
       screen are different elements, so moving between them gives afterRef a
       NEW canvas — blank until something paints it. Without `stage` here the
       effect does not re-run on that transition and the visitor arrives at the
       studio looking at an empty box. */
  }, [ground, render, mark, design.config, estimate, stage]);

  /* ── persistence: every change survives a reload and a share ───────────── */
  useEffect(() => {
    if (stage !== 'studio') return;
    saveStudioDesign(design);
    try {
      const url = new URL(window.location.href);
      url.search = encodeStudioDesign(design);
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* history unavailable — localStorage still carries it */
    }
  }, [design, stage]);

  /* ── live camera ───────────────────────────────────────────────────────── */
  /* Resolved after mount: navigator.mediaDevices does not exist during the
     server render, and a button that appears on hydration is better than a
     button that is there and does nothing. */
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => setHasCamera(cameraAvailable()), []);

  /**
   * A frozen live frame enters the ordinary flow at the verification step.
   *
   * It arrives with the boundary the live view had settled on, which is
   * usually close and never claimed to be right — the same four draggable
   * corners are waiting on the next screen, and the same two questions a
   * photograph cannot answer still get asked.
   */
  const onLiveCapture = useCallback((pixels: Pixels, liveQuad: Quad) => {
    const measured = analyseRoom(pixels);
    setPhoto(pixels);
    setReading({ ...measured, floorQuad: liveQuad });
    setQuad(liveQuad);
    setDesign((d) => ({ ...d, room: roomFactsFrom(measured) }));
    setStage('verify');
  }, []);

  /* ── photo intake ──────────────────────────────────────────────────────── */
  const onPickPhoto = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStage('analysing');
    setAnalysingStep(0);
    const paced = window.setInterval(
      () => setAnalysingStep((s) => Math.min(ANALYSING_STEPS.length - 1, s + 1)),
      260,
    );
    try {
      const decoded = await decodePhoto(file);
      const measured = analyseRoom(decoded.pixels);
      window.clearInterval(paced);
      setPhoto(decoded.pixels);
      setReading(measured);
      setQuad(measured.floorQuad);
      setDesign((d) => ({ ...d, room: roomFactsFrom(measured) }));
      track('studio_photo_analysed', { confidence: measured.floorConfidence, light: measured.lightLevel });
      setStage('verify');
    } catch (err) {
      window.clearInterval(paced);
      setError(err instanceof Error ? err.message : 'Something went wrong reading that photo.');
      setStage('start');
    }
  }, []);

  /* ── the boundary, dragged or typed ────────────────────────────────────── */
  const correctedRef = useRef(false);
  const noteCorrection = useCallback(() => {
    if (correctedRef.current) return;
    correctedRef.current = true;
    track('studio_boundary_corrected');
  }, []);

  const moveCorner = useCallback(
    (index: number, dx: number, dy: number) => {
      noteCorrection();
      setQuad((q) => {
        const next = [...q] as Quad;
        next[index] = {
          x: Math.min(1, Math.max(0, q[index]!.x + dx)),
          y: Math.min(1, Math.max(0, q[index]!.y + dy)),
        };
        return next;
      });
    },
    [noteCorrection],
  );

  const dragging = useRef<number | null>(null);
  const onCornerPointerDown = (index: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    dragging.current = index;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const index = dragging.current;
    if (index === null || !stageRef.current) return;
    const box = stageRef.current.getBoundingClientRect();
    noteCorrection();
    setQuad((q) => {
      const next = [...q] as Quad;
      next[index] = {
        x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
        y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
      };
      return next;
    });
  };
  const onStagePointerUp = () => {
    dragging.current = null;
  };
  const onCornerKey = (index: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveCorner(index, move[0], move[1]);
  };

  /* ── configuration ─────────────────────────────────────────────────────── */
  const setConfig = useCallback((next: FloorConfiguration, axis: keyof FloorConfiguration, value: string) => {
    const { config, repairedAxes } = withAxis(next, axis, value);
    setDesign((d) => ({ ...d, config }));
    track('studio_config_changed', { axis, value, config: configurationId(config) });
    setRepaired(
      repairedAxes.length
        ? `We moved the ${repairedAxes
            .map((a) => ({ productId: 'species', finishId: 'finish', patternId: 'pattern', widthId: 'board width' })[a])
            .join(' and ')} to keep this a floor we can lay.`
        : null,
    );
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompare((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-MAX_COMPARE);
      if (next.length > 1) track('studio_compare', { count: next.length });
      return next;
    });
  }, []);

  const applyMatch = useCallback((match: Match) => {
    setDesign((d) => ({ ...d, config: match.config }));
    setRepaired(null);
  }, []);

  /* ── save, share, download ─────────────────────────────────────────────── */
  const shareLink = useMemo(() => studioHref(design), [design]);
  const reference = useMemo(() => studioRef(design), [design]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(new URL(shareLink, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
      track('studio_share', { method: 'copy', config: configurationId(design.config) });
    } catch {
      setError('Your browser would not let us copy that. The address bar already has the link.');
    }
  }, [shareLink, design.config]);

  const downloadImage = useCallback(() => {
    try {
      /* The saved file is signed the same way the screen is. A picture of
         somebody's living room with a new floor in it, saved and sent on, with
         no idea who made it, is a marketing asset thrown away. */
      const url = pixelsToDataUrl(render.pixels, (ctx, w, h) =>
        drawSignature(ctx, w, h, {
          floor: describeConfiguration(design.config),
          price: `${money(estimate.estimatedLowCad, estimate.currency)} – ${money(estimate.estimatedHighCad, estimate.currency)}`,
          mark,
        }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `ecowoods-${reference}.png`;
      a.click();
      track('studio_share', { method: 'download', config: configurationId(design.config) });
    } catch {
      setError('We could not save that image here. Try the share link instead.');
    }
  }, [render.pixels, reference, design.config, estimate, mark]);

  /* ── rendering ─────────────────────────────────────────────────────────── */
  const sampleProduct = publishedStudioProducts().find((p) => p.id === 'samples');

  const cornerStyle = (p: { x: number; y: number }): CSSProperties => ({
    left: `${p.x * 100}%`,
    top: `${p.y * 100}%`,
  });

  return (
    <section className="fs" id="studio" aria-labelledby="fs-studio-heading">
      <div className="shell">
        <h2 id="fs-studio-heading" className="fs-h">
          {stage === 'studio' ? 'Your floor, in your room' : 'See your new floor in your home'}
        </h2>

        {error && (
          <p className="fs-error" role="alert">
            {error}
          </p>
        )}

        {/* ── START ──────────────────────────────────────────────────────── */}
        {stage === 'start' && (
          <div className="fs-start">
            <p className="fs-lede">
              Point your camera at the room and watch the floor change while you move, upload a
              photo, or start from a floor. Everything happens on your own device — nothing is
              uploaded and we keep nothing.
            </p>
            <div className="fs-start-actions">
              {hasCamera && (
                <button
                  type="button"
                  className="btn btn-copper btn-lg"
                  onClick={() => setStage('live')}
                >
                  Point my camera at the room
                </button>
              )}
              <label className="btn btn-ghost btn-lg fs-file">
                Upload a room photo
                <input
                  type="file"
                  accept="image/*"
                  className="fs-file-input"
                  onChange={(e) => void onPickPhoto(e.currentTarget.files?.[0])}
                />
              </label>
              <label className="btn btn-ghost fs-file">
                Use my camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="fs-file-input"
                  onChange={(e) => void onPickPhoto(e.currentTarget.files?.[0])}
                />
              </label>
              <button type="button" className="fs-link-btn" onClick={() => setStage('feel')}>
                Start with a floor instead
              </button>
            </div>
            <p className="fs-fine">
              Works best on a photo taken standing up, with some of the floor in the bottom of the
              frame. A phone photo is exactly right.
            </p>
          </div>
        )}

        {/* ── LIVE ───────────────────────────────────────────────────────── */}
        {stage === 'live' && (
          <div className="fs-live-wrap">
            <LiveRoom
              config={design.config}
              squareFeet={design.squareFeet}
              boardScale={boardScale}
              priceLine={`${money(estimate.estimatedLowCad, estimate.currency)} – ${money(estimate.estimatedHighCad, estimate.currency)}`}
              onCapture={onLiveCapture}
              onClose={() => setStage('start')}
            />
            {/* The floor changes WHILE the camera is running. These are the same
                axes the studio uses, reading the same catalogue and the same
                compatibility rules — there is no second configurator here. */}
            <div className="fs-live-panel">
              <h3 className="fs-h3">Change the floor while you look at it</h3>
              <Axis
                legend="Species"
                options={FLOOR_PRODUCTS.map((p) => ({ id: p.id, label: p.name, swatch: [p.base, p.grain] }))}
                value={design.config.productId}
                onPick={(v) => setConfig(design.config, 'productId', v)}
                reasonFor={(v) => incompatibilities({ ...design.config, productId: v }).map((r) => r.reason)[0] ?? null}
              />
              <Axis
                legend="Finish"
                options={FINISH_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
                value={design.config.finishId}
                onPick={(v) => setConfig(design.config, 'finishId', v)}
                reasonFor={(v) => incompatibilities({ ...design.config, finishId: v }).map((r) => r.reason)[0] ?? null}
              />
              <Axis
                legend="Pattern"
                options={PATTERN_OPTIONS.map((p) => ({ id: p.id, label: p.label }))}
                value={design.config.patternId}
                onPick={(v) => setConfig(design.config, 'patternId', v)}
                reasonFor={(v) => incompatibilities({ ...design.config, patternId: v }).map((r) => r.reason)[0] ?? null}
              />
              <Axis
                legend="Board width"
                options={BOARD_WIDTHS.map((w) => ({ id: w.id, label: w.label }))}
                value={design.config.widthId}
                onPick={(v) => setConfig(design.config, 'widthId', v)}
                reasonFor={(v) => incompatibilities({ ...design.config, widthId: v }).map((r) => r.reason)[0] ?? null}
              />
              {repaired && (
                <p className="fs-repaired" role="status">
                  {repaired}
                </p>
              )}
              <p className="fs-estimate-label">Estimated installed investment</p>
              <p className="fs-estimate-figure">
                {money(estimate.estimatedLowCad, estimate.currency)} <em>–</em> {money(estimate.estimatedHighCad, estimate.currency)}
              </p>
              <p className="fs-disclaimer">
                A <strong>range, not a quote</strong>, for {design.squareFeet.toLocaleString('en-CA')} sq ft.
                Your fixed price is written down after the free in-home measure.
              </p>
              <p className="fs-fine">
                Every floor here is one we can supply and install. Nothing on this screen is
                generated by an image model — a floor that does not exist cannot be bought.
              </p>
            </div>
          </div>
        )}

        {/* ── ANALYSING ──────────────────────────────────────────────────── */}
        {stage === 'analysing' && (
          <div className="fs-analysing" role="status" aria-live="polite">
            <span className="fs-spinner" aria-hidden="true" />
            <p>{ANALYSING_STEPS[analysingStep]}</p>
            <p className="fs-fine">All of this is running in your browser. Nothing is being uploaded.</p>
          </div>
        )}

        {/* ── VERIFY ─────────────────────────────────────────────────────── */}
        {stage === 'verify' && reading && (
          <div className="fs-verify">
            <div
              className="fs-stage fs-stage--verify"
              ref={stageRef}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerUp}
              onPointerCancel={onStagePointerUp}
            >
              {/* THE FLOOR CHANGES HERE, NOT TWO SCREENS LATER (VIS-04).
                  This canvas used to paint `ground` — the visitor's own
                  photograph, unchanged — with the four corners over it. So the
                  first thing somebody saw after uploading a picture of their
                  living room was their living room, with dots on it, and two
                  more taps between them and any new floor at all. The report
                  was exactly what that produces: "the floor did not change".
                  It did. They never reached the screen that shows it.
                  It paints the composite now: a real Ecowoods floor is already
                  in the room, and the corners sit on top of it so the
                  correction and the payoff are the same screen. */}
              <canvas
                ref={afterRef}
                className="fs-canvas"
                role="img"
                aria-label={`Your room with ${describeConfiguration(design.config)}`}
              />
              <svg className="fs-quad" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points={quad.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} />
              </svg>
              {quad.map((p, i) => (
                <button
                  key={CORNER_LABELS[i]}
                  type="button"
                  className="fs-corner"
                  style={cornerStyle(p)}
                  aria-label={`${CORNER_LABELS[i]} of the floor. Arrow keys to move, shift for bigger steps.`}
                  onPointerDown={onCornerPointerDown(i)}
                  onKeyDown={onCornerKey(i)}
                />
              ))}
            </div>

            <div className="fs-verify-panel">
              <h3 className="fs-h3">
                Here is {describeConfiguration(design.config).toLowerCase()} in your room
              </h3>
              <p className="fs-fine">
                Already a real floor we can supply and install, laid into your own photo with your
                room&rsquo;s own light. Change it to anything else on the next screen.
              </p>
              <ul className="fs-notes">
                {reading.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <p className="fs-fine">
                Drag the four corners if we got the edge of the floor wrong — the new floor follows
                them as you move. This is the normal thing to do, not the failure case: you can see
                your room and we cannot.
              </p>

              <div className="fs-asks">
                {UNMEASURABLE_FROM_A_PHOTO.map((ask) => (
                  <div className="fs-ask" key={ask.field}>
                    {ask.field === 'area' ? (
                      <label className="fs-field">
                        <span>{ask.ask}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={SQFT_MIN}
                          max={SQFT_MAX}
                          value={design.squareFeet}
                          onChange={(e) =>
                            setDesign((d) => ({ ...d, squareFeet: Number(e.target.value) || d.squareFeet }))
                          }
                        />
                      </label>
                    ) : (
                      <label className="fs-field">
                        <span>{ask.ask}</span>
                        <select
                          value={design.roomTypeId ?? ''}
                          onChange={(e) => setDesign((d) => ({ ...d, roomTypeId: e.target.value || undefined }))}
                        >
                          <option value="">Choose one</option>
                          {ROOM_TYPES.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <p className="fs-fine">{ask.why}</p>
                  </div>
                ))}
              </div>

              <div className="fs-verify-actions">
                {/* Straight to the floors. "How do you want the room to feel?"
                    was a GATE between the visitor and the thing they came for,
                    and it is a better question once they have seen one floor in
                    their room than before they have seen any. It is still
                    offered, second, for somebody who does not know where to
                    start. */}
                <button type="button" className="btn btn-copper btn-lg" onClick={() => setStage('studio')}>
                  Show me every floor in this room
                </button>
                <button type="button" className="fs-link-btn" onClick={() => setStage('feel')}>
                  Help me choose
                </button>
                <button type="button" className="fs-link-btn" onClick={() => setStage('start')}>
                  Try another photo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FEEL ───────────────────────────────────────────────────────── */}
        {stage === 'feel' && (
          <div className="fs-feel">
            <h3 className="fs-h3">How do you want the room to feel?</h3>
            <p className="fs-lede">
              Pick as many as you like. We will translate it into species, finish, pattern and board
              width — which is our job, not yours.
            </p>
            <div className="fs-chips">
              {FEELS.map((feel) => {
                const on = design.feels.includes(feel.id);
                return (
                  <button
                    key={feel.id}
                    type="button"
                    className="fs-chip"
                    aria-pressed={on}
                    onClick={() =>
                      setDesign((d) => ({
                        ...d,
                        feels: on ? d.feels.filter((f) => f !== feel.id) : [...d.feels, feel.id],
                      }))
                    }
                  >
                    <strong>{feel.label}</strong>
                    <em>{feel.blurb}</em>
                  </button>
                );
              })}
            </div>

            <div className="fs-feel-row">
              <label className="fs-field">
                <span>
                  Roughly what are you covering? <em>square feet</em>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={SQFT_MIN}
                  max={SQFT_MAX}
                  value={design.squareFeet}
                  onChange={(e) => setDesign((d) => ({ ...d, squareFeet: Number(e.target.value) || d.squareFeet }))}
                />
              </label>
              <label className="fs-field">
                <span>
                  A budget, if you have one <em>optional, {estimate.currency}</em>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={design.budgetCad ?? ''}
                  placeholder="We never hide a floor because of this"
                  onChange={(e) => setDesign((d) => ({ ...d, budgetCad: Number(e.target.value) || undefined }))}
                />
              </label>
            </div>

            <button type="button" className="btn btn-copper btn-lg" onClick={() => setStage('studio')}>
              Show me my floors
            </button>
          </div>
        )}

        {/* ── STUDIO ─────────────────────────────────────────────────────── */}
        {stage === 'studio' && (
          <div className="fs-studio">
            <div className="fs-stage-wrap">
              <div className="fs-stage" ref={stageRef}>
                <canvas ref={beforeRef} className="fs-canvas" role="img" aria-label="Your room before" />
                <div className="fs-after" style={{ width: `${split}%` }}>
                  <canvas
                    ref={afterRef}
                    className="fs-canvas"
                    role="img"
                    aria-label={`Your room with ${describeConfiguration(design.config)}`}
                  />
                </div>
                <span className="fs-split-line" style={{ left: `${split}%` }} aria-hidden="true" />
              </div>
              <label className="fs-split">
                <span>Drag to compare before and after</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  onChange={(e) => setSplit(Number(e.target.value))}
                />
              </label>
              {photo && render.painted < 0.5 && (
                <p className="fs-fine">
                  A lot of this room is furniture rather than floor, so we have left it alone. Drag
                  the corners on the photo step if the boundary is wrong.
                </p>
              )}
              {!photo && (
                <p className="fs-fine">
                  This is the floor itself, lit from above. Add a photo of your room and it goes into
                  the room instead.{' '}
                  <button type="button" className="fs-link-btn" onClick={() => setStage('start')}>
                    Add a photo
                  </button>
                </p>
              )}
            </div>

            <div className="fs-panel">
              {/* Matches */}
              <h3 className="fs-h3">Ecowoods Floor Match</h3>
              <p className="fs-fine">
                Every one of these is a floor we can supply and install. The percentage is the sum of
                the reasons under it — there is no number here without a sentence.
              </p>
              <ul className="fs-matches">
                {matches.map((match) => (
                  <li key={match.id} className={match.id === configurationId(design.config) ? 'is-current' : ''}>
                    <div className="fs-match-head">
                      <strong>{match.name}</strong>
                      <span className="fs-score">{match.score}% match</span>
                    </div>
                    <ul className="fs-reasons">
                      {match.reasons.slice(0, 2).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                      {match.caveats.slice(0, 1).map((r) => (
                        <li key={r} className="fs-caveat">
                          {r}
                        </li>
                      ))}
                    </ul>
                    <p className="fs-match-price">
                      {money(match.estimate.estimatedLowCad, match.estimate.currency)} – {money(match.estimate.estimatedHighCad, match.estimate.currency)}{' '}
                      <em>estimated installed</em>
                    </p>
                    <div className="fs-match-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => applyMatch(match)}>
                        See it in my room
                      </button>
                      <button
                        type="button"
                        className="fs-link-btn"
                        aria-pressed={compare.includes(match.id)}
                        onClick={() => toggleCompare(match.id)}
                      >
                        {compare.includes(match.id) ? 'In the comparison' : 'Compare'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Controls */}
              <h3 className="fs-h3">Change anything</h3>
              {repaired && (
                <p className="fs-repaired" role="status">
                  {repaired}
                </p>
              )}

              <Axis
                legend="Species"
                options={FLOOR_PRODUCTS.map((p) => ({ id: p.id, label: p.name, swatch: [p.base, p.grain] }))}
                value={design.config.productId}
                onPick={(v) => setConfig(design.config, 'productId', v)}
                reasonFor={(v) =>
                  incompatibilities({ ...design.config, productId: v }).map((r) => r.reason)[0] ?? null
                }
              />
              <Axis
                legend="Finish"
                options={FINISH_OPTIONS.map((f) => ({ id: f.id, label: f.label }))}
                value={design.config.finishId}
                onPick={(v) => setConfig(design.config, 'finishId', v)}
                reasonFor={(v) =>
                  incompatibilities({ ...design.config, finishId: v }).map((r) => r.reason)[0] ?? null
                }
              />
              <Axis
                legend="Pattern"
                options={PATTERN_OPTIONS.map((p) => ({ id: p.id, label: p.label }))}
                value={design.config.patternId}
                onPick={(v) => setConfig(design.config, 'patternId', v)}
                reasonFor={(v) =>
                  incompatibilities({ ...design.config, patternId: v }).map((r) => r.reason)[0] ?? null
                }
              />
              <Axis
                legend="Board width"
                options={BOARD_WIDTHS.map((w) => ({ id: w.id, label: w.label }))}
                value={design.config.widthId}
                onPick={(v) => setConfig(design.config, 'widthId', v)}
                reasonFor={(v) =>
                  incompatibilities({ ...design.config, widthId: v }).map((r) => r.reason)[0] ?? null
                }
              />
              <p className="fs-fine">
                {widthById(design.config.widthId)?.note} Board width changes how the floor looks and
                how far it moves with the seasons. It does not change the published band.
              </p>
              {movement && <p className="fs-fine">{movement.sentence}</p>}

              <div className="fs-sliders">
                <label className="fs-field">
                  <span>
                    Area <em>{design.squareFeet.toLocaleString('en-CA')} sq ft</em>
                  </span>
                  <input
                    type="range"
                    min={SQFT_MIN}
                    max={3000}
                    step={25}
                    value={Math.min(3000, design.squareFeet)}
                    onChange={(e) => setDesign((d) => ({ ...d, squareFeet: Number(e.target.value) }))}
                  />
                </label>
                <label className="fs-field">
                  <span>
                    Board scale <em>nudge until the boards look right in your photo</em>
                  </span>
                  <input
                    type="range"
                    min={0.6}
                    max={2}
                    step={0.05}
                    value={boardScale}
                    onChange={(e) => setBoardScale(Number(e.target.value))}
                  />
                </label>
              </div>

              {/* WHICH BANDS THIS IS PRICED AGAINST (GEO-006).
                  Stated on screen rather than assumed, because the studio is
                  linked from the header and footer of 26 New York markets and
                  quoted every one of them in Canadian dollars until now. */}
              <fieldset className="fs-axis fs-region">
                <legend>Where is the floor?</legend>
                <div className="fs-axis-options">
                  {STUDIO_COUNTRIES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="fs-option"
                      aria-pressed={design.country === c.id}
                      onClick={() => {
                        setDesign((d) => ({ ...d, country: c.id }));
                        if (!regionNotedRef.current) {
                          regionNotedRef.current = true;
                          track('studio_region_changed', { region: c.id });
                        }
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <p className="fs-axis-note">
                  {design.country === 'US'
                    ? `Priced against the New York bands, in US dollars — ${STUDIO_COUNTRIES[1]!.where}.`
                    : `Priced against the Ontario bands, in Canadian dollars — ${STUDIO_COUNTRIES[0]!.where}.`}{' '}
                  <Link href="/pricing">Both are published.</Link>
                </p>
              </fieldset>

              {/* The range */}
              <div className="fs-estimate">
                <p className="fs-estimate-label">Estimated installed investment</p>
                <p className="fs-estimate-figure">
                  {money(estimate.estimatedLowCad, estimate.currency)} <em>–</em> {money(estimate.estimatedHighCad, estimate.currency)}
                </p>
                <p className="fs-estimate-sub">
                  {estimate.perSqftCad} · {design.squareFeet.toLocaleString('en-CA')} sq ft ·{' '}
                  {describeConfiguration(design.config)}
                </p>
                <p className="fs-disclaimer">
                  This is a <strong>range, not a quote.</strong> Your fixed price is written down after
                  the free in-home measure, and then it does not change.
                </p>
                <details className="fs-why">
                  <summary>Why this price?</summary>
                  <p>
                    New hardwood installation is published at{' '}
                    {formatBand(design.country === 'US' ? US_NEW_INSTALL : NEW_INSTALL)} — see{' '}
                    <Link href="/pricing">the published bands</Link>. Inside that, the species sets the
                    material, the finish sets how many passes the floor takes, and the pattern sets the
                    waste and the labour: a chevron is mitred point to point and is the hardest floor
                    we lay. What the range cannot know is your subfloor, your stairs, your transitions
                    and your moisture readings, which is exactly why the number is fixed after somebody
                    has stood in the room.
                  </p>
                </details>
              </div>

              {/* Compare */}
              {compare.length > 0 && (
                <div className="fs-compare">
                  <h3 className="fs-h3">Side by side</h3>
                  <ul className="fs-compare-list">
                    {compare.map((id) => {
                      const config = parseConfigurationId(id);
                      if (!config) return null;
                      const price = priceConfiguration(config, design.squareFeet, design.country);
                      return (
                        <li key={id}>
                          <ComparePane ground={ground} quad={activeQuad} config={config} squareFeet={design.squareFeet} boardScale={boardScale} />
                          <strong>{describeConfiguration(config)}</strong>
                          <span>
                            {money(price.estimatedLowCad, price.currency)} – {money(price.estimatedHighCad, price.currency)}
                          </span>
                          <div className="fs-match-actions">
                            <button
                              type="button"
                              className="fs-link-btn"
                              onClick={() => setDesign((d) => ({ ...d, config }))}
                            >
                              Make this the one
                            </button>
                            <button type="button" className="fs-link-btn" onClick={() => toggleCompare(id)}>
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Exits */}
              <div className="fs-exits">
                <h3 className="fs-h3">Your Ecowoods floor</h3>
                <p className="fs-ref">
                  {reference} · {describeStudioDesign(design)}
                </p>
                <div className="fs-exit-actions">
                  <a
                    className="btn btn-copper btn-lg"
                    href={estimateHref(design)}
                    onClick={() => track('studio_estimate_handoff', { config: configurationId(design.config) })}
                  >
                    Get my fixed price
                  </a>
                  {sampleProduct && (
                    <a
                      className="btn btn-ghost"
                      href={estimateHref(design, 'samples')}
                      onClick={() => track('studio_samples_request', { config: configurationId(design.config) })}
                    >
                      Send me samples
                    </a>
                  )}
                  <button type="button" className="fs-link-btn" onClick={() => void copyLink()}>
                    {copied ? 'Link copied' : 'Copy the link to this design'}
                  </button>
                  <button type="button" className="fs-link-btn" onClick={downloadImage}>
                    Download the image
                  </button>
                  <Link className="fs-link-btn" href={designHref(design)}>
                    Open it in the full configurator
                  </Link>
                </div>
                <p className="fs-fine">
                  {sampleProduct?.deliverable} Your design travels with you — the estimate form already
                  knows the floor, the area and the room. Nothing to retype.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── one axis of the configuration ───────────────────────────────────────── */

function Axis({
  legend,
  options,
  value,
  onPick,
  reasonFor,
}: {
  legend: string;
  options: { id: string; label: string; swatch?: [string, string] }[];
  value: string;
  onPick: (id: string) => void;
  reasonFor: (id: string) => string | null;
}) {
  const slug = legend.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <fieldset className="fs-axis">
      <legend>{legend}</legend>
      <div className="fs-axis-options">
        {options.map((option) => {
          const reason = option.id === value ? null : reasonFor(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="fs-option"
              aria-pressed={option.id === value}
              aria-describedby={reason ? `fs-why-${slug}-${option.id}` : undefined}
              onClick={() => onPick(option.id)}
            >
              {option.swatch && (
                <span
                  className="fs-option-swatch"
                  aria-hidden="true"
                  style={{ background: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})` }}
                />
              )}
              {option.label}
            </button>
          );
        })}
      </div>
      {options.map((option) => {
        const reason = option.id === value ? null : reasonFor(option.id);
        return reason ? (
          <p className="fs-axis-note" id={`fs-why-${slug}-${option.id}`} key={`${option.id}-why`}>
            <strong>{option.label}:</strong> {reason}
          </p>
        ) : null;
      })}
    </fieldset>
  );
}

/* ── one pane of the comparison ──────────────────────────────────────────── */

function ComparePane({
  ground,
  quad,
  config,
  squareFeet,
  boardScale,
}: {
  ground: Pixels;
  quad: Quad;
  config: FloorConfiguration;
  squareFeet: number;
  boardScale: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const result = compositeFloor(ground, quad, config, { squareFeet, boardScale });
    if (ref.current) paintPixels(ref.current, result.pixels);
  }, [ground, quad, config, squareFeet, boardScale]);
  return <canvas ref={ref} className="fs-canvas" role="img" aria-label={describeConfiguration(config)} />;
}
