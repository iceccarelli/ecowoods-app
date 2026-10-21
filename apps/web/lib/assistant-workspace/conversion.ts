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
import { designIdOf } from '@/lib/floor-studio/design-id';
import { SERVICES } from '@/lib/seo-data';
import { totalSquareFeet } from './state';
import { formatMoneyRange, type Money, type ProjectRangeResult } from './economics';
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
  const parsed = leadSchema.pick({ name: true, email: true, phone: true, postal: true }).safeParse({
    name: contact.name.trim(),
    email: contact.email.trim(),
    phone: contact.phone.trim(),
    postal: contact.postal.trim(),
  });
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

/**
 * The `service` vocabulary /estimate's own form posts to /api/leads
 * (EstimateForm's SERVICES: refinishing, installation, sanding, stairs,
 * inlays, commercial). `leadSchema.service` accepts any short string, so a
 * raw catalogue slug ("hardwood-installation") or objective ("install") would
 * validate and then reach the estimating desk as a value no other lead
 * carries. Translating from the appointment category keeps one mapping from
 * slug to category (above) and one from category to the form's words (here).
 */
const LEAD_SERVICE_FOR_APPOINTMENT: Record<AppointmentService, string> = {
  'new-install': 'installation',
  refinishing: 'refinishing',
  'dust-free-sanding': 'sanding',
  stairs: 'stairs',
  'custom-inlays': 'inlays',
  commercial: 'commercial',
};

/** Same 400-character ceiling `leadSchema.design` / `appointmentSchema.designCode` enforce. */
const DESIGN_CODE_MAX = 400;
const designCodeOf = (code: string | undefined): string | undefined => {
  const t = code?.trim();
  return t ? t.slice(0, DESIGN_CODE_MAX) : undefined;
};

/**
 * What the estimating desk reads first: which of the three actions the
 * homeowner chose (estimate and quote are otherwise indistinguishable on the
 * lead), and the project facts they confirmed. Built only from the confirmed
 * plan — nothing the model said in prose.
 */
function leadMessage(plan: ConversionPlan): string {
  const names = plan.serviceSlugs.map((slug) => SERVICES.find((s) => s.slug === slug)?.name).filter(Boolean);
  const parts = [
    `Asked via Ask Francisco: ${CONVERSION_ACTION_LABEL[plan.action]}.`,
    plan.objective ? `Objective: ${plan.objective}.` : null,
    plan.squareFeet !== undefined ? `Area: ${plan.squareFeet} sq ft.` : null,
    names.length ? `Services: ${names.join(', ')}.` : null,
    `Published band applied to that area: ${formatMoneyRange(plan.costRange)} (not a quote).`,
  ].filter((x): x is string => !!x);
  return parts.join(' ').slice(0, 2000);
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
  message?: string;
  source: string;
}

export const CONVERSION_SOURCE = 'assistant-workspace';

export function buildLeadPayload(plan: ConversionPlan, contact: ConversionContact): LeadPayload {
  return {
    name: contact.name.trim(),
    email: contact.email.trim(),
    phone: contact.phone.trim(),
    postal: contact.postal.trim(),
    service: LEAD_SERVICE_FOR_APPOINTMENT[appointmentServiceForPlan(plan)],
    sqft: plan.squareFeet,
    designId: designIdOf(plan.designId),
    design: designCodeOf(plan.designCode),
    message: leadMessage(plan),
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
    name: contact.name.trim(),
    email: contact.email.trim(),
    phone: contact.phone.trim(),
    postal: contact.postal.trim(),
    service: appointmentServiceForPlan(plan),
    sqft: plan.squareFeet,
    designId: designIdOf(plan.designId),
    designCode: designCodeOf(plan.designCode),
    source: CONVERSION_SOURCE,
  };
}

export const CONVERSION_ACTION_LABEL: Record<ConversionAction, string> = {
  measure: 'Book a free in-home measure',
  estimate: 'Request a written estimate',
  quote: 'Request a quote',
};
