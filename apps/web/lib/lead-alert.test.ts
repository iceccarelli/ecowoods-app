/**
 * lead-alert.test.ts — SALE-04.
 *
 * Two things are worth testing here and one of them is unusual: what the
 * message is NOT allowed to contain. An SMS crosses a carrier in the clear and
 * lands on a lock screen, so the contents are a privacy decision, not a
 * formatting one.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { alertConfig, composeLeadAlert, sendLeadAlert } from './lead-alert';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const CONFIGURED = {
  TWILIO_ACCOUNT_SID: 'AC' + 'x'.repeat(30),
  TWILIO_AUTH_TOKEN: 'tok',
  TWILIO_FROM: '+14165550100',
  ALERT_SMS_TO: '+14165550111',
};

describe('what the message carries, and what it must not', () => {
  it('leads with what happened, then who and the number to ring', () => {
    const msg = composeLeadAlert({
      kind: 'measure booked',
      name: 'J. Tremblay',
      phone: '+14165550123',
      where: 'M4C 1B5',
      service: 'installation',
      source: 'service-area-east-york',
    });
    expect(msg.startsWith('Ecowoods — measure booked')).toBe(true);
    expect(msg).toContain('J. Tremblay');
    expect(msg).toContain('+14165550123');
    expect(msg).toContain('via service-area-east-york');
  });

  it('cannot carry an email, a message body, or an address', () => {
    /* The shape of LeadAlert is the guarantee: there is no field for them.
       This asserts the shape holds, because a future "just add the email so I
       can reply from my phone" is exactly how a lock-screen leak is written. */
    const src = read('lib/lead-alert.ts');
    const type = src.slice(src.indexOf('export type LeadAlert'), src.indexOf('};', src.indexOf('export type LeadAlert')));
    /* A FIELD DECLARATION, not the bare word. The docblock on `phone` says
       "the entire point of the message", and matching prose is how a test
       starts forbidding its own documentation — the third time this session
       that a needle had to be made code-shaped rather than word-shaped. */
    for (const forbidden of ['email', 'message', 'notes', 'address', 'design']) {
      expect(type, `LeadAlert must have no ${forbidden} field`).not.toMatch(
        new RegExp(`\\n\\s*${forbidden}\\??:`),
      );
    }
  });

  it('is bounded, so a carrier does not split it into out-of-order parts', () => {
    const msg = composeLeadAlert({
      kind: 'lead',
      name: 'x'.repeat(500),
      phone: '+14165550123',
      where: 'y'.repeat(500),
      service: 'z'.repeat(500),
    });
    expect(msg.length).toBeLessThanOrEqual(320);
  });

  it('drops absent fields rather than printing empty separators', () => {
    expect(composeLeadAlert({ kind: 'lead', name: 'A. Singh' })).toBe('Ecowoods — lead · A. Singh');
  });
});

describe('configuration', () => {
  it('needs all four values before it will send anything', () => {
    expect(alertConfig({})).toBeNull();
    for (const k of Object.keys(CONFIGURED)) {
      const partial = { ...CONFIGURED, [k]: '' };
      expect(alertConfig(partial), `${k} must be required`).toBeNull();
    }
    expect(alertConfig(CONFIGURED)).not.toBeNull();
  });

  it('accepts several recipients, so a second estimator needs no deploy', () => {
    const cfg = alertConfig({ ...CONFIGURED, ALERT_SMS_TO: '+14165550111, +12895550222' });
    expect(cfg?.to).toEqual(['+14165550111', '+12895550222']);
  });

  it('refuses anything that is not E.164, rather than handing it to a carrier', () => {
    for (const bad of ['4165550111', '+1 416 555 0111', 'not-a-number', '+0123', '+']) {
      expect(alertConfig({ ...CONFIGURED, ALERT_SMS_TO: bad }), bad).toBeNull();
    }
  });
});

describe('it can never break a lead', () => {
  it('resolves quietly when unconfigured', async () => {
    /* Most environments have no credentials. An alert path that threw, or even
       warned loudly, on every lead would be switched off within a day — and
       then be off on the day it mattered. */
    expect(await sendLeadAlert({ kind: 'lead', name: 'A' }, {})).toBeUndefined();
  });

  it('never throws when the network does', async () => {
    const g = globalThis as { fetch: typeof fetch };
    const original = g.fetch;
    g.fetch = (() => Promise.reject(new Error('carrier unreachable'))) as typeof fetch;
    try {
      expect(
        await sendLeadAlert({ kind: 'lead', name: 'A', phone: '+14165550123' }, CONFIGURED),
      ).toBeUndefined();
    } finally {
      g.fetch = original;
    }
  });
});

describe('the call sites', () => {
  it('every path that creates a real lead alerts', () => {
    for (const f of [
      'app/api/leads/route.ts',
      'app/api/appointments/route.ts',
      'app/api/chat/route.ts',
    ]) {
      expect(read(f), `${f} must alert`).toContain('sendLeadAlert({');
    }
  });

  it('none of them awaits it', () => {
    /* A customer's request must not wait on a carrier, and an alert failure
       must never turn a captured lead into a 500. */
    for (const f of [
      'app/api/leads/route.ts',
      'app/api/appointments/route.ts',
      'app/api/chat/route.ts',
    ]) {
      expect(read(f), `${f} must not await the alert`).not.toContain('await sendLeadAlert');
    }
  });

  it('adds no dependency', () => {
    /* Twilio's REST API is a form POST. The package would add a lockfile entry
       to a repository whose install expects the lockfile to be current — a
       dependency added in a patch is a dependency that breaks `pnpm install`
       on the machine applying it. */
    expect(read('lib/lead-alert.ts')).not.toContain("from 'twilio'");
    expect(read('../../package.json')).not.toContain('"twilio"');
  });

  it('logs a provider status but never a provider response body', () => {
    /* An error body can echo the request back, and the request contains a
       customer's phone number. */
    const src = read('lib/lead-alert.ts');
    expect(src).toContain('status: res.status');
    expect(src).not.toContain('res.text()');
    expect(src).not.toContain('res.json()');
  });
});
