/**
 * ASSISTANT-09 — the workspace funnel's own drop-off events
 * (workspace_conversion_started/_reviewed/_cancelled) and the `assistant`
 * funnel entry in lib/funnels/index.ts.
 *
 * Mirrors lib/instrumentation.test.ts's pattern for movement_calculated/
 * quote_check_compared: read the actual call site out of ConversionPanel.tsx
 * and assert its argument keys come from a closed, privacy-safe allowlist —
 * not a substring ban, which is how a real key slips past a test that only
 * forbids "email" and misses "contact.email".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FUNNELS, ROUTE_FUNNEL, funnelById } from '@/lib/funnels';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const conversionPanel = read('app/assistant/components/ConversionPanel.tsx');

/** Every `track('event', { ...args })` call site's raw argument text, keyed by event name. */
function trackCallArgs(src: string, event: string): string[] {
  const calls: string[] = [];
  const needle = `'${event}'`;
  let from = 0;
  for (;;) {
    const at = src.indexOf(needle, from);
    if (at === -1) break;
    const parenStart = src.indexOf('(', src.lastIndexOf('track', at));
    const close = src.indexOf(')', at);
    calls.push(src.slice(parenStart, close + 1));
    from = at + needle.length;
  }
  return calls;
}

/**
 * The property keys of a call's params object — handling both `{ action }`
 * shorthand and `{ action: next }` — never just the colon-form, which would
 * silently pass a shorthand property through unchecked.
 */
function paramKeys(call: string): string[] {
  const open = call.indexOf('{');
  const close = call.lastIndexOf('}');
  if (open === -1 || close === -1) return [];
  const body = call.slice(open + 1, close);
  return body
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.includes(':') ? p.slice(0, p.indexOf(':')).trim() : p));
}

const FORBIDDEN_SUBSTRINGS = ['name', 'email', 'phone', 'postal', 'address', 'notes', 'message', 'designId:', 'startsAt', 'squareFeet', 'sqft'];

describe('ConversionPanel — new ASSISTANT-09 events carry only closed, privacy-safe params', () => {
  it('workspace_conversion_started fires from onChooseAction with only the action enum', () => {
    const calls = trackCallArgs(conversionPanel, 'workspace_conversion_started');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const keys = paramKeys(call);
      expect(keys).toEqual(['action']);
    }
  });

  it('workspace_conversion_reviewed fires from onContinueToReview with only the action enum', () => {
    const calls = trackCallArgs(conversionPanel, 'workspace_conversion_reviewed');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const keys = paramKeys(call);
      expect(keys).toEqual(['action']);
    }
  });

  it('workspace_conversion_cancelled fires from onCancel with only the action enum', () => {
    const calls = trackCallArgs(conversionPanel, 'workspace_conversion_cancelled');
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      const keys = paramKeys(call);
      expect(keys).toEqual(['action']);
    }
  });

  it('none of the three new events’ call sites carry a forbidden field, even as a nearby substring', () => {
    for (const event of ['workspace_conversion_started', 'workspace_conversion_reviewed', 'workspace_conversion_cancelled']) {
      for (const call of trackCallArgs(conversionPanel, event)) {
        for (const forbidden of FORBIDDEN_SUBSTRINGS) {
          expect(call, `${event} call must not reference "${forbidden}": ${call}`).not.toContain(forbidden);
        }
      }
    }
  });

  it('workspace_conversion_cancelled is never fired from the receipt’s "Start another request" reset', () => {
    // resetToChoose (the receipt's reset after a COMPLETED request) must be a
    // separate function from onCancel (the plan step's abandon-in-progress),
    // and only onCancel may call track('workspace_conversion_cancelled', ...).
    const resetFn = conversionPanel.slice(
      conversionPanel.indexOf('const resetToChoose'),
      conversionPanel.indexOf('};', conversionPanel.indexOf('const resetToChoose')),
    );
    expect(resetFn).not.toContain('workspace_conversion_cancelled');
  });
});

describe('lib/funnels — the assistant funnel', () => {
  it('is wired from /assistant and never asserts a studio_* step that nothing can emit yet', () => {
    expect(ROUTE_FUNNEL['/assistant']).toBe('assistant');
    const f = funnelById('assistant')!;
    expect(f).toBeDefined();
    for (const step of f.steps) expect(step.startsWith('studio_')).toBe(false);
  });

  it('total funnel count grew by exactly one for this phase', () => {
    expect(FUNNELS.length).toBe(8);
  });
});
