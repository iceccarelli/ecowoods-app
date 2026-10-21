import { runAfterResponse } from '@/lib/background';
import { NextResponse } from 'next/server';
import { appointmentSchema, APPOINTMENT_SERVICES } from '@ecowoods/shared';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail, sendAppointmentConfirmationEmail } from '@/lib/email';
import {
  isBookableSlot, localDateKey, SLOT_DURATION_MINUTES, BUSINESS_TIMEZONE,
} from '@/lib/booking/availability';
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

    const dayKey = localDateKey(startsAt);

    /* ASSISTANT-07 — designId/designCode, same fields and same
       designIdOf() validation /api/leads already applies, so a booking that
       started in Ask Francisco (or any future caller that has a design)
       joins to the same design instead of leaving the row unattributed.
       See docs/assistant-workspace/DATA_FLOW_MAP.md's "where this diverges"
       section: this route (not api/chat/route.ts, which is untouched) was
       the gap. */
    const designId = designIdOf(data.designId);
    const designCode = typeof data.designCode === 'string' ? data.designCode.slice(0, 400) : null;

    /* One Serializable transaction: the capacity re-check, the lead
       (QuoteRequest) and the Appointment commit together. Checking outside the
       transaction let two simultaneous bookings both see a free slot and both
       insert. Under Serializable, Postgres aborts one of two conflicting
       count-then-insert transactions (P2034); it is retried, and on the retry
       it sees the other booking and answers "just taken". */
    const SLOT_TAKEN = Symbol('slot taken');
    const ALREADY_BOOKED = Symbol('already booked');
    type Booked = { quote: { id: string }; appt: { id: string; startsAt: Date } };
    let booked: Booked | { [ALREADY_BOOKED]: { id: string; startsAt: Date } } | typeof SLOT_TAKEN | null = null;
    const emailKey = data.email.trim().toLowerCase();
    for (let attempt = 0; attempt < 3 && booked === null; attempt++) {
      try {
        booked = await db.$transaction(
          async (tx) => {
            const sameDay = await tx.appointment.findMany({
              where: {
                status: 'SCHEDULED',
                startsAt: { gte: new Date(`${dayKey}T00:00:00Z`), lte: new Date(`${dayKey}T23:59:59Z`) },
              },
              select: { id: true, startsAt: true, customerEmail: true },
            });
            /* A double-click or a retried request is the same booking, not a
               second one: the same address asking for the same instant gets the
               appointment it already holds (and no second estimator slot, lead
               row or email) instead of consuming the window's other seat. */
            const already = sameDay.find(
              (r) => r.startsAt.getTime() === startsAt.getTime() && (r.customerEmail ?? '').trim().toLowerCase() === emailKey,
            );
            if (already) return { [ALREADY_BOOKED]: { id: already.id, startsAt: already.startsAt } };
            const counts = new Map<string, number>();
            for (const r of sameDay) {
              const iso = r.startsAt.toISOString();
              counts.set(iso, (counts.get(iso) ?? 0) + 1);
            }
            if (!isBookableSlot(data.startsAt, { now: new Date(), bookingCounts: counts })) return SLOT_TAKEN;

            const quote = await tx.quoteRequest.create({
              data: {
                name: data.name,
                email: data.email,
                phone: data.phone ?? null,
                // Same contract as /api/leads: postal code -> address; city is not collected here.
                address: data.postal ?? null,
                city: null,
                service: data.service,
                squareFeet: typeof data.sqft === 'number' ? Math.round(data.sqft) : null,
                notes: data.notes ?? null,
                userId: session?.user?.id ?? null,
                designId: designId ?? null,
                designCode,
              },
            });
            const appt = await tx.appointment.create({
              data: {
                quoteRequestId: quote.id,
                startsAt,
                durationMinutes: SLOT_DURATION_MINUTES,
                customerName: data.name,
                customerEmail: data.email,
                customerPhone: data.phone ?? null,
                notes: data.notes ?? null,
              },
            });
            return { quote, appt };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (err) {
        const conflict = typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2034';
        if (!conflict || attempt === 2) {
          if (conflict) booked = SLOT_TAKEN; // still contended after retries: do not guess, ask them to pick again
          else throw err;
        }
      }
    }
    if (booked === SLOT_TAKEN || booked === null) {
      return NextResponse.json(
        { error: 'That time was just taken or is no longer available. Please pick another.' },
        { status: 409 },
      );
    }
    if (typeof booked === 'object' && ALREADY_BOOKED in booked) {
      const held = booked[ALREADY_BOOKED];
      console.log(JSON.stringify({ event: 'appointment.duplicate', appointmentId: held.id }));
      return NextResponse.json(
        { id: held.id, startsAt: held.startsAt.toISOString(), durationMinutes: SLOT_DURATION_MINUTES, service: data.service },
        { status: 200 },
      );
    }
    const { quote, appt } = booked as Booked;

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
    runAfterResponse(recordFunnelEvent({
      stage: 'APPOINTMENT_BOOKED',
      designId,
      source: sanitiseSource(data.source) ?? 'booking',
      quoteId: quote.id,
    }));

    // They finished: cancel any pending "you did not finish" reminder.
    runAfterResponse(markRecoveryConverted(data.email));

    // Notifications — non-blocking; a booking is never lost to a flaky email.
    const label = whenLabel(startsAt);
    const serviceLabel = SERVICE_LABELS[data.service] ?? data.service;
    runAfterResponse(sendAppointmentConfirmationEmail({
      to: data.email, name: data.name, whenLabel: label,
      durationMinutes: SLOT_DURATION_MINUTES, service: serviceLabel,
    }).catch((e) => console.error('[appointments] customer email failed:', e)));
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
