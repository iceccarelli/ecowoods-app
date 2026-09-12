/**
 * The handoff, asserted.
 *
 * The promise Floor Studio makes is "you will not retype this", and a handoff
 * that silently drops a field breaks that promise at the exact moment the
 * visitor is deciding whether to let us into their house. So the round trip is
 * tested field by field, and the refusals — a floor we do not lay, a stale
 * record, a garbage code — are tested too.
 */
import { describe, expect, it } from 'vitest';
import {
  SQFT_MAX,
  SQFT_MIN,
  decodeStudioDesign,
  describeStudioDesign,
  designHref,
  emptyStudioDesign,
  encodeStudioDesign,
  estimateHref,
  roomFactsFrom,
  studioHref,
  studioLeadNote,
  studioRef,
  type StudioDesign,
} from './studio-config';
import { isLayable, priceConfiguration } from './catalog';

const AT = new Date('2026-09-11T12:00:00.000Z');

const design: StudioDesign = {
  config: { productId: 'black-walnut', finishId: 'wire-brushed', patternId: 'herringbone', widthId: '5' },
  squareFeet: 1200,
  feels: ['luxurious', 'dramatic'],
  roomTypeId: 'living',
  room: { lightLevel: 'bright', wallUndertone: 'warm', existingFloorTone: 'mid' },
  budgetCad: 24000,
  /* GEO-006: every design says which published bands it is priced against, and
     the home country is the default so no older shared link changed meaning. */
  country: 'CA',
  savedAt: AT.toISOString(),
};

describe('the share code round-trips', () => {
  it('returns every field it was given', () => {
    const back = decodeStudioDesign(encodeStudioDesign(design), AT)!;
    expect(back).toEqual(design);
  });

  it('survives a leading question mark, as a pasted URL fragment has', () => {
    const back = decodeStudioDesign(`?${encodeStudioDesign(design)}`, AT)!;
    expect(back.config).toEqual(design.config);
  });

  it('is readable rather than an opaque blob', () => {
    const code = encodeStudioDesign(design);
    expect(code).toContain('black-walnut');
    expect(code).toContain('herringbone');
    expect(code).not.toMatch(/^[A-Za-z0-9+/=]{40,}$/);
  });

  it('carries no photograph and nothing personal', () => {
    const code = encodeStudioDesign(design);
    expect(code).not.toMatch(/data:|base64|image|photo/i);
    expect(code.length).toBeLessThan(200);
  });

  it('omits what was never set', () => {
    const bare = encodeStudioDesign({ ...emptyStudioDesign(AT) });
    expect(bare).not.toContain('f=');
    expect(bare).not.toContain('b=');
    expect(bare).not.toContain('l=');
  });
});

describe('the share code refuses what it should refuse', () => {
  it('will not open a floor we do not lay', () => {
    expect(decodeStudioDesign('c=hard-maple.smoked.straight.5&a=900')).toBeNull();
    expect(decodeStudioDesign('c=white-oak.satin.chevron.8-plus&a=900')).toBeNull();
  });

  it('returns null on garbage rather than a default that looks chosen', () => {
    expect(decodeStudioDesign('')).toBeNull();
    expect(decodeStudioDesign('a=900')).toBeNull();
    expect(decodeStudioDesign('c=nonsense&a=900')).toBeNull();
  });

  it('clamps an area somebody typed or tampered with', () => {
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=99999')!.squareFeet).toBe(SQFT_MAX);
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=1')!.squareFeet).toBe(SQFT_MIN);
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=banana')!.squareFeet).toBeGreaterThan(0);
  });

  it('drops a feel it does not recognise instead of failing the whole link', () => {
    const back = decodeStudioDesign('c=white-oak.satin.straight.5&a=900&f=warmer,sparkly')!;
    expect(back.feels).toEqual(['warmer']);
  });

  it('ignores a room reading that is only half there', () => {
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=900&l=bright')!.room).toBeUndefined();
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=900&l=blinding&u=warm&e=mid')!.room).toBeUndefined();
  });

  it('ignores a room type that is not one of ours', () => {
    expect(decodeStudioDesign('c=white-oak.satin.straight.5&a=900&r=dungeon')!.roomTypeId).toBeUndefined();
  });

  it('only ever decodes to a layable floor', () => {
    for (const code of [
      'c=white-oak.satin.herringbone.3-25&a=600',
      'c=hickory.hand-scraped.diagonal.7&a=1500',
      'c=red-oak.smoked.straight.8-plus&a=2000',
    ]) {
      expect(isLayable(decodeStudioDesign(code)!.config)).toBe(true);
    }
  });
});

describe('the reference is a label, not a secret', () => {
  it('is the same for the same design, every time and on every device', () => {
    expect(studioRef(design)).toBe(studioRef({ ...design, savedAt: 'whenever' }));
  });

  it('changes when the floor changes', () => {
    expect(studioRef(design)).not.toBe(
      studioRef({ ...design, config: { ...design.config, finishId: 'satin' } }),
    );
  });

  it('reads as a reference somebody could say out loud', () => {
    expect(studioRef(design)).toMatch(/^FS-[0-9A-Z]{7}$/);
  });
});

describe('no price is ever stored', () => {
  it('keeps inputs, and recomputes the range from the shared estimator', () => {
    /* The only numbers a saved design carries are the ones the VISITOR typed:
       the area and, if they gave one, their budget. No rate, no total, no
       per-square-foot figure — those are recomputed on every render. */
    const back = decodeStudioDesign(encodeStudioDesign(design), AT)!;
    expect(Object.keys(back).filter((k) => /price|estimate|range|cad/i.test(k))).toEqual(['budgetCad']);
    const note = studioLeadNote(design);
    const live = priceConfiguration(design.config, design.squareFeet);
    expect(note).toContain(live.perSqftCad);
  });

  it('labels the figure an estimate wherever it says it', () => {
    expect(studioLeadNote(design)).toMatch(/ESTIMATE, fixed in writing after the measure/);
    expect(studioLeadNote(design)).not.toMatch(/\bquote\b/i);
  });
});

describe('what the estimating desk reads', () => {
  const note = studioLeadNote(design);

  it('leads with the reference and the floor', () => {
    expect(note.split('\n')[0]).toContain(studioRef(design));
    expect(note).toContain('Black Walnut');
    expect(note).toContain('Herringbone');
  });

  it('says what the visitor asked for and what their photo said', () => {
    expect(note).toContain('luxurious');
    expect(note).toMatch(/bright light, warm walls, mid existing floor/);
  });

  it('describes a design in one line naming the floor, the area and the room', () => {
    const line = describeStudioDesign(design);
    expect(line).toContain('1,200 sq ft');
    expect(line).toContain('Living room');
  });
});

describe('the exits carry the design', () => {
  it('hands /estimate the code, the area and the source', () => {
    const href = estimateHref(design);
    expect(href.startsWith('/estimate?')).toBe(true);
    expect(href.endsWith('#form')).toBe(true);
    const params = new URLSearchParams(href.slice('/estimate?'.length, href.indexOf('#')));
    expect(decodeStudioDesign(params.get('design')!, AT)!.config).toEqual(design.config);
    expect(params.get('sqft')).toBe('1200');
    expect(params.get('source')).toBe('floor-studio');
  });

  it('hands /design the querystring it has always used', () => {
    const href = designHref(design);
    const params = new URLSearchParams(href.slice('/design?'.length));
    /* The RATE KEY, not the catalogue id — the contract /design already has. */
    expect(params.get('species')).toBe('walnut');
    expect(params.get('finish')).toBe('wire-brushed');
    expect(params.get('pattern')).toBe('herringbone');
    expect(params.get('sqft')).toBe('1200');
  });

  it('shares back into the studio on the same floor', () => {
    const href = studioHref(design);
    expect(href.startsWith('/floor-studio?')).toBe(true);
    expect(decodeStudioDesign(href.slice('/floor-studio?'.length), AT)).toEqual(design);
  });
});

describe('room facts', () => {
  it('takes the three facts that matter and leaves the photograph behind', () => {
    const facts = roomFactsFrom({
      meanLuminance: 0.4,
      lightLevel: 'balanced',
      wallUndertone: 'cool',
      existingFloorLuminance: 0.2,
      existingFloorTone: 'mid',
      floorQuad: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      floorCoverage: 1,
      floorConfidence: 'measured',
      notes: [],
    });
    expect(facts).toEqual({ lightLevel: 'balanced', wallUndertone: 'cool', existingFloorTone: 'mid' });
    expect(Object.keys(facts)).toHaveLength(3);
  });
});
