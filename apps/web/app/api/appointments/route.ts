import { runAfterResponse } from '@/lib/background';
import { NextResponse } from 'next/server';
import { appointmentSchema, APPOINTMENT_SERVICES } from '@ecowoods/shared';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail, sendAppointmentConfirmationEmail } from '@/lib/email';
import { SLOT_DURATION_MINUTES, BUSINESS_TIMEZONE } from '@/lib/booking/availability';
import { bookMeasure } from '@/lib/booking/book-measure';
import { reportConfirmationFailure, sendCustomerConfirmation } from '@/lib/customer-confirmation';
import { checkRateLimit, getClientIp, isTrustedBrowserOrigin, LEAD_POST_LIMIT } from '@/lib/rate-limit';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';
import { recordFunnelEvent, sanitiseSource } from '@/lib/funnel-ledger';
import { sendLeadAlert } from '@/lib/lead-alert';
import { designIdOf } from '@/lib/floor-studio/design-id';
import { markRecoveryConverted } from '@/lib/quote-recovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVICE_LABELS: Record<string, string> = {
  'new-install': 'New Install',
  refinishing: 'Refinishing & Restoration',
  'dust-free-sanding': 'Dust-Free Sanding',
  stairs: 'Stair Refinishing',
  'custom-inlays': 'Custom Inlays & Borders',
  commercial: 'Commercial Project',
};

function whenLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: BUSINESS_TIMEZONE,
  }).format(d);
}

export async function POST(request: Request) {
  // P0.7 — this was the ONE public POST with no rate limit, and it is the most
  // expensive one: every call writes DB rows and sends two emails. Same
  // contract as /api/leads now: origin check first, token bucket 10/min/IP.
  if (!isTrustedBrowserOrigin(request)) {
    return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
  }
  const rl = checkRateLimit(getClientIp(request), LEAD_POST_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Please wait a moment before trying again.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: 'Please check the highlighted fields.', fieldErrors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Honeypot — silently accept so bots learn nothing.
  if (typeof data.company === 'string' && data.company.length > 0) {
    return NextResponse.json({ id: 'ok', startsAt: data.startsAt, durationMinutes: SLOT_DURATION_MINUTES, service: data.service });
  }

  const startsAt = new Date(data.startsAt);

  try {
    const session = await auth();

    /* ASSISTANT-07 — designId/designCode, same fields and same
       designIdOf() validation /api/leads already applies, so a booking that
       started in Ask Francisco (or any future caller that has a design)
       joins to the same design instead of leaving the row unattributed.
       See docs/assistant-workspace/DATA_FLOW_MAP.md's "where this diverges"
       section: this route (not api/chat/route.ts, which is untouched) was
       the gap. */
    const designId = designIdOf(data.designId);
    const designCode = typeof data.designCode === 'string' ? data.designCode.slice(0, 400) : null;

    /* One Serializable transaction (lib/booking/book-measure.ts, shared with
       the corner assistant's book_measure tool): the capacity re-check, the
       lead (QuoteRequest) and the Appointment commit together, a serialization
       conflict is retried, and the same address asking for the same instant
       gets the appointment it already holds. */
    const booked = await bookMeasure({
      startsAtIso: data.startsAt,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      // Same contract as /api/leads: postal code -> address; city is not collected here.
      address: data.postal ?? null,
      city: null,
      service: data.service,
      squareFeet: typeof data.sqft === 'number' ? Math.round(data.sqft) : null,
      quoteNotes: data.notes ?? null,
      appointmentNotes: data.notes ?? null,
      userId: session?.user?.id ?? null,
      designId: designId ?? null,
      designCode,
    });
    if (booked.kind === 'taken') {
      return NextResponse.json(
        { error: 'That time was just taken or is no longer available. Please pick another.' },
        { status: 409 },
      );
    }
    if (booked.kind === 'already') {
      console.log(JSON.stringify({ event: 'appointment.duplicate', appointmentId: booked.appointmentId }));
      return NextResponse.json(
        { id: booked.appointmentId, startsAt: booked.startsAt.toISOString(), durationMinutes: SLOT_DURATION_MINUTES, service: data.service },
        { status: 200 },
      );
    }
    const quote = { id: booked.quoteId };
    const appt = { id: booked.appointmentId, startsAt: booked.startsAt };

    /* MEAS-02 — the brief's `appointment` event. Outside the transaction on
       purpose: a measurement row must never be able to roll back a booking
       that the customer has already been shown as confirmed. Not awaited, for
       the same reason it is not inside the transaction. */
    /* SALE-04 — a booked measure is the most time-critical alert of the
       three: a slot is now held, and if it needs moving the customer should
       hear that today rather than on the day. */
    runAfterResponse(sendLeadAlert({
      kind: 'measure booked',
      name: data.name,
      phone: data.phone ?? null,
      where: data.postal ?? null,
      service: data.service,
      source: sanitiseSource(data.source) ?? 'booking',
    }));
    /* This route creates its own QuoteRequest, so a booking is also a captured
       lead; without this row bookings could outnumber leads in the report. */
    runAfterResponse(recordFunnelEvent({
      stage: 'LEAD_CAPTURED',
      designId,
      source: sanitiseSource(data.source) ?? 'booking',
      quoteId: quote.id,
    }));
    runAfterResponse(recordFunnelEvent({
      stage: 'APPOINTMENT_BOOKED',
      designId,
      source: sanitiseSource(data.source) ?? 'booking',
      quoteId: quote.id,
    }));

    // They finished: cancel any pending "you did not finish" reminder.
    runAfterResponse(markRecoveryConverted(data.email));

    // Notifications — non-blocking; a booking is never lost to a flaky email.
    // The customer's confirmation is retried once; if it still fails the desk
    // is told (SMS + email) instead of the failure living only in a log.
    const label = whenLabel(startsAt);
    const serviceLabel = SERVICE_LABELS[data.service] ?? data.service;
    runAfterResponse((async () => {
      const confirmed = await sendCustomerConfirmation('appointment', quote.id, () =>
        sendAppointmentConfirmationEmail({
          to: data.email, name: data.name, whenLabel: label,
          durationMinutes: SLOT_DURATION_MINUTES, service: serviceLabel,
        }));
      if (!confirmed) {
        await reportConfirmationFailure({
          kind: 'appointment', ref: quote.id, name: data.name, email: data.email, phone: data.phone ?? null, where: data.postal ?? null,
        });
      }
    })());
    runAfterResponse(sendAdminNewQuoteEmail({
      quoteId: quote.id, name: data.name, email: data.email,
      phone: data.phone, city: data.postal, service: serviceLabel,
      notes: `In-home estimate booked for ${label}.${data.notes ? ' ' + data.notes : ''}`,
    }).catch((e) => console.error('[appointments] admin email failed:', e)));

    return NextResponse.json(
      { id: appt.id, startsAt: appt.startsAt.toISOString(), durationMinutes: SLOT_DURATION_MINUTES, service: data.service },
      { status: 201 },
    );
  } catch (err) {
    console.error('[appointments] failed:', err);
    return NextResponse.json(
      { error: `We couldn't confirm that. Please call ${BUSINESS_NAP.phoneDisplay} and we'll book it for you.` },
      { status: 500 },
    );
  }
}
