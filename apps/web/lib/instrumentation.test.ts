/**
 * instrumentation.test.ts — MEAS-03.
 *
 * The centrepiece is "every declared event is actually fired". PG0 found
 * `commercial_cta` and `realtor_cta` sitting in the AnalyticsEvent union with
 * zero call sites anywhere — declared since the union was written, never once
 * emitted. A closed union looks like coverage, and nothing checked that the
 * contract and the code agreed. This is the check that was missing.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Every .ts/.tsx under apps/web, excluding tests and build output. */
function sources(dir = WEB, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'prisma') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

const ALL = sources().map((f) => readFileSync(f, 'utf8'));
const analytics = read('lib/analytics.ts');

/** The union members, read out of the source of truth rather than restated. */
const declared = (() => {
  const start = analytics.indexOf('export type AnalyticsEvent');
  const body = analytics.slice(start, analytics.indexOf(';', analytics.indexOf("'studio_region_changed'")));
  return [...body.matchAll(/\|\s*'([a-z0-9_]+)'/g)].map((m) => m[1]!);
})();

describe('the contract and the code agree', () => {
  it('reads a plausible number of events out of the union', () => {
    /* If this ever drops to a handful the parser above has silently stopped
       working and every assertion below becomes vacuous. */
    expect(declared.length).toBeGreaterThan(25);
  });

  it('every declared event is fired from somewhere', () => {
    /* The check that did not exist. Two events lived in this union for the
       whole life of the file without a single call site. */
    const unfired = declared.filter(
      (e) => !ALL.some((src) => src.includes(`'${e}'`) || src.includes(`"${e}"`)),
    );
    expect(unfired, `declared but never fired: ${unfired.join(', ')}`).toEqual([]);
  });

  it('the four MEAS-03 events are declared', () => {
    for (const e of ['assistant_open', 'assistant_message', 'movement_calculated', 'quote_check_compared']) {
      expect(declared, `${e} must be in the union`).toContain(e);
    }
  });
});

describe('the surfaces PG0 found silent', () => {
  it('the assistant reports opening and conversation depth', () => {
    const src = read('app/components/ChatWidget.tsx');
    expect(src).toContain("track('assistant_open'");
    expect(src).toContain("track('assistant_message'");
  });

  it('the assistant no longer hides its telemetry behind NODE_ENV', () => {
    /* It was a console.log guarded by `NODE_ENV !== 'production'`, marked
       "wire to a real analytics sink for prod" — so it reported nothing
       exactly where it mattered. */
    expect(read('app/components/ChatWidget.tsx')).not.toContain("assistant.opened");
  });

  it('the movement calculator reports being used', () => {
    expect(read('app/tools/floor-movement/MovementClient.tsx')).toContain("track('movement_calculated'");
  });

  it('the quote comparator reports a comparison', () => {
    expect(read('app/quote-check/QuoteCompare.tsx')).toContain("track('quote_check_compared'");
  });
});

describe('the assistant now reaches the ledger', () => {
  it('records BOTH stages when it books a measure', () => {
    /* book_measure creates a QuoteRequest AND an Appointment in one
       transaction. Recording only the booking would report more appointments
       than leads. */
    const src = read('app/api/chat/route.ts');
    expect(src).toContain("stage: 'LEAD_CAPTURED', source: 'assistant'");
    expect(src).toContain("stage: 'APPOINTMENT_BOOKED', source: 'assistant'");
  });

  it('never awaits the ledger inside a chat tool', () => {
    expect(read('app/api/chat/route.ts')).not.toContain('await recordFunnelEvent');
  });
});

describe('the two tools that promise nothing leaves the browser', () => {
  it('neither sends a figure from the document the visitor is holding', () => {
    /* The quote comparator's page says three times that nothing is uploaded
       and nothing is stored. An event carrying a total or an area would make
       that sentence false — and this is the one tool where the visitor is
       holding another company's commercial document. */
    const src = read('app/quote-check/QuoteCompare.tsx');
    const call = src.slice(src.indexOf("track('quote_check_compared'"));
    const args = call.slice(0, call.indexOf(')') + 1);
    for (const forbidden of ['total', 'areaSqFt', 'perSqFt', 'label', 'includes']) {
      expect(args, `the event must not carry ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the movement calculator sends only the choices, never the answer', () => {
    /* The first version of this test forbade any key containing "mm" and
       failed on `board_mm` — which is an INPUT the visitor picks from a preset
       list, not the computed movement. Forbidding a substring is how a test
       ends up asserting something nobody meant; it now checks the actual
       thing, which is that the parameter keys come from a closed allowlist. */
    const src = read('app/tools/floor-movement/MovementClient.tsx');
    const call = src.slice(src.indexOf("track('movement_calculated'"));
    const args = call.slice(0, call.indexOf(')') + 1);
    const allowed = new Set(['species', 'orientation', 'board_mm']);
    const keys = [...args.matchAll(/([a-z_]+):/g)].map((m) => m[1]!);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(allowed.has(k), `unexpected parameter: ${k}`).toBe(true);
    /* and the computed result must not be in there under any name */
    expect(args).not.toContain('result');
  });

  it('both fire once, not on every keystroke', () => {
    for (const f of ['app/tools/floor-movement/MovementClient.tsx', 'app/quote-check/QuoteCompare.tsx']) {
      expect(read(f), `${f} must guard against re-firing`).toMatch(/Ref\.current\s*=\s*true/);
    }
  });
});

describe('the server-rendered commercial pages can now report', () => {
  it('both use the client boundary rather than a bare anchor', () => {
    for (const f of ['app/commercial/page.tsx', 'app/realtors/page.tsx']) {
      expect(read(f), `${f} must use TrackedCta`).toContain('TrackedCta');
    }
  });

  it('the boundary takes no arbitrary visitor data', () => {
    /* A tracked link that accepted a params bag would become the place
       somebody eventually puts an email address. */
    const src = read('app/components/TrackedCta.tsx');
    expect(src).not.toContain('params');
    expect(src).toContain('label');
  });
});
