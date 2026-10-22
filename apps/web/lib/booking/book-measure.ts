/**
 * lib/booking/book-measure.ts — the ONE place an in-home measure is booked.
 *
 * Two customer-facing surfaces create a measure: POST /api/appointments (the
 * booking page and the assistant workspace) and the corner assistant's
 * `book_measure` tool in /api/chat. Each used to carry its own copy of the
 * booking write, and only the first was safe: the chat copy checked capacity
 * OUTSIDE the transaction and wrote at the default isolation level, so two
 * simultaneous bookings (or one booking racing the booking page) could both
 * see a free window and both insert, putting a third estimator on a two-seat
 * window. It also had no idempotency, so a retried tool call booked twice.
 *
 * Both now call this function, which holds the guarantees in one place:
 *
 *   - the capacity re-check, the lead (QuoteRequest) and the Appointment commit
 *     in a single Serializable transaction;
 *   - a P2034 serialization conflict is retried, and on the retry the loser
 *     sees the winner and is told "taken";
 *   - the same person (email) at the same address asking for the same instant
 *     gets the appointment it already holds (no second seat, no second lead);
 *     a different address is a different job and is booked on its own.
 */
import { db } from '@/lib/db';
import { isBookableSlot, SLOT_DURATION_MINUTES, localDateKey } from '@/lib/booking/availability';

export type BookMeasureInput = {
  /** The instant as the client sent it (ISO). Validated against live availability. */
  startsAtIso: string;
  name: string;
  email: string;
  phone: string | null;
  /** Postal code / address of the floor, stored on QuoteRequest.address. */
  address: string | null;
  /** Stored on QuoteRequest.city (the chat tool has always put the postal here). */
  city: string | null;
  service: string;
  squareFeet: number | null;
  /** QuoteRequest.notes. */
  quoteNotes: string | null;
  /** Appointment.notes. */
  appointmentNotes: string | null;
  userId: string | null;
  designId: string | null;
  designCode: string | null;
};

export type BookMeasureResult =
  | { kind: 'booked'; quoteId: string; appointmentId: string; startsAt: Date }
  | { kind: 'already'; appointmentId: string; startsAt: Date }
  | { kind: 'taken' }
  /* Only ever returned after every retry lost a serialization race: the slot
     may well still be free, so the caller must NOT say it was taken. */
  | { kind: 'busy' };

const MAX_ATTEMPTS = 5;

/** Postal codes / street addresses compare by their letters and digits only. */
function addressKey(a: string | null | undefined): string {
  return (a ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Jittered, growing pause so losers of a serialization race stop colliding in lock-step. */
const backoff = (attempt: number) => new Promise<void>((r) => setTimeout(r, Math.random() * 60 * 2 ** attempt));

export async function bookMeasure(input: BookMeasureInput): Promise<BookMeasureResult> {
  const startsAt = new Date(input.startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return { kind: 'taken' };
  const dayKey = localDateKey(startsAt);
  const emailKey = input.email.trim().toLowerCase();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(
        async (tx): Promise<BookMeasureResult> => {
          const sameDay = await tx.appointment.findMany({
            where: {
              status: 'SCHEDULED',
              startsAt: { gte: new Date(`${dayKey}T00:00:00Z`), lte: new Date(`${dayKey}T23:59:59Z`) },
            },
            select: { id: true, startsAt: true, customerEmail: true, quoteRequest: { select: { address: true } } },
          });
          /* A double-click or a retried request is the same booking, not a
             second one. */
          const already = sameDay.find(
            (r) =>
              r.startsAt.getTime() === startsAt.getTime() &&
              (r.customerEmail ?? '').trim().toLowerCase() === emailKey &&
              /* Same household, second property, same hour: not a retry. A row
                 whose address was not loaded is judged on email + instant. */
              (r.quoteRequest === undefined || addressKey(r.quoteRequest?.address) === addressKey(input.address)),
          );
          if (already) return { kind: 'already', appointmentId: already.id, startsAt: already.startsAt };

          const counts = new Map<string, number>();
          for (const r of sameDay) {
            const iso = r.startsAt.toISOString();
            counts.set(iso, (counts.get(iso) ?? 0) + 1);
          }
          if (!isBookableSlot(input.startsAtIso, { now: new Date(), bookingCounts: counts })) return { kind: 'taken' };

          const quote = await tx.quoteRequest.create({
            data: {
              name: input.name,
              email: input.email,
              phone: input.phone,
              address: input.address,
              city: input.city,
              service: input.service,
              squareFeet: input.squareFeet,
              notes: input.quoteNotes,
              userId: input.userId,
              designId: input.designId,
              designCode: input.designCode,
            },
          });
          const appt = await tx.appointment.create({
            data: {
              quoteRequestId: quote.id,
              startsAt,
              durationMinutes: SLOT_DURATION_MINUTES,
              customerName: input.name,
              customerEmail: input.email,
              customerPhone: input.phone,
              notes: input.appointmentNotes,
            },
          });
          return { kind: 'booked', quoteId: quote.id, appointmentId: appt.id, startsAt: appt.startsAt };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (err) {
      const conflict = typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2034';
      if (!conflict) throw err;
      // Still contended after the last retry: do not guess, and do not claim the slot was taken.
      if (attempt === MAX_ATTEMPTS - 1) return { kind: 'busy' };
      await backoff(attempt);
    }
  }
  return { kind: 'busy' };
}
