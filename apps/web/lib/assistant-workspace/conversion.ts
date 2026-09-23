/**
 * lib/assistant-workspace/conversion.ts — ASSISTANT-07.
 *
 * Implements docs/assistant-workspace/PHASE_PLAN.md's ASSISTANT-07 scope and
 * DATA_FLOW_MAP.md's conversion-action flow: PLAN → REVIEW → USER CONFIRMS →
 * EXECUTE → RESULT → RECEIPT. Pure functions only — no fetch, no DOM, no
 * localStorage. Turns Project Decision State plus a chosen next action into
 * the exact payload the EXISTING backends already accept
 * (`appointmentSchema`/`leadSchema` in `@ecowoods/shared/schemas`), and
 * validates contact fields against those SAME schemas rather than a second,
 * redrawn set of rules.
 *
 * Actually calling the backend (`fetch('/api/appointments' | '/api/leads')`)
 * is I/O and lives in the UI layer (ConversionPanel.tsx), same split as
 * value-scenario.ts / value-scenario-evidence.ts.
 */
import { leadSchema, type AppointmentService } from '@ecowoods/shared/schemas';
import { totalSquareFeet } from './state';
import type { Money, ProjectRangeResult } from './economics';
import type { WorkspaceNextAction, WorkspaceObjective, WorkspaceState } from './types';

/** The three real next actions — `null` (nothing chosen yet) is never a valid conversion action. */
export type ConversionAction = Exclude<WorkspaceNextAction, null>;

export interface ConversionContact {
  name: string;
  email: string;
  phone: string;
  /** Postal/ZIP of the floor being worked on — same field `leadSchema`/`appointmentSchema` call `postal`. */
  postal: string;
}

export type ContactFieldErrors = Partial<Record<keyof ConversionContact, string>>;

/**
 * Validates contact fields against `leadSchema`'s own rules — the SAME
 * validation `/api/leads` and `/estimate`'s `EstimateForm` already enforce,
 * picked down to the four fields this panel collects rather than redrawn
 * here as a second set of "what's a valid phone number" rules.
 */
export function validateContact(contact: ConversionContact): { ok: true } | { ok: false; fieldErrors: ContactFieldErrors } {
  const parsed = leadSchema.pick({ name: true, email: true, phone: true, postal: true }).safeParse(contact);
  if (parsed.success) return { ok: true };
  const fieldErrors: ContactFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && (key === 'name' || key === 'email' || key === 'phone' || key === 'postal') && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return { ok: false, fieldErrors };
}

/**
 * The scoped summary a REVIEW step shows before anything is written —
 * objective, area, services, the published cost range, and the designId if
 * one exists. Every field here already exists on Project Decision State or
 * traces to `projectRangeForState`'s own `Money`; nothing is computed fresh.
 */
export interface ConversionPlan {
  action: ConversionAction;
  objective: WorkspaceObjective | null;
  squareFeet: number | undefined;
  country: WorkspaceState['country'];
  serviceSlugs: string[];
  costRange: Money;
  designId?: string;
  designCode?: string;
}

export type ConversionPlanResult =
  | { status: 'ready'; plan: ConversionPlan }
  | { status: 'needs-sqft' }
  | { status: 'needs-service' };

/**
 * Mirrors `economics.ts`'s own `ProjectRangeResult` status union — a
 * conversion action needs exactly the same scope the economics rail needs
 * ("needs-sqft"/"needs-service" are the honest reasons, not a generic
 * disabled state), so this never computes readiness a second way.
 */
export function buildConversionPlan(
  state: WorkspaceState,
  action: ConversionAction,
  projectRange: ProjectRangeResult,
): ConversionPlanResult {
  if (projectRange.status !== 'ready') return { status: projectRange.status };
  return {
    status: 'ready',
    plan: {
      action,
      objective: state.objective,
      squareFeet: totalSquareFeet(state),
      country: state.country,
      serviceSlugs: [...state.selectedServiceSlugs],
      costRange: projectRange.total,
      designId: state.designId || undefined,
      designCode: state.designCode,
    },
  };
}

/**
 * Real `SERVICES` slugs (lib/seo-data.ts / lib/service-pages.ts) mapped to
 * the real `APPOINTMENT_SERVICES` enum `appointmentSchema` requires
 * (`@ecowoods/shared/schemas`) — both sides are existing, published values;
 * this is a translation table between two real enums, never an invented
 * third one. `floor-restoration` maps to `refinishing`: both are billed
 * against the same `fullSandAndFinish` band (service-pages.ts), so they are
 * one scheduling category even though they're two catalogue services.
 */
const SERVICE_SLUG_TO_APPOINTMENT_SERVICE: Record<string, AppointmentService> = {
  'hardwood-installation': 'new-install',
  'floor-refinishing': 'refinishing',
  'dust-free-sanding': 'dust-free-sanding',
  'floor-restoration': 'refinishing',
  'stair-refinishing': 'stairs',
  'custom-inlays': 'custom-inlays',
};

/** Falls back to the objective when no selected service slug maps cleanly — never an invented category. */
const OBJECTIVE_TO_APPOINTMENT_SERVICE: Record<NonNullable<WorkspaceObjective>, AppointmentService> = {
  install: 'new-install',
  refinish: 'refinishing',
  repair: 'refinishing',
  'not-sure': 'new-install',
};

/** The one `AppointmentService` a booking is filed under, for a plan with possibly several selected services. */
export function appointmentServiceForPlan(plan: ConversionPlan): AppointmentService {
  for (const slug of plan.serviceSlugs) {
    const mapped = SERVICE_SLUG_TO_APPOINTMENT_SERVICE[slug];
    if (mapped) return mapped;
  }
  return plan.objective ? OBJECTIVE_TO_APPOINTMENT_SERVICE[plan.objective] : 'new-install';
}

/** Body for `POST /api/leads` — the site's real "estimate"/"quote" backend (EstimateForm's own target). */
export interface LeadPayload {
  name: string;
  email: string;
  phone: string;
  postal: string;
  service?: string;
  sqft?: number;
  designId?: string;
  design?: string;
  source: string;
}

export const CONVERSION_SOURCE = 'assistant-workspace';

export function buildLeadPayload(plan: ConversionPlan, contact: ConversionContact): LeadPayload {
  return {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    postal: contact.postal,
    service: plan.serviceSlugs[0] ?? plan.objective ?? undefined,
    sqft: plan.squareFeet,
    designId: plan.designId,
    design: plan.designCode,
    source: CONVERSION_SOURCE,
  };
}

/** Body for `POST /api/appointments` — the same live-slot backend the corner assistant's `book_measure` tool uses. */
export interface AppointmentPayload {
  startsAt: string;
  name: string;
  email: string;
  phone: string;
  postal: string;
  service: AppointmentService;
  sqft?: number;
  designId?: string;
  designCode?: string;
  source: string;
}

export function buildAppointmentPayload(plan: ConversionPlan, contact: ConversionContact, startsAt: string): AppointmentPayload {
  return {
    startsAt,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    postal: contact.postal,
    service: appointmentServiceForPlan(plan),
    sqft: plan.squareFeet,
    designId: plan.designId,
    designCode: plan.designCode,
    source: CONVERSION_SOURCE,
  };
}

export const CONVERSION_ACTION_LABEL: Record<ConversionAction, string> = {
  measure: 'Book a free in-home measure',
  estimate: 'Request a written estimate',
  quote: 'Request a quote',
};
