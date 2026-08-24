import { NextResponse } from 'next/server';
import { appointmentSchema, APPOINTMENT_SERVICES } from '@ecowoods/shared';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { sendAdminNewQuoteEmail, sendAppointmentConfirmationEmail } from '@/lib/email';
import {
  isBookableSlot, localDateKey, SLOT_DURATION_MINUTES, BUSINESS_TIMEZONE,
} from '@/lib/booking/availability';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

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

    // Authoritative server-side recheck with live counts (client can be stale).
    const dayKey = localDateKey(startsAt);
    const sameDay = await db.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: { gte: new Date(`${dayKey}T00:00:00Z`), lte: new Date(`${dayKey}T23:59:59Z`) },
      },
      select: { startsAt: true },
    });
    const counts = new Map<string, number>();
    for (const r of sameDay) {
      const iso = r.startsAt.toISOString();
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
    if (!isBookableSlot(data.startsAt, { now: new Date(), bookingCounts: counts })) {
      return NextResponse.json(
        { error: 'That time was just taken or is no longer available. Please pick another.' },
        { status: 409 },
      );
    }

    // One transaction: create the lead (QuoteRequest) + the Appointment on it.
    const { quote, appt } = await db.$transaction(async (tx) => {
      const quote = await tx.quoteRequest.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          city: data.postal ?? null,
          service: data.service,
          squareFeet: typeof data.sqft === 'number' ? data.sqft : null,
          notes: data.notes ?? null,
          userId: session?.user?.id ?? null,
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
    });

    // Notifications — non-blocking; a booking is never lost to a flaky email.
    const label = whenLabel(startsAt);
    const serviceLabel = SERVICE_LABELS[data.service] ?? data.service;
    sendAppointmentConfirmationEmail({
      to: data.email, name: data.name, whenLabel: label,
      durationMinutes: SLOT_DURATION_MINUTES, service: serviceLabel,
    }).catch((e) => console.error('[appointments] customer email failed:', e));
    sendAdminNewQuoteEmail({
      quoteId: quote.id, name: data.name, email: data.email,
      phone: data.phone, city: data.postal, service: serviceLabel,
      notes: `In-home estimate booked for ${label}.${data.notes ? ' ' + data.notes : ''}`,
    }).catch((e) => console.error('[appointments] admin email failed:', e));

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
