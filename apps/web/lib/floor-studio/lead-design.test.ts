/**
 * lead-design.test.ts — SALE-01.
 *
 * The contract test near the bottom is the one that earns its place: the
 * notes-fallback parser and the code that WRITES the note live in two
 * different files, and a silent disagreement between them would look exactly
 * like "this old lead had no design".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NOTES_PREFIX, designCodeFor, designFor, speciesFromDesign } from './lead-design';
import { encodeStudioDesign, type StudioDesign } from './studio-config';
import { newDesignId } from './design-id';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const design = (over: Partial<StudioDesign> = {}): StudioDesign => ({
  config: { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' },
  squareFeet: 900,
  feels: [],
  country: 'CA',
  savedAt: '2026-09-13T00:00:00.000Z',
  ...over,
});

const CODE = encodeStudioDesign(design());

describe('finding the code', () => {
  it('prefers the column', () => {
    expect(designCodeFor({ designCode: CODE, notes: `${NOTES_PREFIX}c=other.x.y.z` })).toBe(CODE);
  });

  it('falls back to the note, for every lead written before SALE-01', () => {
    expect(designCodeFor({ notes: `${NOTES_PREFIX}${CODE}` })).toBe(CODE);
  });

  it('finds it below the visitor’s own message, where /api/leads puts it', () => {
    const notes = `We are renovating the whole main floor.\n\n${NOTES_PREFIX}${CODE}`;
    expect(designCodeFor({ notes })).toBe(CODE);
  });

  it('stops at the newline, so an estimator’s own comment is not swallowed', () => {
    /* `notes` is free text an estimator types into. Reading to the end of the
       field would fold their note into the code and decode nothing. */
    const notes = `${NOTES_PREFIX}${CODE}\nCalled 14:30, wants to start in March.`;
    expect(designCodeFor({ notes })).toBe(CODE);
  });

  it('returns null for the ordinary lead that carried no design', () => {
    expect(designCodeFor({})).toBeNull();
    expect(designCodeFor({ notes: 'Phoned in. Wants stairs done.' })).toBeNull();
    expect(designCodeFor({ designCode: null, notes: null })).toBeNull();
    expect(designCodeFor({ notes: NOTES_PREFIX })).toBeNull();
  });
});

describe('decoding it', () => {
  it('comes back as the floor the visitor chose', () => {
    const back = designFor({ designCode: CODE });
    expect(back?.config.productId).toBe('white-oak');
    expect(back?.squareFeet).toBe(900);
  });

  it('carries the design id through to the estimator’s screen', () => {
    const id = newDesignId();
    expect(designFor({ designCode: encodeStudioDesign(design({ designId: id })) })?.designId).toBe(id);
  });

  it('returns null for a floor we no longer lay', () => {
    /* The estimator must see "we cannot say what this was" rather than a
       confident description of something that cannot be bought. */
    expect(designFor({ designCode: 'c=unobtainium.satin.straight.5&a=900' })).toBeNull();
  });

  it('returns null for junk rather than throwing on an admin page', () => {
    expect(designFor({ designCode: 'not a code' })).toBeNull();
    expect(designFor({ notes: `${NOTES_PREFIX}<script>alert(1)</script>` })).toBeNull();
  });
});

describe('seeding the species column', () => {
  it('derives one species from the design', () => {
    expect(speciesFromDesign(design(), () => 'white oak')).toEqual(['white oak']);
  });

  it('gives nothing when there is no design, rather than an empty array', () => {
    /* An empty array renders as an empty Species row on the admin screen. Null
       renders as nothing, which is the truth. */
    expect(speciesFromDesign(null, () => 'white oak')).toBeNull();
  });

  it('gives nothing when the product is not in the catalogue', () => {
    expect(speciesFromDesign(design(), () => undefined)).toBeNull();
  });
});

describe('the two files that must agree', () => {
  it('/api/leads writes the exact prefix this module reads', () => {
    /* A silent disagreement here looks identical to "that old lead had no
       design", which is the kind of wrong answer nobody goes looking for. */
    expect(read('app/api/leads/route.ts')).toContain(NOTES_PREFIX);
  });

  it('/api/leads also persists the code as a column', () => {
    expect(read('app/api/leads/route.ts')).toContain('designCode:');
  });

  it('the admin quote screen decodes it — the thing PG0 found nowhere', () => {
    const page = read('app/admin/quotes/[id]/page.tsx');
    expect(page).toContain('StudioDesignCard');
    const card = read('app/admin/quotes/[id]/StudioDesignCard.tsx');
    expect(card).toContain('designFor');
    expect(card).toContain('studioHref');
  });

  it('the card prices with the same function the visitor saw', () => {
    /* An estimator quoting against a different number than the one on the
       customer's screen is the argument that row exists to prevent. */
    expect(read('app/admin/quotes/[id]/StudioDesignCard.tsx')).toContain('priceConfiguration');
  });

  it('the card never renders a room image', () => {
    /* Floor Studio reads photos in the browser and retains none. There is no
       room to show, and inventing one would put an estimator in front of a
       picture of a house that does not exist. */
    const card = read('app/admin/quotes/[id]/StudioDesignCard.tsx');
    expect(card).not.toContain('<img');
    expect(card).not.toContain('next/image');
  });
});
