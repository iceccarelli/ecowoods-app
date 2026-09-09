/**
 * lib/equipment/power.ts — will this machine actually run in this house?
 *
 * WHY THIS IS THE PRODUCT AND A PRICE COMPARISON IS NOT
 *
 * Nobody in this trade publishes machine prices — Lägler, Bona and American
 * Sanders all withhold them, and a comparison built on dealer quotes would be a
 * comparison of who answered the phone. Nobody publishes productivity either:
 * there is no manufacturer figure in square feet per hour for any machine in
 * content/equipment/machines.ts, so an ROI model would be arithmetic performed
 * on a guess.
 *
 * What IS published, precisely and in every manufacturer's own documents, is
 * electrical requirement. And that is the constraint that actually decides a
 * job in this city:
 *
 *   · A Bona Belt or Belt UX needs a 30 A / 230 V twist-lock connector. That is
 *     a dedicated circuit. It is not a receptacle any house has spare.
 *   · A Lägler HUMMEL or TRIO needs 220 V.
 *   · An American Sanders EZ-8, Super 7R or B-2 draws 12 A at 115 V — each one
 *     alone is already 80% of a 15 A branch circuit, so a sander and an edger on
 *     the same circuit trips it, every time, and the crew loses the morning.
 *
 * A contractor standing in a 1920s Toronto semi with a 60 A service needs that
 * answer before the truck is loaded, and no manufacturer site gives it, because
 * each one only describes its own machines.
 *
 * WHERE CURRENT IS NOT PUBLISHED
 *
 * Most manufacturers publish power (kW or HP) and a minimum fuse rating, not
 * running current. Deriving amps from watts would mean assuming a power factor
 * and an efficiency this module has no business assuming. So it computes
 * P / V, labels it `minimumAmps`, and says what it is: a FLOOR. A real motor
 * draws more than that. A floor is still decisive — if the floor already
 * exceeds the circuit, the machine certainly will not run.
 *
 * THIS IS NOT AN ELECTRICAL ASSESSMENT. It compares published numbers. The
 * 80% figure below is the conventional continuous-load derating used for
 * branch circuits; whether a given circuit is adequate is a question for
 * somebody licensed to answer it, on site.
 */
import type { Machine, PowerSpec } from '@/content/equipment/machines';

/** Conventional continuous-load derating for a branch circuit. */
export const CONTINUOUS_LOAD_FACTOR = 0.8;

export type Service = {
  /** Nominal voltage at the receptacle. */
  volts: number;
  /** Breaker rating of the circuit the machine would run on. */
  breakerAmps: number;
};

export type Verdict =
  | 'runs'
  | 'runs-at-the-limit'
  | 'needs-dedicated-circuit'
  | 'wrong-voltage'
  | 'over-circuit'
  | 'unknown';

export type Assessment = {
  machineId: string;
  spec: PowerSpec | null;
  verdict: Verdict;
  /** Published running current, where the manufacturer states one. */
  publishedAmps: number | null;
  /** P / V. A lower bound on real draw, never a rating. */
  minimumAmps: number | null;
  /** The current used for the comparison, and where it came from. */
  usedAmps: number | null;
  amperageBasis: 'published' | 'derived-floor' | 'none';
  headroomAmps: number | null;
  reasons: string[];
};

const powerWatts = (spec: PowerSpec): number | null => {
  if (spec.kilowatts !== null) return spec.kilowatts * 1000;
  if (spec.horsepower !== null) return spec.horsepower * 745.7;
  return null;
};

/** Voltages within 10% are the same nominal supply — 220, 230 and 240 are one thing. */
const sameSupply = (a: number, b: number): boolean => Math.abs(a - b) / Math.max(a, b) <= 0.1;

export function assess(machine: Machine, service: Service, region: 'na' | 'eu' = 'na'): Assessment {
  const spec = region === 'na' ? machine.northAmerica : machine.europe;
  const reasons: string[] = [];

  if (!spec) {
    return {
      machineId: machine.id,
      spec: null,
      verdict: 'unknown',
      publishedAmps: null,
      minimumAmps: null,
      usedAmps: null,
      amperageBasis: 'none',
      headroomAmps: null,
      reasons: [
        `${machine.manufacturer} publishes no ${region === 'na' ? 'North American' : 'European'} configuration for the ${machine.model}. Nothing here can be concluded from that except that the number is missing.`,
      ],
    };
  }

  const watts = powerWatts(spec);
  const minimumAmps = watts === null ? null : watts / spec.volts;
  const publishedAmps = spec.amps;
  const usedAmps = publishedAmps ?? minimumAmps;
  const amperageBasis: Assessment['amperageBasis'] =
    publishedAmps !== null ? 'published' : minimumAmps !== null ? 'derived-floor' : 'none';

  if (amperageBasis === 'derived-floor') {
    reasons.push(
      `${machine.manufacturer} does not publish running current for this machine. ${minimumAmps!.toFixed(1)} A is the floor implied by its published power at ${spec.volts} V — a real motor draws more.`,
    );
  }

  if (!sameSupply(spec.volts, service.volts)) {
    reasons.push(
      `Built for ${spec.volts} V; the supply described is ${service.volts} V. This is not a matter of headroom — it is the wrong circuit.`,
    );
    return { machineId: machine.id, spec, verdict: 'wrong-voltage', publishedAmps, minimumAmps, usedAmps, amperageBasis, headroomAmps: null, reasons };
  }

  if (spec.connector) {
    reasons.push(
      `Requires a ${spec.connector}. That is a dedicated circuit and a specific receptacle, not something a finished house has spare.`,
    );
  }

  if (usedAmps === null) {
    reasons.push('No current and no power figure is published, so no load comparison is possible.');
    return { machineId: machine.id, spec, verdict: 'unknown', publishedAmps, minimumAmps, usedAmps, amperageBasis, headroomAmps: null, reasons };
  }

  const continuousLimit = service.breakerAmps * CONTINUOUS_LOAD_FACTOR;
  const headroomAmps = continuousLimit - usedAmps;

  let verdict: Verdict;
  if (usedAmps > service.breakerAmps) {
    verdict = 'over-circuit';
    reasons.push(`Draws more than the ${service.breakerAmps} A breaker on its own.`);
  } else if (usedAmps > continuousLimit) {
    verdict = spec.connector ? 'needs-dedicated-circuit' : 'runs-at-the-limit';
    reasons.push(
      `${usedAmps.toFixed(1)} A against a ${service.breakerAmps} A breaker is above the ${Math.round(CONTINUOUS_LOAD_FACTOR * 100)}% continuous-load figure (${continuousLimit.toFixed(1)} A). It may run and it is not a circuit to share.`,
    );
  } else {
    verdict = spec.connector ? 'needs-dedicated-circuit' : 'runs';
    reasons.push(
      `${usedAmps.toFixed(1)} A against a ${service.breakerAmps} A breaker leaves ${headroomAmps.toFixed(1)} A before the continuous-load figure.`,
    );
  }

  return { machineId: machine.id, spec, verdict, publishedAmps, minimumAmps, usedAmps, amperageBasis, headroomAmps, reasons };
}

export type CircuitResult = {
  breakerAmps: number;
  continuousLimitAmps: number;
  totalAmps: number;
  /** True where every machine's figure is a published one. */
  allPublished: boolean;
  overContinuous: boolean;
  overBreaker: boolean;
  note: string;
};

/**
 * Everything on one circuit at once.
 *
 * This is the question that costs a morning: a sander and an edger both drawing
 * 12 A on one 15 A kitchen circuit is 24 A, and it does not matter that each
 * one is individually fine.
 */
export function circuitLoad(
  machines: Machine[],
  service: Service,
  region: 'na' | 'eu' = 'na',
): CircuitResult {
  const assessments = machines.map((m) => assess(m, service, region));
  const totalAmps = assessments.reduce((n, a) => n + (a.usedAmps ?? 0), 0);
  const continuousLimitAmps = service.breakerAmps * CONTINUOUS_LOAD_FACTOR;
  const allPublished = assessments.every((a) => a.amperageBasis === 'published');

  const overBreaker = totalAmps > service.breakerAmps;
  const overContinuous = totalAmps > continuousLimitAmps;

  const note = overBreaker
    ? `${totalAmps.toFixed(1)} A on one ${service.breakerAmps} A circuit. This trips.`
    : overContinuous
      ? `${totalAmps.toFixed(1)} A is inside the ${service.breakerAmps} A breaker but above the ${continuousLimitAmps.toFixed(1)} A continuous figure. Expect nuisance trips under load.`
      : `${totalAmps.toFixed(1)} A against a ${continuousLimitAmps.toFixed(1)} A continuous figure.`;

  return { breakerAmps: service.breakerAmps, continuousLimitAmps, totalAmps, allPublished, overContinuous, overBreaker, note };
}
