/**
 * lib/floor-studio/studio-config.ts — the design travels; the visitor does not retype.
 *
 * WHAT THIS REPLACES, AND WHAT IT DELIBERATELY DOES NOT TOUCH
 *
 * lib/design-config.ts owns `ew-design-v1`: species, finish, pattern, sq ft.
 * Its comment says the key is versioned and that a shape change must bump it
 * and never reinterpret old data. That instruction is followed literally here:
 * v1 IS NOT TOUCHED. Floor Studio writes a second, richer record under its own
 * key AND keeps writing the v1 record, so every existing consumer —
 * EstimateForm's summary chip, /design/spec, the querystring contract, the
 * copies of `ew-design-v1` already sitting in people's browsers — keeps working
 * with no edit and no migration. A visitor who configures a floor in Floor
 * Studio and then opens /design finds their floor waiting.
 *
 * NO PRICE IS EVER STORED
 *
 * A saved design carries the configuration and the area, never the range. The
 * range is recomputed from estimateInstalledRangeCad() every time it is shown.
 * A stored number would be a price frozen at the moment somebody clicked save,
 * and the first time the rate table moves, a share link from three weeks ago
 * would quote a figure this business no longer stands behind — to a stranger,
 * with our name on it. So the record stores inputs and the arithmetic stays
 * live.
 *
 * THE SHARE CODE IS READABLE ON PURPOSE
 *
 * `c=white-oak.satin.herringbone.5&a=900&f=warmer,natural` rather than an
 * opaque base64 blob. Three reasons, in order of how much they matter: a
 * support call can read it down the phone; a crawler can see that these URLs
 * are parameterisations of one page rather than an infinite space of garbage;
 * and anybody auditing what we persist about a visitor can read it without a
 * decoder. Nothing in it is personal — it is a floor and a number of square
 * feet.
 *
 * THE PHOTOGRAPH IS NOT IN IT. A share link carries the design, never the room.
 * The image never leaves the device that took it (see room.ts), so there is
 * nothing here that could leak the inside of somebody's house.
 */
import { saveDesignConfig } from '@/lib/design-config';
import {
  DEFAULT_CONFIGURATION,
  describeConfiguration,
  isLayable,
  priceConfiguration,
  productById,
  type FloorConfiguration,
} from './catalog';
import { ROOM_TYPES, isFeelTag, roomTypeById, type FeelTag } from './match';
import type { LightLevel, RoomReading } from './room';
import type { ToneKey, UndertoneKey } from './catalog';
import type { PriceCountry } from '@/content/constants/pricing';
import { designIdOf, ensureDesignId, formatDesignId } from './design-id';

export const STUDIO_CONFIG_KEY = 'ew-studio-v1';

/** Matches lib/design-config.ts, for the same reason: a stale design is noise. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export const SQFT_MIN = 50;
export const SQFT_MAX = 6000;

export type StudioRoomFacts = {
  lightLevel: LightLevel;
  wallUndertone: UndertoneKey;
  existingFloorTone: ToneKey;
};

export type StudioDesign = {
  config: FloorConfiguration;
  squareFeet: number;
  feels: FeelTag[];
  roomTypeId?: string;
  /** The measured reading, where a photo was analysed. Never the photo. */
  room?: StudioRoomFacts;
  /**
   * WHICH BANDS THIS DESIGN IS PRICED AGAINST (GEO-006).
   *
   * GEO-004 established the rule the rest of this site holds: a New York
   * surface shows no Canadian figure and an Ontario surface shows no United
   * States one. verify-geo enforces it on the pages that NAME a market, and the
   * studio names none — so the rule never reached it. Every figure it printed
   * was Canadian, while the header and footer link it from all 26 New York
   * markets. A homeowner in Amherst read a United States band on their city
   * page and was quoted in Canadian dollars one click later.
   *
   * It is ASKED FOR and CARRIED, never inferred. No IP lookup, no locale
   * sniffing: a visitor on a Toronto laptop planning a Buffalo rental is not a
   * Canadian job, and guessing would put a wrong currency in front of them with
   * no way to see why. The entry links set it, the control changes it, and the
   * share code carries it so a link opens in the currency it was built in.
   */
  country: PriceCountry;
  /**
   * THE JOIN KEY (MEAS-01).
   *
   * Minted, not derived — see lib/floor-studio/design-id.ts for why the share
   * code cannot serve as one. It travels with the design through the share
   * link, the estimate form, /api/leads and onto QuoteRequest, so a deposit
   * taken six weeks later can be traced back to the studio session that
   * started it. Optional on the type because every design saved before this
   * patch has none, and a design without an id must still open.
   */
  designId?: string;
  /** The optional budget the visitor typed, in the currency of `country`. */
  budgetCad?: number;
  /** ISO timestamp of the last edit. */
  savedAt: string;
};

/** The two countries this business publishes bands for. */
export const STUDIO_COUNTRIES: { id: PriceCountry; label: string; where: string }[] = [
  { id: 'CA', label: 'Ontario', where: 'Toronto, the GTA, Niagara and southwestern Ontario' },
  { id: 'US', label: 'New York', where: 'Buffalo, Niagara County, Erie County and Rochester' },
];

export const countryOf = (value: string | null | undefined): PriceCountry =>
  value === 'US' || value === 'us' ? 'US' : 'CA';

export const roomFactsFrom = (reading: RoomReading): StudioRoomFacts => ({
  lightLevel: reading.lightLevel,
  wallUndertone: reading.wallUndertone,
  existingFloorTone: reading.existingFloorTone,
});

const clampSqft = (n: number): number =>
  Math.min(SQFT_MAX, Math.max(SQFT_MIN, Math.round(Number.isFinite(n) ? n : 900)));

/* ── the share code ───────────────────────────────────────────────────────── */

const LIGHT_LEVELS: LightLevel[] = ['dim', 'balanced', 'bright'];
const UNDERTONES: UndertoneKey[] = ['warm', 'neutral', 'cool'];
const TONES: ToneKey[] = ['light', 'mid', 'dark'];

/**
 * The design itself, WITHOUT its id.
 *
 * `studioRef` hashes this rather than the full code, so the FS- reference
 * stays a property of the floor. Two people on one share link must read the
 * same reference aloud — that guarantee predates MEAS-01 and adding a random
 * id to the hash input would have quietly ended it, giving every reload a new
 * "reference" for an unchanged floor.
 */
function encodeDesignContent(design: StudioDesign): string {
  const params = new URLSearchParams();
  const { productId, finishId, patternId, widthId } = design.config;
  params.set('c', [productId, finishId, patternId, widthId].join('.'));
  params.set('a', String(clampSqft(design.squareFeet)));
  if (design.feels.length) params.set('f', design.feels.join(','));
  if (design.roomTypeId) params.set('r', design.roomTypeId);
  if (design.room) {
    params.set('l', design.room.lightLevel);
    params.set('u', design.room.wallUndertone);
    params.set('e', design.room.existingFloorTone);
  }
  if (design.budgetCad && design.budgetCad > 0) params.set('b', String(Math.round(design.budgetCad)));
  /* Only when it is not the home country, so an Ontario link stays as short as
     it was before GEO-006 and a New York one says so out loud. */
  if (design.country === 'US') params.set('n', 'US');
  return params.toString();
}

/**
 * `c=…&a=…&d=…` — the whole design plus its id, in a querystring a person can
 * read. This is what the share link and the estimate handoff carry.
 */
export function encodeStudioDesign(design: StudioDesign): string {
  const content = encodeDesignContent(design);
  return design.designId ? `${content}&d=${design.designId}` : content;
}

/**
 * Read a share code back.
 *
 * Every field is validated against the catalogue rather than trusted: a link
 * naming a floor we do not lay resolves to null, not to a render of something
 * that cannot be bought. Unknown feels are dropped rather than failing the
 * whole code, because a link from a future version of this page should still
 * open something sensible.
 */
export function decodeStudioDesign(input: string, now = new Date()): StudioDesign | null {
  const params = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  const raw = params.get('c');
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const config: FloorConfiguration = {
    productId: parts[0]!,
    finishId: parts[1]!,
    patternId: parts[2]!,
    widthId: parts[3]!,
  };
  if (!isLayable(config)) return null;

  const feels = (params.get('f') ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter((f): f is FeelTag => isFeelTag(f));

  const roomTypeId = params.get('r') ?? undefined;
  const light = params.get('l');
  const undertone = params.get('u');
  const existing = params.get('e');
  const room =
    light && undertone && existing &&
    LIGHT_LEVELS.includes(light as LightLevel) &&
    UNDERTONES.includes(undertone as UndertoneKey) &&
    TONES.includes(existing as ToneKey)
      ? {
          lightLevel: light as LightLevel,
          wallUndertone: undertone as UndertoneKey,
          existingFloorTone: existing as ToneKey,
        }
      : undefined;

  const budget = Number(params.get('b'));
  /* Validated, never trusted: a `d` that we did not mint is dropped, because
     joining on a value of unknown provenance is joining on noise. */
  const designId = designIdOf(params.get('d'));

  return {
    config,
    squareFeet: clampSqft(Number(params.get('a'))),
    feels,
    roomTypeId: roomTypeId && roomTypeById(roomTypeId) ? roomTypeId : undefined,
    room,
    budgetCad: Number.isFinite(budget) && budget > 0 ? Math.round(budget) : undefined,
    /* SPREAD, not `designId: undefined`. A design decoded from a pre-MEAS-01
       link must come back byte-identical to what it was, without growing a key
       that is always empty. vitest's toEqual would have hidden the difference;
       two existing round-trip assertions did not. */
    ...(designId ? { designId } : {}),
    country: countryOf(params.get('n')),
    savedAt: now.toISOString(),
  };
}

/**
 * A short public reference, derived from the design itself.
 *
 * Deterministic, so the same floor always prints the same reference and two
 * people looking at one share link are looking at the same thing when they
 * read it out. Not an id in a database and not a secret — it is a label on a
 * design board and on the note the estimator reads before knocking.
 */
export function studioRef(design: StudioDesign): string {
  const code = encodeDesignContent(design);
  let hash = 0x811c9dc5;
  for (let i = 0; i < code.length; i += 1) {
    hash ^= code.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `FS-${hash.toString(36).toUpperCase().padStart(7, '0').slice(-7)}`;
}

/* ── persistence ──────────────────────────────────────────────────────────── */

/**
 * Save, and mirror into `ew-design-v1` so every existing consumer sees it.
 *
 * The mirror writes the RATE KEY as the species, because that is what v1 has
 * always carried and what /design's querystring and EstimateForm's chip expect.
 */
export function saveStudioDesign(design: StudioDesign): void {
  if (typeof window === 'undefined') return;
  /* The design becomes real here, so this is where it gets its id. Minting in
     an effect or a handler rather than during render is deliberate: two server
     renders would mint two ids and React would report a hydration mismatch. */
  const full: StudioDesign = {
    ...design,
    designId: ensureDesignId(design.designId),
    savedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STUDIO_CONFIG_KEY, JSON.stringify(full));
  } catch {
    /* private mode, storage full — the querystring still carries the design */
  }
  const product = productById(design.config.productId);
  if (product) {
    saveDesignConfig({
      species: product.rateKey,
      finish: design.config.finishId,
      pattern: design.config.patternId,
      sqft: clampSqft(design.squareFeet),
    });
  }
}

export function readStudioDesign(now = Date.now()): StudioDesign | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STUDIO_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudioDesign>;
    if (!parsed.config || !parsed.savedAt || typeof parsed.squareFeet !== 'number') return null;
    if (!isLayable(parsed.config as FloorConfiguration)) return null;
    if (now - Date.parse(parsed.savedAt) > MAX_AGE_MS) return null;
    return {
      config: parsed.config as FloorConfiguration,
      squareFeet: clampSqft(parsed.squareFeet),
      feels: Array.isArray(parsed.feels) ? parsed.feels.filter((f): f is FeelTag => isFeelTag(String(f))) : [],
      roomTypeId: parsed.roomTypeId && roomTypeById(parsed.roomTypeId) ? parsed.roomTypeId : undefined,
      room: parsed.room,
      budgetCad: typeof parsed.budgetCad === 'number' && parsed.budgetCad > 0 ? parsed.budgetCad : undefined,
      /* A design saved before MEAS-01 has none. It is not minted here — that
         would hand a new id to a design every time the page merely READS it.
         `saveStudioDesign` mints, on the next edit. */
      ...(designIdOf(parsed.designId) ? { designId: designIdOf(parsed.designId) } : {}),
      country: countryOf(typeof parsed.country === 'string' ? parsed.country : null),
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearStudioDesign(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STUDIO_CONFIG_KEY);
  } catch {
    /* nothing to do */
  }
}

export const emptyStudioDesign = (now = new Date(), country: PriceCountry = 'CA'): StudioDesign => ({
  config: DEFAULT_CONFIGURATION,
  squareFeet: 900,
  feels: [],
  country,
  savedAt: now.toISOString(),
});

/* ── what a person and an estimator read ──────────────────────────────────── */

/** One line for the chip, the email and the estimator's note. */
export function describeStudioDesign(design: StudioDesign): string {
  const parts = [describeConfiguration(design.config), `~${design.squareFeet.toLocaleString('en-CA')} sq ft`];
  const roomType = design.roomTypeId ? roomTypeById(design.roomTypeId) : undefined;
  if (roomType) parts.push(roomType.label);
  return parts.join(' · ');
}

/**
 * The note that reaches the estimating desk. Structured, and short enough that
 * somebody reads it before they knock on the door.
 */
export function studioLeadNote(design: StudioDesign): string {
  const estimate = priceConfiguration(design.config, design.squareFeet, design.country);
  const lines = [
    design.designId
      ? `Floor Studio ${studioRef(design)} · design ${formatDesignId(design.designId)}`
      : `Floor Studio ${studioRef(design)}`,
    describeStudioDesign(design),
    `Estimated installed range at ${estimate.perSqftCad} — ESTIMATE, fixed in writing after the measure.`,
  ];
  if (design.feels.length) lines.push(`They asked for: ${design.feels.join(', ')}.`);
  if (design.room) {
    lines.push(
      `Their photo read as: ${design.room.lightLevel} light, ${design.room.wallUndertone} walls, ${design.room.existingFloorTone} existing floor.`,
    );
  }
  lines.push(`Priced against the ${design.country === 'US' ? 'United States' : 'Ontario'} bands, in ${estimate.currency}.`);
  if (design.budgetCad) {
    lines.push(`Budget they typed: ${design.budgetCad.toLocaleString('en-CA')} ${estimate.currency}.`);
  }
  return lines.join('\n');
}

/* ── the exits ────────────────────────────────────────────────────────────── */

/** The studio itself, carrying a design. This is the share link. */
export const studioHref = (design: StudioDesign): string =>
  `/floor-studio?${encodeStudioDesign(design)}`;

/**
 * The estimate form, with the design attached as structured data.
 *
 * `design` is the share code, which /api/leads stores verbatim and the
 * estimating desk can paste back into the studio to see exactly what the
 * visitor was looking at. `sqft` and `service` prefill the form's own fields.
 */
export function estimateHref(design: StudioDesign, service = 'installation'): string {
  const params = new URLSearchParams({
    design: encodeStudioDesign(design),
    sqft: String(design.squareFeet),
    service,
    source: 'floor-studio',
    /* The estimating desk has to know which band set produced the figure the
       visitor was looking at, or the fixed price will be written against the
       wrong one. GEO-006. */
    region: design.country,
  });
  /* Its own parameter as well as being inside `design`. The form posts it as a
     first-class field so /api/leads never has to parse the share code to find
     it, and so a code that fails validation still yields the join key rather
     than losing the lead's origin along with its configuration. */
  if (design.designId) params.set('did', design.designId);
  return `/estimate?${params.toString()}#form`;
}

/** The advanced configurator, on the same floor. */
export function designHref(design: StudioDesign): string {
  const product = productById(design.config.productId);
  const params = new URLSearchParams({
    species: product?.rateKey ?? 'white oak',
    finish: design.config.finishId,
    pattern: design.config.patternId,
    sqft: String(design.squareFeet),
  });
  return `/design?${params.toString()}`;
}

/** Every room type, for the verification screen. Re-exported so one import. */
export { ROOM_TYPES };
