/**
 * lib/floor-studio/design-id.ts — the join key this site has never had.
 *
 * THE PROBLEM, EXACTLY
 *
 * PG0 established that no dollar of revenue in this database can be traced to
 * the tool that produced it. The audit found no UTM capture, no session id and
 * no visitor id; the only `utm_` strings in the repository are OUTBOUND credit
 * links to Unsplash, so the site attributes other people and captures nothing
 * for itself.
 *
 * The near miss is worse than the absence. `encodeStudioDesign` already
 * travels from the studio to /api/leads, and it looks like an identifier. It is
 * not one. It is DETERMINISTIC — two strangers who both pick white oak, satin,
 * herringbone, 5", 900 sq ft produce a byte-identical string. Joining on it
 * would silently merge unrelated people into one "design", and the merge would
 * grow with the popularity of the floor: the better a floor sells, the more
 * wrong the number. `studioRef()` inherits the same property, on purpose, and
 * that purpose is sound — a shared link should print the same FS- reference on
 * two screens.
 *
 * So the identity has to be minted, not derived.
 *
 * WHAT THIS IS, AND WHAT IT IS CAREFULLY NOT
 *
 * It identifies A DESIGN. Not a person, not a browser, not a session.
 *
 *   - It is random. It is not derived from the configuration (which would
 *     collide, as above) and not derived from anything about the device
 *     (which would be a fingerprint — a different product, built by accident).
 *   - It carries no timestamp. A timestamp would pin the design to a moment
 *     and hand a correlator a free extra field for nothing in return.
 *   - It is not a secret and is not used for access control. Nothing is
 *     authorised by holding one; it is a label that two records can be joined
 *     on.
 *   - It never touches a room photograph. Floor Studio analyses photos in the
 *     browser and retains none, and MEAS-01 does not change that by one line.
 *     The brief's own privacy requirement calls that stance a strategic
 *     advantage; an identifier that reached a photo would spend it.
 *
 * A SHARED LINK DELIBERATELY SHARES THE ID
 *
 * Hand a link to a spouse, a designer or a realtor and they open the same
 * design id. That is not a leak, it is the feature: Program 1 asks for design
 * collaboration — "share, compare, spouse/family, designer, realtor, internal
 * estimator" — and the thing being collaborated on is the DESIGN. Two people
 * looking at one floor are one design, and when either of them asks for a
 * measure, the lead joins back to the studio work that produced it. Because
 * the id names a design rather than a person, this is also why it can be
 * shared without telling the recipient anything about the sender.
 *
 * The cost is stated plainly so nobody reads the number wrong: a design id
 * counts DESIGNS THAT CONVERTED, not people who converted. Where those differ
 * — a link passed around a family — they differ in the direction of
 * undercounting sessions, never of inventing them.
 */

/**
 * Crockford base32, lowercase. I, L, O and U are absent, so a reference read
 * down a phone line to the estimating desk cannot become a different one.
 */
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

/** 12 chars × 5 bits = 60 bits. */
export const DESIGN_ID_LENGTH = 12;

const PATTERN = new RegExp(`^[${ALPHABET}]{${DESIGN_ID_LENGTH}}$`);

/**
 * Mint one.
 *
 * `crypto.getRandomValues` where it exists — every browser this site supports,
 * and Node 18+. The `Math.random` branch is a last resort that changes the
 * COLLISION ODDS and nothing else, because this value protects nothing. It is
 * reached only where `crypto` is absent, and it is better than refusing to
 * mint: a design with no id is a design that cannot be joined to its revenue,
 * which is the entire failure this module exists to end.
 *
 * MUST NOT BE CALLED DURING SERVER RENDER. Two renders produce two ids, and
 * React would report a hydration mismatch on the first paint of a page that
 * embeds one. Call it from an effect or an event handler. `ensureDesignId`
 * below is the guarded way in.
 */
export function newDesignId(): string {
  const out: string[] = [];
  const g = (globalThis as { crypto?: Crypto }).crypto;
  if (g?.getRandomValues) {
    const bytes = new Uint8Array(DESIGN_ID_LENGTH);
    g.getRandomValues(bytes);
    for (let i = 0; i < DESIGN_ID_LENGTH; i += 1) out.push(ALPHABET[bytes[i]! % 32]!);
  } else {
    for (let i = 0; i < DESIGN_ID_LENGTH; i += 1) {
      out.push(ALPHABET[Math.floor(Math.random() * 32)]!);
    }
  }
  return out.join('');
}

/**
 * Is this a design id we minted?
 *
 * Anything arriving from a querystring, a form post or a database row goes
 * through here first. A malformed value is DROPPED rather than stored: a
 * `designId` column holding arbitrary visitor-supplied text is a column that
 * will eventually be rendered somewhere, and the whole value of this field is
 * that it joins to something. Length and alphabet are both checked, so the
 * upper bound on what can reach the database through this path is 12 chars
 * from a 32-symbol set.
 */
export function isDesignId(value: unknown): value is string {
  return typeof value === 'string' && PATTERN.test(value);
}

/** The validated value, or undefined. Never throws, never coerces. */
export const designIdOf = (value: unknown): string | undefined =>
  isDesignId(value) ? value : undefined;

/**
 * The id this design should carry — the one it already has, or a new one.
 *
 * Idempotent: an existing valid id is returned untouched, so editing a design
 * for twenty minutes does not fracture it into twenty ids. An invalid one is
 * replaced rather than repaired, because a value that fails `isDesignId` did
 * not come from us and joining on it would be joining on noise.
 */
export const ensureDesignId = (existing: unknown): string =>
  designIdOf(existing) ?? newDesignId();

/**
 * How it reads to a human — on a spec sheet, in the estimator's inbox, on the
 * note someone writes on the back of a sample.
 *
 * Grouped in fours because a 12-character string read aloud is a string that
 * gets read back wrong. This is presentation only; the stored and transmitted
 * value is always the bare 12 characters.
 */
export const formatDesignId = (id: string): string =>
  isDesignId(id) ? `EW-${id.slice(0, 4)}-${id.slice(4, 8)}-${id.slice(8, 12)}`.toUpperCase() : '';

/** The inverse of `formatDesignId`, forgiving of case, spaces and dashes. */
export function parseDesignId(input: string): string | undefined {
  const stripped = input.trim().toLowerCase().replace(/^ew-/, '').replace(/[\s-]/g, '');
  return designIdOf(stripped);
}
