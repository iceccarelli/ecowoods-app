/**
 * design-id.test.ts — MEAS-01.
 *
 * The first test is the one that matters. It proves, rather than asserts, the
 * claim the whole patch rests on: the share code cannot be used as a join key,
 * because it collides across unrelated people. If that test ever fails,
 * MEAS-01 was unnecessary and this file should be deleted.
 */
import { describe, expect, it } from 'vitest';
import {
  DESIGN_ID_LENGTH,
  designIdOf,
  ensureDesignId,
  formatDesignId,
  isDesignId,
  newDesignId,
  parseDesignId,
} from './design-id';
import {
  decodeStudioDesign,
  encodeStudioDesign,
  estimateHref,
  studioRef,
  type StudioDesign,
} from './studio-config';

const base = (over: Partial<StudioDesign> = {}): StudioDesign => ({
  config: { productId: 'white-oak', finishId: 'satin', patternId: 'straight', widthId: '5' },
  squareFeet: 900,
  feels: [],
  country: 'CA',
  savedAt: '2026-09-12T00:00:00.000Z',
  ...over,
});

describe('why a minted id was necessary', () => {
  it('two unrelated people who choose the same floor produce the SAME share code', () => {
    /* This is the bug MEAS-01 exists to route around. Not a hypothetical: the
       `design` field already travels to /api/leads, and it looks like an id. */
    const alice = base({ savedAt: '2026-01-01T00:00:00.000Z' });
    const bob = base({ savedAt: '2026-07-14T09:30:00.000Z' });
    expect(encodeStudioDesign(alice)).toBe(encodeStudioDesign(bob));
    expect(studioRef(alice)).toBe(studioRef(bob));
  });

  it('but they get different design ids', () => {
    const alice = base({ designId: newDesignId() });
    const bob = base({ designId: newDesignId() });
    expect(alice.designId).not.toBe(bob.designId);
    expect(encodeStudioDesign(alice)).not.toBe(encodeStudioDesign(bob));
  });
});

describe('minting', () => {
  it('is the documented length and alphabet', () => {
    const id = newDesignId();
    expect(id).toHaveLength(DESIGN_ID_LENGTH);
    expect(isDesignId(id)).toBe(true);
  });

  it('excludes i, l, o and u so a reference read aloud cannot become another', () => {
    /* 20k characters is enough that a 4-in-36 alphabet slip would be certain. */
    const sample = Array.from({ length: 2000 }, () => newDesignId()).join('');
    expect(sample).not.toMatch(/[ilou]/);
  });

  it('does not collide across 20,000 mints', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i += 1) seen.add(newDesignId());
    expect(seen.size).toBe(20_000);
  });

  it('is not derived from the design — the same design mints different ids', () => {
    expect(newDesignId()).not.toBe(newDesignId());
  });
});

describe('validation — a value we did not mint joins to nothing', () => {
  /* Written as a loop rather than it.each so that every value is genuinely
     exercised under any runner. An it.each whose arguments arrive as one array
     instead of spread still goes green — for the wrong reason — and a
     validation test that passes for the wrong reason is worse than no test. */
  it('rejects every malformed shape', () => {
    const bad: [unknown, string][] = [
      ['', 'empty'],
      ['abc', 'too short'],
      ['abcdefghjkmnp', 'too long'],
      ['abcdefghjkmi', 'contains i'],
      ['abcdefghjkml', 'contains l'],
      ['abcdefghjkmo', 'contains o'],
      ['abcdefghjkmu', 'contains u'],
      ['ABCDEFGHJKMN', 'uppercase'],
      ['abcdefghjk-n', 'punctuation'],
      ['abcdefghjk n', 'whitespace'],
      ["'; drop table", 'sql-ish'],
      ['<script>xx', 'html-ish'],
      [null, 'null'],
      [undefined, 'undefined'],
      [42, 'number'],
      [{}, 'object'],
      [[], 'array'],
      [true, 'boolean'],
    ];
    for (const [value, label] of bad) {
      expect(isDesignId(value), label).toBe(false);
      expect(designIdOf(value), label).toBeUndefined();
    }
  });

  it('caps what can reach the database at 12 characters from 32 symbols', () => {
    const long = 'a'.repeat(5000);
    expect(designIdOf(long)).toBeUndefined();
  });
});

describe('ensureDesignId is idempotent', () => {
  it('keeps a valid id, so a long editing session stays one design', () => {
    const id = newDesignId();
    expect(ensureDesignId(id)).toBe(id);
    expect(ensureDesignId(ensureDesignId(ensureDesignId(id)))).toBe(id);
  });

  it('replaces an invalid one rather than repairing it', () => {
    const out = ensureDesignId('NOT-AN-ID');
    expect(isDesignId(out)).toBe(true);
    expect(out).not.toBe('NOT-AN-ID');
  });

  it('mints when there is nothing', () => {
    expect(isDesignId(ensureDesignId(undefined))).toBe(true);
  });
});

describe('the human-readable form', () => {
  it('groups in fours and round-trips', () => {
    const id = newDesignId();
    const shown = formatDesignId(id);
    expect(shown).toMatch(/^EW-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(parseDesignId(shown)).toBe(id);
  });

  it('forgives how a person actually types it back', () => {
    const id = 'a1b2c3d4e5f6';
    expect(parseDesignId('EW-A1B2-C3D4-E5F6')).toBe(id);
    expect(parseDesignId('  ew-a1b2-c3d4-e5f6  ')).toBe(id);
    expect(parseDesignId('A1B2 C3D4 E5F6')).toBe(id);
    expect(parseDesignId('a1b2c3d4e5f6')).toBe(id);
  });

  it('returns nothing for a value that is not an id', () => {
    expect(formatDesignId('nope')).toBe('');
    expect(parseDesignId('EW-XXXX')).toBeUndefined();
  });
});

describe('the id survives the journey', () => {
  it('round-trips through the share code', () => {
    const design = base({ designId: newDesignId() });
    const back = decodeStudioDesign(encodeStudioDesign(design));
    expect(back?.designId).toBe(design.designId);
  });

  it('is dropped from a share code when it is not one of ours', () => {
    const code = `${encodeStudioDesign(base())}&d=NOT-AN-ID`;
    expect(decodeStudioDesign(code)?.designId).toBeUndefined();
  });

  it('reaches the estimate form as its own parameter, not only inside design', () => {
    const design = base({ designId: newDesignId() });
    const href = estimateHref(design);
    const params = new URLSearchParams(href.split('?')[1]!.replace('#form', ''));
    expect(params.get('did')).toBe(design.designId);
    /* and inside the design code too, so a shared link carries it */
    expect(decodeStudioDesign(params.get('design')!)?.designId).toBe(design.designId);
  });

  it('omits the parameter entirely for a design that has no id', () => {
    expect(estimateHref(base())).not.toContain('did=');
    expect(encodeStudioDesign(base())).not.toContain('d=');
  });
});

describe('what MEAS-01 must not have broken', () => {
  it('the FS- reference is still a property of the FLOOR, not of the id', () => {
    /* Two people on one share link must read the same reference aloud. If the
       id entered the hash, every mint would rename an unchanged floor. */
    const withA = base({ designId: newDesignId() });
    const withB = base({ designId: newDesignId() });
    expect(studioRef(withA)).toBe(studioRef(withB));
    expect(studioRef(withA)).toBe(studioRef(base()));
  });

  it('a design saved before MEAS-01 still decodes', () => {
    const legacy = 'c=white-oak.satin.straight.5&a=900';
    const back = decodeStudioDesign(legacy);
    expect(back).not.toBeNull();
    expect(back?.designId).toBeUndefined();
  });

  it('the id is not a person — a shared link deliberately carries the same one', () => {
    const mine = base({ designId: newDesignId() });
    const theirs = decodeStudioDesign(encodeStudioDesign(mine));
    expect(theirs?.designId).toBe(mine.designId);
  });
});
