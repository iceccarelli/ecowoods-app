/**
 * delivery-health.test.ts — ALERT-01.
 *
 * The secret-leak test is the one that matters. Everything else here is
 * boolean logic over four environment variables; that one is the reason this
 * module is allowed to read the environment at all.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deliveryHealth, maskEmail, maskPhone } from './delivery-health';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

const WEB = process.cwd().endsWith('apps/web') ? process.cwd() : join(process.cwd(), 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const SECRETS = {
  RESEND_API_KEY: 're_live_SUPERSECRET1234567890',
  TWILIO_ACCOUNT_SID: 'ACxxxxSECRETSIDxxxx0987654321',
  TWILIO_AUTH_TOKEN: 'tok_SECRETAUTH_0987654321',
  TWILIO_FROM: '+15550001111',
  ALERT_SMS_TO: '+14165551234,+16475559876',
  ADMIN_EMAIL: 'quotes@ecowoods.ca',
};

describe('nothing configured — the state that loses leads', () => {
  const h = deliveryHealth({});

  it('reports that no channel delivers', () => {
    expect(h.anyLive).toBe(false);
    expect(h.channels.every((c) => !c.live)).toBe(true);
    expect(h.channels.map((c) => c.id)).toEqual(['email', 'sms']);
  });

  it('names no destination it cannot reach', () => {
    for (const c of h.channels) expect(c.to, c.id).toBeNull();
  });

  /* The point of the whole module: say that the failure is SILENT, because a
     reader who is told "email is off" will assume an error was logged. */
  it('says plainly that the email path returns without erroring', () => {
    const email = h.channels.find((c) => c.id === 'email')!;
    expect(email.detail).toContain('RESEND_API_KEY');
    expect(email.detail).toContain('SMTP_HOST');
    expect(email.detail.toLowerCase()).toContain('without error');
  });
});

describe('it reads the environment exactly as the senders do', () => {
  it('treats RESEND_API_KEY as live, and names Resend', () => {
    const e = deliveryHealth({ RESEND_API_KEY: 'x' }).channels[0]!;
    expect(e.live).toBe(true);
    expect(e.via).toBe('Resend');
  });

  it('treats SMTP_HOST as live, and names SMTP', () => {
    const e = deliveryHealth({ SMTP_HOST: 'smtp.example.com' }).channels[0]!;
    expect(e.live).toBe(true);
    expect(e.via).toBe('SMTP');
  });

  /* Whitespace is not configuration. A variable set to " " in a dashboard is
     the most likely way this reports live and delivers nothing. */
  it('does not count a blank or whitespace value as configured', () => {
    expect(deliveryHealth({ RESEND_API_KEY: '   ' }).anyLive).toBe(false);
    expect(deliveryHealth({ SMTP_HOST: '' }).anyLive).toBe(false);
  });

  it('falls back to the published business inbox, like lib/email does', () => {
    const e = deliveryHealth({ RESEND_API_KEY: 'x' }).channels[0]!;
    expect(e.to).toBe(maskEmail(BUSINESS_NAP.email));
  });

  /* SMS must agree with alertConfig, which is what actually gates the send. */
  it('needs all four Twilio variables, not some of them', () => {
    const partial = { TWILIO_ACCOUNT_SID: 'a', TWILIO_AUTH_TOKEN: 'b', TWILIO_FROM: '+15550001111' };
    expect(deliveryHealth(partial).channels[1]!.live).toBe(false);
    expect(deliveryHealth({ ...partial, ALERT_SMS_TO: '+14165551234' }).channels[1]!.live).toBe(true);
  });

  it('rejects a malformed number the way alertConfig does', () => {
    const env = { TWILIO_ACCOUNT_SID: 'a', TWILIO_AUTH_TOKEN: 'b', TWILIO_FROM: '+15550001111', ALERT_SMS_TO: '416-555-1234' };
    expect(deliveryHealth(env).channels[1]!.live).toBe(false);
  });
});

describe('masking', () => {
  it('never shows the local part of an address', () => {
    expect(maskEmail('vince.ceccarelli@gmail.com')).toBe('v••••••••@gmail.com');
    expect(maskEmail('a@b.ca')).not.toContain('a@');
    expect(maskEmail('nonsense')).toBe('••••');
  });

  it('shows enough of a number to recognise and not enough to dial', () => {
    const m = maskPhone('+14165551234');
    expect(m).toContain('1234');
    expect(m).not.toBe('+14165551234');
    expect(m).not.toContain('555');
  });
});

describe('NO SECRET EVER LEAVES THIS MODULE', () => {
  const h = deliveryHealth(SECRETS);
  const rendered = JSON.stringify(h);

  it('is fully live in this configuration, so every field is populated', () => {
    expect(h.anyLive).toBe(true);
    expect(h.channels.every((c) => c.live)).toBe(true);
  });

  /* Every value that is a credential, checked against the WHOLE serialised
     output — not against the fields we remembered to look at. */
  it('emits no API key, SID or auth token anywhere in its output', () => {
    for (const key of ['RESEND_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'] as const) {
      expect(rendered, key).not.toContain(SECRETS[key]);
    }
  });

  it('emits no destination in the clear', () => {
    expect(rendered).not.toContain('quotes@ecowoods.ca');
    expect(rendered).not.toContain('+14165551234');
    expect(rendered).not.toContain('+16475559876');
    expect(rendered).not.toContain(SECRETS.TWILIO_FROM);
  });

  it('still shows enough to check the configuration is the intended one', () => {
    expect(rendered).toContain('1234');
    expect(rendered).toContain('@ecowoods.ca');
  });
});

describe('the dashboard uses it, and only when it should', () => {
  const src = read('app/admin/page.tsx');

  it('computes it per render rather than at build time', () => {
    expect(src).toContain('const delivery = deliveryHealth();');
  });

  /* A warning that is always on screen is furniture within a week. */
  it('shows the alarm only when nothing delivers', () => {
    expect(src).toContain('{!delivery.anyLive && (');
    expect(src).toContain('{delivery.anyLive && (');
  });

  it('renders the alarm as an alert, so a screen reader announces it', () => {
    expect(src).toContain('role="alert"');
  });

  /* It must never print a channel's raw configuration into the page. */
  it('renders only the masked fields the module returns', () => {
    expect(src).not.toContain('process.env.RESEND');
    expect(src).not.toContain('process.env.TWILIO');
    expect(src).not.toContain('alertConfig(');
  });
});
