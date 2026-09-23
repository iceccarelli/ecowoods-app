'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoneyRange, type ProjectRangeResult } from '@/lib/assistant-workspace/economics';
import {
  buildAppointmentPayload,
  buildConversionPlan,
  buildLeadPayload,
  validateContact,
  CONVERSION_ACTION_LABEL,
  type ConversionAction,
  type ConversionContact,
  type ContactFieldErrors,
} from '@/lib/assistant-workspace/conversion';
import { SERVICES } from '@/lib/seo-data';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { track } from '@/lib/analytics';
import { useWorkspaceState } from './WorkspaceStateProvider';

const OBJECTIVE_LABEL: Record<string, string> = {
  install: 'New floor',
  refinish: 'Refinishing',
  repair: 'Repair',
  'not-sure': 'Still deciding',
};

interface AvailableSlot {
  start: string;
  label: string;
}

/** Same shape `GET /api/availability` returns — see lib/booking/availability.ts's `computeAvailability`. */
interface AvailabilityResponse {
  timezone: string;
  days: { date: string; slots: { start: string; remaining: number; available: boolean }[] }[];
}

function slotLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto',
  }).format(new Date(iso));
}

type Step = 'choose' | 'plan' | 'review' | 'submitting' | 'done' | 'error';

type Receipt =
  | { kind: 'appointment'; whenLabel: string }
  | { kind: 'lead' };

const ACTIONS: ConversionAction[] = ['measure', 'estimate', 'quote'];

/**
 * ConversionPanel — ASSISTANT-07.
 *
 * PLAN → REVIEW → USER CONFIRMS → EXECUTE → RESULT → RECEIPT
 * (docs/assistant-workspace/PHASE_PLAN.md §ASSISTANT-07). The only network
 * call this component ever makes to WRITE something (`POST /api/appointments`
 * or `POST /api/leads` — the same public backends `/estimate`'s EstimateForm
 * and the corner assistant's booking tool already use, never a fork of
 * either) happens inside `onConfirm`, reachable only from the `review` step's
 * button. No effect, no mount handler and no earlier step calls it — the
 * only way to reach EXECUTE is through REVIEW and an explicit click. Reading
 * availability (`GET /api/availability`) is not a write and is fetched
 * eagerly once `plan` opens for a measure booking, same as the corner
 * assistant calling `get_availability` before offering a time.
 */
export function ConversionPanel({ projectRange }: { projectRange: ProjectRangeResult }) {
  const { state, patch } = useWorkspaceState();
  const [step, setStep] = useState<Step>('choose');
  const [contact, setContact] = useState<ConversionContact>({ name: '', email: '', phone: '', postal: '' });
  const [fieldErrors, setFieldErrors] = useState<ContactFieldErrors>({});
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const action = state.nextAction;

  /* The full ConversionPlan (objective, sqft, services, cost range,
     designId) only exists once an action is chosen — `buildConversionPlan`
     needs one to label the plan with, and there is nothing to review before
     then anyway. Readiness itself (`projectRange.status`) is independent of
     which action gets picked, which is why the "add sqft/service" empty
     state below checks `projectRange` directly rather than waiting on a
     plan that doesn't exist yet. */
  const planResult = useMemo(
    () => (action ? buildConversionPlan(state, action, projectRange) : null),
    [state, action, projectRange],
  );
  const plan = planResult?.status === 'ready' ? planResult.plan : null;

  useEffect(() => {
    if (step !== 'plan' || action !== 'measure' || slots.length || slotsError) return;
    let cancelled = false;
    fetch('/api/availability')
      .then((res) => (res.ok ? (res.json() as Promise<AvailabilityResponse>) : Promise.reject(new Error('unavailable'))))
      .then((data) => {
        if (cancelled) return;
        const found: AvailableSlot[] = [];
        for (const day of data.days) {
          for (const s of day.slots) {
            if (s.available) found.push({ start: s.start, label: slotLabel(s.start) });
            if (found.length >= 6) break;
          }
          if (found.length >= 6) break;
        }
        setSlots(found);
        if (!found.length) setSlotsError(`No openings in the next few weeks — call ${BUSINESS_NAP.phoneDisplay} to book.`);
      })
      .catch(() => {
        if (!cancelled) setSlotsError(`Could not load openings — call ${BUSINESS_NAP.phoneDisplay} to book.`);
      });
    return () => {
      cancelled = true;
    };
  }, [step, action, slots.length, slotsError]);

  const onChooseAction = (next: ConversionAction) => {
    patch({ nextAction: next });
    setStep('plan');
  };

  const onContinueToReview = () => {
    const result = validateContact(contact);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      return;
    }
    if (action === 'measure' && !selectedSlot) return;
    setFieldErrors({});
    setStep('review');
  };

  const onConfirm = async () => {
    if (!plan || !action) return;
    setStep('submitting');
    setSubmitError(null);
    try {
      if (action === 'measure') {
        if (!selectedSlot) throw new Error('No time selected.');
        const body = buildAppointmentPayload(plan, contact, selectedSlot.start);
        const res = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? `Could not confirm that — call ${BUSINESS_NAP.phoneDisplay} and we'll book it.`);
        }
        track('workspace_measure_requested', { hasDesign: Boolean(plan.designId) });
        setReceipt({ kind: 'appointment', whenLabel: selectedSlot.label });
      } else {
        const body = buildLeadPayload(plan, contact);
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(data?.message ?? `Could not send that — call ${BUSINESS_NAP.phoneDisplay}.`);
        }
        track(action === 'quote' ? 'workspace_quote_requested' : 'workspace_estimate_requested', {
          hasDesign: Boolean(plan.designId),
        });
        setReceipt({ kind: 'lead' });
      }
      setStep('done');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : `Something went wrong — call ${BUSINESS_NAP.phoneDisplay}.`);
      setStep('error');
    }
  };

  const onCancel = () => {
    patch({ nextAction: null });
    setStep('choose');
    setSelectedSlot(null);
    setSlots([]);
    setSlotsError(null);
    setSubmitError(null);
  };

  const services = plan?.serviceSlugs
    .map((slug) => SERVICES.find((s) => s.slug === slug)?.name)
    .filter((n): n is string => !!n);

  if (step === 'done' && receipt) {
    return (
      <div className="aha-conversion aha-conversion--receipt" role="status">
        <p className="aha-conversion-heading">Confirmed</p>
        {receipt.kind === 'appointment' ? (
          <p className="aha-conversion-text">
            Booked for {receipt.whenLabel}. A confirmation email is on its way, and this is on the calendar — no
            second call needed to hold it.
          </p>
        ) : (
          <p className="aha-conversion-text">
            Sent. A specialist will reach out within 1 business day at {contact.email || 'the email you gave us'}.
          </p>
        )}
        <button type="button" className="aha-card-action" onClick={onCancel}>
          Start another request
        </button>
      </div>
    );
  }

  if (projectRange.status !== 'ready') {
    return (
      <p className="aha-card-why-empty">
        Add a square footage and a service above, then come back here to book a measure or request an estimate.
      </p>
    );
  }

  return (
    <div className="aha-conversion">
      {step === 'choose' && (
        <div className="aha-conversion-choices" role="group" aria-label="Choose your next step">
          {ACTIONS.map((a) => (
            <button key={a} type="button" className="aha-card-action aha-card-action--primary" onClick={() => onChooseAction(a)}>
              {CONVERSION_ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}

      {(step === 'plan' || step === 'review' || step === 'submitting' || step === 'error') && action && plan && (
        <>
          <p className="aha-conversion-heading">{CONVERSION_ACTION_LABEL[action]}</p>

          {step === 'plan' && (
            <div className="aha-conversion-form">
              <label className="aha-conversion-field">
                <span>Name</span>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'aha-conv-name-error' : undefined}
                />
                {fieldErrors.name && <span id="aha-conv-name-error" className="aha-conversion-field-error">{fieldErrors.name}</span>}
              </label>
              <label className="aha-conversion-field">
                <span>Email</span>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'aha-conv-email-error' : undefined}
                />
                {fieldErrors.email && <span id="aha-conv-email-error" className="aha-conversion-field-error">{fieldErrors.email}</span>}
              </label>
              <label className="aha-conversion-field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'aha-conv-phone-error' : undefined}
                />
                {fieldErrors.phone && <span id="aha-conv-phone-error" className="aha-conversion-field-error">{fieldErrors.phone}</span>}
              </label>
              <label className="aha-conversion-field">
                <span>Postal code</span>
                <input
                  type="text"
                  value={contact.postal}
                  onChange={(e) => setContact((c) => ({ ...c, postal: e.target.value }))}
                  aria-invalid={Boolean(fieldErrors.postal)}
                  aria-describedby={fieldErrors.postal ? 'aha-conv-postal-error' : undefined}
                />
                {fieldErrors.postal && <span id="aha-conv-postal-error" className="aha-conversion-field-error">{fieldErrors.postal}</span>}
              </label>

              {action === 'measure' && (
                <fieldset className="aha-conversion-slots">
                  <legend>Pick a time</legend>
                  {slotsError && <p className="aha-card-why-empty">{slotsError}</p>}
                  {!slotsError && !slots.length && <p className="aha-card-why-empty">Loading openings…</p>}
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      className="aha-card-action"
                      data-selected={selectedSlot?.start === s.start}
                      onClick={() => setSelectedSlot(s)}
                      aria-pressed={selectedSlot?.start === s.start}
                    >
                      {s.label}
                    </button>
                  ))}
                </fieldset>
              )}

              <div className="aha-conversion-actions">
                <button type="button" className="aha-card-action" onClick={onCancel}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="aha-card-action aha-card-action--primary"
                  onClick={onContinueToReview}
                  disabled={action === 'measure' && !selectedSlot}
                >
                  Review
                </button>
              </div>
            </div>
          )}

          {(step === 'review' || step === 'submitting' || step === 'error') && (
            <div className="aha-conversion-review">
              <p className="aha-conversion-review-title">Confirm before we send this</p>
              <dl className="aha-conversion-review-rows">
                <div>
                  <dt>Project</dt>
                  <dd>{plan.objective ? (OBJECTIVE_LABEL[plan.objective] ?? plan.objective) : 'Not set'}</dd>
                </div>
                {plan.squareFeet !== undefined && (
                  <div>
                    <dt>Square footage</dt>
                    <dd>{plan.squareFeet.toLocaleString()} sq ft</dd>
                  </div>
                )}
                {!!services?.length && (
                  <div>
                    <dt>Services</dt>
                    <dd>{services.join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt>Cost range</dt>
                  <dd>{formatMoneyRange(plan.costRange)}</dd>
                </div>
                {action === 'measure' && selectedSlot && (
                  <div>
                    <dt>Time</dt>
                    <dd>{selectedSlot.label}</dd>
                  </div>
                )}
                <div>
                  <dt>Contact</dt>
                  <dd>
                    {contact.name} · {contact.email} · {contact.phone}
                  </dd>
                </div>
                {plan.designId && (
                  <div>
                    <dt>Design</dt>
                    <dd>{plan.designId}</dd>
                  </div>
                )}
              </dl>
              <p className="aha-conversion-review-footnote">
                {action === 'measure'
                  ? `The published band applied to your square footage — not a quote. ${BUSINESS_NAP.legalName} writes the fixed price in person, after this measure.`
                  : `${formatMoneyRange(plan.costRange)} is the published band applied to your square footage, not a quote. A specialist writes the fixed price after a free in-home measure.`}
              </p>
              {submitError && <p className="aha-incompatibility" role="alert">{submitError}</p>}
              <div className="aha-conversion-actions">
                <button type="button" className="aha-card-action" onClick={() => setStep('plan')} disabled={step === 'submitting'}>
                  Back
                </button>
                <button
                  type="button"
                  className="aha-card-action aha-card-action--primary"
                  onClick={onConfirm}
                  disabled={step === 'submitting'}
                >
                  {step === 'submitting' ? 'Sending…' : action === 'measure' ? 'Confirm and book' : 'Confirm and send'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
