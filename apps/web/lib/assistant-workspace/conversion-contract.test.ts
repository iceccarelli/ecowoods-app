/**
 * Contract: the payload ConversionPanel posts IS what the routes' zod schemas
 * accept.
 *
 * ConversionPanel does `JSON.stringify(buildAppointmentPayload(...))` and
 * `JSON.stringify(buildLeadPayload(...))`, so parsing the JSON round-trip here
 * is exactly the body /api/appointments and /api/leads receive. The schemas
 * are the ones those routes import from @ecowoods/shared/schemas — not a copy.
 */
import { describe, expect, it } from 'vitest';
import { appointmentSchema, leadSchema } from '@ecowoods/shared/schemas';
import { SERVICES } from '@/lib/seo-data';
import {
  buildAppointmentPayload,
  buildLeadPayload,
  validateContact,
  CONVERSION_SOURCE,
  type ConversionAction,
  type ConversionContact,
  type ConversionPlan,
} from './conversion';
import type { WorkspaceObjective } from './types';

const CONTACT: ConversionContact = { name: 'Jordan Lee', email: 'jordan@example.com', phone: '4165550123', postal: 'M4W 1A1' };
const ACTIONS: ConversionAction[] = ['measure', 'estimate', 'quote'];
const OBJECTIVES: WorkspaceObjective[] = ['install', 'refinish', 'repair', 'not-sure'];
const STARTS_AT = '2027-01-12T15:00:00-05:00';

const wire = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

const mk = (serviceSlugs: string[], objective: WorkspaceObjective | null, extra: Partial<ConversionPlan> = {}): ConversionPlan => ({
  action: 'measure',
  objective,
  squareFeet: 850,
  country: 'CA',
  serviceSlugs,
  costRange: { min: 1000, max: 2000, currency: 'CAD' },
  ...extra,
});

const cases: { name: string; plan: ConversionPlan }[] = [
  ...SERVICES.flatMap((s) => OBJECTIVES.map((o) => ({ name: `${s.slug} / ${o}`, plan: mk([s.slug], o) }))),
  ...OBJECTIVES.map((o) => ({ name: `no service / ${o}`, plan: mk([], o) })),
  { name: 'no service, no objective', plan: mk([], null) },
  { name: 'several services', plan: mk(['stair-refinishing', 'floor-refinishing'], 'refinish') },
];

describe('payload builders satisfy appointmentSchema / leadSchema for every service the assistant can send', () => {
  it('covers every published service', () => {
    expect(SERVICES.length).toBeGreaterThanOrEqual(6);
    expect(cases.length).toBeGreaterThan(SERVICES.length * OBJECTIVES.length);
  });

  it.each(cases)('appointment: $name', ({ plan }) => {
    for (const action of ACTIONS) {
      const body = buildAppointmentPayload({ ...plan, action }, CONTACT, STARTS_AT);
      const parsed = appointmentSchema.safeParse(wire(body));
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
      if (parsed.success) {
        expect(parsed.data.service).toBe(body.service);
        expect(parsed.data.postal).toBe(CONTACT.postal);
        expect(parsed.data.sqft).toBe(850);
      }
    }
  });

  it.each(cases)('lead: $name', ({ plan }) => {
    for (const action of ACTIONS) {
      const body = buildLeadPayload({ ...plan, action }, CONTACT);
      const parsed = leadSchema.safeParse(wire(body));
      expect(parsed.success, JSON.stringify(parsed)).toBe(true);
      if (parsed.success) {
        expect(parsed.data.postal).toBe(CONTACT.postal);
        expect(parsed.data.sqft).toBe(850);
        expect(parsed.data.source).toBe(CONVERSION_SOURCE);
      }
    }
  });
});

describe('lead field semantics', () => {
  it("service uses the words /estimate's own form posts, not catalogue slugs or objectives", () => {
    const FORM_VALUES = ['refinishing', 'installation', 'sanding', 'stairs', 'inlays', 'commercial'];
    for (const { plan } of cases) expect(FORM_VALUES).toContain(buildLeadPayload(plan, CONTACT).service);
    expect(buildLeadPayload(mk(['hardwood-installation'], 'install'), CONTACT).service).toBe('installation');
    expect(buildLeadPayload(mk(['dust-free-sanding'], 'refinish'), CONTACT).service).toBe('sanding');
    expect(buildLeadPayload(mk(['custom-inlays'], 'install'), CONTACT).service).toBe('inlays');
    expect(buildLeadPayload(mk(['stair-refinishing'], 'refinish'), CONTACT).service).toBe('stairs');
  });

  it('the message says which action was asked for, from confirmed facts only', () => {
    const est = buildLeadPayload(mk(['floor-refinishing'], 'refinish', { action: 'estimate' }), CONTACT).message!;
    const quo = buildLeadPayload(mk(['floor-refinishing'], 'refinish', { action: 'quote' }), CONTACT).message!;
    expect(est).toContain('Request a written estimate');
    expect(quo).toContain('Request a quote');
    expect(est).toContain('850 sq ft');
    expect(est).toContain('(not a quote)');
    expect(est.length).toBeLessThanOrEqual(2000);
  });
});

describe('design fields', () => {
  it('carries a valid design id and share code through; both schemas accept them', () => {
    const plan = mk(['hardwood-installation'], 'install', { designId: 'abcdefghjkmn', designCode: 'c=white-oak.satin.herringbone.5&a=850' });
    const appt = appointmentSchema.parse(wire(buildAppointmentPayload(plan, CONTACT, STARTS_AT)));
    const lead = leadSchema.parse(wire(buildLeadPayload(plan, CONTACT)));
    expect(appt.designId).toBe('abcdefghjkmn');
    expect(appt.designCode).toBe('c=white-oak.satin.herringbone.5&a=850');
    expect(lead.designId).toBe('abcdefghjkmn');
    expect(lead.design).toBe('c=white-oak.satin.herringbone.5&a=850');
  });

  it('drops a malformed design id instead of sending a body the API would reject', () => {
    for (const bad of ['', 'short', 'ABCDEFGHJKMN', 'abcdefghjkm!', 'ilou00000000']) {
      const plan = mk(['hardwood-installation'], 'install', { designId: bad });
      expect(appointmentSchema.safeParse(wire(buildAppointmentPayload(plan, CONTACT, STARTS_AT))).success, bad).toBe(true);
      expect(leadSchema.safeParse(wire(buildLeadPayload(plan, CONTACT))).success, bad).toBe(true);
      expect(buildLeadPayload(plan, CONTACT).designId).toBeUndefined();
    }
  });

  it("truncates an over-long share code to the schemas' 400-character limit", () => {
    const plan = mk(['hardwood-installation'], 'install', { designCode: 'c=' + 'x'.repeat(900) });
    const appt = appointmentSchema.safeParse(wire(buildAppointmentPayload(plan, CONTACT, STARTS_AT)));
    const lead = leadSchema.safeParse(wire(buildLeadPayload(plan, CONTACT)));
    expect(appt.success).toBe(true);
    expect(lead.success).toBe(true);
  });
});

describe('contact and area fields', () => {
  it("trims stray whitespace the way validateContact judged it", () => {
    const padded: ConversionContact = { name: '  Jordan Lee ', email: ' jordan@example.com ', phone: ' 4165550123 ', postal: ' M4W 1A1 ' };
    expect(validateContact(padded)).toEqual({ ok: true });
    const body = buildLeadPayload(mk(['hardwood-installation'], 'install'), padded);
    expect(body.name).toBe('Jordan Lee');
    expect(body.postal).toBe('M4W 1A1');
    expect(leadSchema.safeParse(wire(body)).success).toBe(true);
    // " a" is two characters padded but one once trimmed: rejected before it reaches the API.
    expect(validateContact({ ...padded, name: ' a' }).ok).toBe(false);
  });

  it('omits sqft rather than sending 0 or NaN when the plan has none', () => {
    const body = wire(buildLeadPayload(mk(['hardwood-installation'], 'install', { squareFeet: undefined }), CONTACT)) as Record<string, unknown>;
    expect('sqft' in body).toBe(false);
    expect(leadSchema.safeParse(body).success).toBe(true);
  });
});
