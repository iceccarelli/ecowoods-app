import { describe, it, expect } from 'vitest';
import { MACHINES, machineById } from '@/content/equipment/machines';
import { assess, circuitLoad, CONTINUOUS_LOAD_FACTOR } from './power';

/**
 * These assert the two things that matter: that the registry keeps its
 * provenance promises, and that the load arithmetic gives the answer a
 * contractor would get with a clamp meter and a calculator.
 *
 * There is no test asserting a price or a productivity figure, because there is
 * no such published figure to assert against — see the header of
 * content/equipment/machines.ts.
 */

const HOUSE_15A = { volts: 120, breakerAmps: 15 };
const HOUSE_20A = { volts: 120, breakerAmps: 20 };
const DEDICATED_240 = { volts: 240, breakerAmps: 30 };

describe('registry provenance', () => {
  it('gives every published power spec a source URL and a verification date', () => {
    for (const m of MACHINES) {
      for (const spec of [m.northAmerica, m.europe]) {
        if (!spec) continue;
        expect(spec.source.url, `${m.id} power source`).toMatch(/^https:\/\//);
        expect(spec.source.verifiedAt, `${m.id} verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      if (m.weightKg !== null) expect(m.weightSource, `${m.id} weight needs a source`).not.toBeNull();
    }
  });

  it('carries no price field anywhere — no manufacturer publishes one', () => {
    const serialized = JSON.stringify(MACHINES);
    expect(serialized).not.toMatch(/"price/i);
    expect(serialized).not.toMatch(/\$\d/);
  });

  it('carries no productivity figure — no manufacturer publishes one', () => {
    const serialized = JSON.stringify(MACHINES).toLowerCase();
    expect(serialized).not.toContain('sqfthr');
    expect(serialized).not.toContain('sqftperhour');
    expect(serialized).not.toContain('m2perhour');
  });

  it('records the manufacturers’ own contradictions instead of resolving them', () => {
    const ez8 = machineById('american-sanders-ez-8')!;
    expect(ez8.conflicts.join(' ')).toContain('125 lb');
    const beltUx = machineById('bona-belt-ux')!;
    expect(beltUx.conflicts.length).toBeGreaterThanOrEqual(2);
  });
});

describe('one machine on one circuit', () => {
  it('runs an EZ-8 on a household circuit, at the limit', () => {
    const a = assess(machineById('american-sanders-ez-8')!, HOUSE_15A);
    // 12 A published against 15 A × 0.8 = 12 A continuous — exactly at it.
    expect(a.publishedAmps).toBe(12);
    expect(a.amperageBasis).toBe('published');
    expect(a.verdict).toBe('runs');
    expect(a.headroomAmps).toBeCloseTo(0, 5);
  });

  it('gives the same machine real headroom on a 20 A circuit', () => {
    const a = assess(machineById('american-sanders-ez-8')!, HOUSE_20A);
    expect(a.headroomAmps).toBeCloseTo(4, 5);
    expect(a.verdict).toBe('runs');
  });

  it('refuses a 230 V belt sander on a 120 V receptacle for the right reason', () => {
    const a = assess(machineById('bona-belt-ux')!, HOUSE_15A);
    expect(a.verdict).toBe('wrong-voltage');
    expect(a.reasons.join(' ')).toContain('wrong circuit');
  });

  it('flags the Bona twist-lock as a dedicated circuit even when the load fits', () => {
    const a = assess(machineById('bona-belt-ux')!, DEDICATED_240);
    expect(a.verdict).toBe('needs-dedicated-circuit');
    expect(a.reasons.join(' ')).toContain('30 A 230 V twist-lock');
  });

  it('labels a derived current as a floor, never as a rating', () => {
    const a = assess(machineById('laegler-hummel')!, { volts: 220, breakerAmps: 20 });
    expect(a.publishedAmps).toBeNull();
    expect(a.amperageBasis).toBe('derived-floor');
    // 2.9 kW / 220 V = 13.18 A — a lower bound, and the copy says so.
    expect(a.minimumAmps!).toBeCloseTo(13.18, 1);
    expect(a.reasons.join(' ')).toContain('floor implied by its published power');
  });

  it('says so plainly when a region has no published configuration', () => {
    const a = assess(machineById('bona-edge-ux')!, HOUSE_15A, 'na');
    expect(a.verdict).toBe('unknown');
    expect(a.spec).toBeNull();
    expect(a.reasons.join(' ')).toContain('publishes no North American configuration');
  });
});

describe('two machines on one circuit — the morning-losing case', () => {
  it('trips a 15 A circuit with a sander and an edger together', () => {
    const result = circuitLoad(
      [machineById('american-sanders-ez-8')!, machineById('american-sanders-super-7r')!],
      HOUSE_15A,
    );
    expect(result.totalAmps).toBe(24);
    expect(result.overBreaker).toBe(true);
    expect(result.note).toContain('This trips');
    expect(result.allPublished).toBe(true);
  });

  it('is still over the continuous figure on a 20 A circuit', () => {
    const result = circuitLoad(
      [machineById('american-sanders-ez-8')!, machineById('american-sanders-super-7r')!],
      HOUSE_20A,
    );
    expect(result.overBreaker).toBe(true);
    expect(result.continuousLimitAmps).toBe(16);
  });

  it('fits a single edger and the dust extractor on a 30 A circuit', () => {
    const result = circuitLoad(
      [machineById('american-sanders-super-7r')!, machineById('bona-dcs-50')!],
      { volts: 120, breakerAmps: 30 },
    );
    expect(result.totalAmps).toBe(27);
    expect(result.overBreaker).toBe(false);
    expect(result.overContinuous).toBe(true);
  });

  it('uses the conventional continuous-load factor and nothing invented', () => {
    expect(CONTINUOUS_LOAD_FACTOR).toBe(0.8);
    expect(circuitLoad([], HOUSE_15A).continuousLimitAmps).toBe(12);
  });
});
