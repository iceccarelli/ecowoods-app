/**
 * conversion.test.ts — ASSISTANT-07.
 *
 * Covers: plan readiness mirrors economics.ts's own status union, contact
 * validation reuses leadSchema's real rules, designId/designCode flow
 * through to both payload shapes when Project Decision State has them (and
 * are simply absent, never invented, when it doesn't), and the
 * service-slug → AppointmentService mapping never falls through to
 * something outside the real, published enum.
 */
import { describe, expect, it } from 'vitest';
import { APPOINTMENT_SERVICES } from '@ecowoods/shared/schemas';
import {
  appointmentServiceForPlan,
  buildAppointmentPayload,
  buildConversionPlan,
  buildLeadPayload,
  validateContact,
  CONVERSION_SOURCE,
  type ConversionContact,
  type ConversionPlan,
} from './conversion';
import { projectRangeForState } from './economics';
import { applyPatch, defaultWorkspaceState } from './state';
import type { WorkspaceObjective } from './types';

const VALID_CONTACT: ConversionContact = { name: 'Jordan Lee', email: 'jordan@example.com', phone: '4165550123', postal: 'M4W 1A1' };

function installState(squareFeet: number, overrides: Parameters<typeof applyPatch>[1] = {}) {
  return applyPatch(defaultWorkspaceState(), {
    rooms: [{ label: 'Whole project', squareFeet }],
    selectedServiceSlugs: ['hardwood-installation'],
    objective: 'install',
    ...overrides,
  });
}

describe('validateContact', () => {
  it('accepts a complete, well-formed contact', () => {
    expect(validateContact(VALID_CONTACT)).toEqual({ ok: true });
  });

  it('rejects an invalid email with a field error, not a thrown exception', () => {
    const result = validateContact({ ...VALID_CONTACT, email: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.email).toBeTruthy();
  });

  it('rejects a missing name', () => {
    const result = validateContact({ ...VALID_CONTACT, name: 'A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy();
  });

  it('rejects a too-short phone number', () => {
    const result = validateContact({ ...VALID_CONTACT, phone: '123' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.phone).toBeTruthy();
  });
});

describe('buildConversionPlan — status mirrors economics.ts', () => {
  it('reports needs-sqft when projectRangeForState does', () => {
    const state = applyPatch(defaultWorkspaceState(), { selectedServiceSlugs: ['hardwood-installation'] });
    expect(buildConversionPlan(state, 'measure', projectRangeForState(state))).toEqual({ status: 'needs-sqft' });
  });

  it('reports needs-service when projectRangeForState does', () => {
    const state = applyPatch(defaultWorkspaceState(), { rooms: [{ label: 'Living room', squareFeet: 500 }] });
    expect(buildConversionPlan(state, 'measure', projectRangeForState(state))).toEqual({ status: 'needs-service' });
  });

  it('carries the exact costRange from projectRangeForState — never a second computation', () => {
    const state = installState(1000);
    const projectRange = projectRangeForState(state);
    const result = buildConversionPlan(state, 'estimate', projectRange);
    expect(result.status).toBe('ready');
    expect(projectRange.status).toBe('ready');
    if (result.status === 'ready' && projectRange.status === 'ready') {
      expect(result.plan.costRange).toEqual(projectRange.total);
    }
  });

  it('omits designId when state has none, and carries it verbatim when it does', () => {
    const bare = installState(1000);
    const bareResult = buildConversionPlan(bare, 'quote', projectRangeForState(bare));
    expect(bareResult.status).toBe('ready');
    if (bareResult.status === 'ready') expect(bareResult.plan.designId).toBeUndefined();

    const withDesign = applyPatch(bare, { designId: 'abcdefghjkmn' });
    const result = buildConversionPlan(withDesign, 'quote', projectRangeForState(withDesign));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.plan.designId).toBe('abcdefghjkmn');
  });
});

describe('appointmentServiceForPlan — always a real, published AppointmentService', () => {
  /**
   * Built directly against a `ConversionPlan`, not through
   * `buildConversionPlan`/`projectRangeForState`: some real service slugs
   * (`dust-free-sanding`, `custom-inlays`) carry no `pricing` key of their
   * own (service-pages.ts) and so never reach `projectRangeForState`'s
   * 'ready' status on their own — that is a fact about pricing scope, not
   * about the service-slug → AppointmentService mapping this test covers.
   */
  const planWith = (serviceSlugs: string[], objective: WorkspaceObjective | null = 'install'): ConversionPlan => ({
    action: 'measure',
    objective,
    squareFeet: 1000,
    country: 'CA',
    serviceSlugs,
    costRange: { min: 1, max: 2, currency: 'CAD' },
  });

  it('maps every known service slug to a value in APPOINTMENT_SERVICES', () => {
    const slugs = ['hardwood-installation', 'floor-refinishing', 'dust-free-sanding', 'floor-restoration', 'stair-refinishing', 'custom-inlays'];
    for (const slug of slugs) {
      expect(APPOINTMENT_SERVICES).toContain(appointmentServiceForPlan(planWith([slug])));
    }
  });

  it('falls back to the objective, never to an invented category, when no slug maps', () => {
    expect(APPOINTMENT_SERVICES).toContain(appointmentServiceForPlan(planWith([], 'refinish')));
  });

  it('falls back to new-install when neither a slug nor an objective is set', () => {
    expect(APPOINTMENT_SERVICES).toContain(appointmentServiceForPlan(planWith([], null)));
  });
});

describe('buildLeadPayload / buildAppointmentPayload — designId/designCode and source', () => {
  it('both payloads carry source: assistant-workspace', () => {
    const state = installState(1000);
    const result = buildConversionPlan(state, 'quote', projectRangeForState(state));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(buildLeadPayload(result.plan, VALID_CONTACT).source).toBe(CONVERSION_SOURCE);
      expect(buildAppointmentPayload(result.plan, VALID_CONTACT, '2027-01-01T15:00:00-05:00').source).toBe(CONVERSION_SOURCE);
    }
  });

  it('carries designId/designCode through to both payloads when Project Decision State has them', () => {
    const state = applyPatch(installState(1000), { designId: 'abcdefghjkmn', designCode: 'c=white-oak.satin.herringbone.5&a=1000' });
    const result = buildConversionPlan(state, 'measure', projectRangeForState(state));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const lead = buildLeadPayload(result.plan, VALID_CONTACT);
      expect(lead.designId).toBe('abcdefghjkmn');
      expect(lead.design).toBe('c=white-oak.satin.herringbone.5&a=1000');

      const appt = buildAppointmentPayload(result.plan, VALID_CONTACT, '2027-01-01T15:00:00-05:00');
      expect(appt.designId).toBe('abcdefghjkmn');
      expect(appt.designCode).toBe('c=white-oak.satin.herringbone.5&a=1000');
    }
  });

  it('leaves designId/designCode undefined — never a placeholder string — when state has none', () => {
    const state = installState(1000);
    const result = buildConversionPlan(state, 'measure', projectRangeForState(state));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      const lead = buildLeadPayload(result.plan, VALID_CONTACT);
      expect(lead.designId).toBeUndefined();
      expect(lead.design).toBeUndefined();
      const appt = buildAppointmentPayload(result.plan, VALID_CONTACT, '2027-01-01T15:00:00-05:00');
      expect(appt.designId).toBeUndefined();
      expect(appt.designCode).toBeUndefined();
    }
  });

  it('carries the visitor-selected square footage onto both payloads', () => {
    const state = installState(1234);
    const result = buildConversionPlan(state, 'estimate', projectRangeForState(state));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(buildLeadPayload(result.plan, VALID_CONTACT).sqft).toBe(1234);
      expect(buildAppointmentPayload(result.plan, VALID_CONTACT, '2027-01-01T15:00:00-05:00').sqft).toBe(1234);
    }
  });
});
