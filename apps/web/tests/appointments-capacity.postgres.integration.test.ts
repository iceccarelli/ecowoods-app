/**
 * Real PostgreSQL integration test for appointment capacity.
 *
 * Unlike appointments-capacity.test.ts, this test does not mock Prisma or
 * serialize transactions in memory. It is enabled only in the dedicated CI
 * job, which provisions an empty disposable PostgreSQL 16 database.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { computeAvailability, SLOTS_PER_WINDOW } from "@/lib/booking/availability";

vi.mock("@/lib/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/lead-alert", () => ({ sendLeadAlert: async () => undefined }));
vi.mock("@/lib/funnel-ledger", () => ({ recordFunnelEvent: async () => undefined, sanitiseSource: (s?: string) => s ?? null }));
vi.mock("@/lib/email", () => ({ sendAppointmentConfirmationEmail: async () => undefined, sendAdminNewQuoteEmail: async () => undefined }));
vi.mock("@/lib/background", () => ({ runAfterResponse: (p: Promise<unknown>) => { void p.catch(() => undefined); } }));

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";

describe.skipIf(!enabled)("POST /api/appointments capacity against real PostgreSQL", () => {
  let db: (typeof import("@/lib/db"))["db"] | undefined;
  let route: typeof import("@/app/api/appointments/route") | undefined;
  let marker: string | null = null;
  const usedMarkers: string[] = [];
  let ip = 0;

  beforeAll(async () => {
    db = (await import("@/lib/db")).db;
    route = await import("@/app/api/appointments/route");
  });

  async function taggedRows() {
    if (!db || !marker) throw new Error("Test database or marker not initialized");
    const quotes = await db.quoteRequest.findMany({ where: { notes: marker }, select: { id: true } });
    const ids = quotes.map((quote) => quote.id);
    const appointments = ids.length
      ? await db.appointment.findMany({
          where: { quoteRequestId: { in: ids } },
          select: { id: true, startsAt: true, status: true },
        })
      : [];
    return { quotes, appointments };
  }

  async function deleteTaggedRows() {
    if (!db || usedMarkers.length === 0) return;
    const quotes = await db.quoteRequest.findMany({ where: { notes: { in: usedMarkers } }, select: { id: true } });
    const ids = quotes.map((quote) => quote.id);
    if (ids.length) {
      await db.appointment.deleteMany({ where: { quoteRequestId: { in: ids } } });
      await db.quoteRequest.deleteMany({ where: { id: { in: ids } } });
    }
  }

  async function book(startsAt: string, email?: string): Promise<Response> {
    if (!route || !marker) throw new Error("Test route or marker not initialized");
    ip += 1;
    return route.POST(new Request("http://localhost/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100." + ip },
      body: JSON.stringify({
        startsAt,
        name: "Postgres Integration Test",
        // Distinct customers by default: the same email asking for the same instant is a
        // double-submit and is answered with the held appointment, not a second seat.
        email: email ?? "postgres-integration+" + ip + "@example.test",
        phone: "416-555-0100",
        postal: "M5V 2T6",
        service: "new-install",
        notes: marker,
      }),
    }));
  }

  afterAll(async () => {
    if (!db) return;
    try {
      await deleteTaggedRows();
    } finally {
      await db.$disconnect();
    }
  });

  it("does not overbook a slot under concurrent Serializable transactions", async () => {
    marker = "appointment-postgres-capacity-" + randomUUID();
    usedMarkers.push(marker);
    const now = new Date();
    const slot = computeAvailability({ now, bookingCounts: new Map() }).days
      .flatMap((day) => day.slots)
      .find((candidate) => candidate.available && new Date(candidate.start).getTime() > Date.now() + 36 * 60 * 60 * 1000)?.start;
    expect(slot).toBeTruthy();

    // Concurrent arrivals contend at the actual PostgreSQL predicate read and insert.
    const firstWave = await Promise.all(Array.from({ length: 6 }, () => book(slot!)));
    expect(firstWave.every((response) => response.status === 201 || response.status === 409)).toBe(true);
    const firstWaveAccepted = firstWave.filter((response) => response.status === 201).length;
    expect(firstWaveAccepted).toBeGreaterThan(0);
    expect(firstWaveAccepted).toBeLessThanOrEqual(SLOTS_PER_WINDOW);

    let rows = await taggedRows();
    expect(rows.appointments).toHaveLength(firstWaveAccepted);
    expect(rows.quotes).toHaveLength(firstWaveAccepted); // no orphan QuoteRequest on a rejected capacity check

    // If PostgreSQL correctly rejected conflicting transactions, sequential retries can fill any remaining places.
    while (rows.appointments.filter((appointment) => appointment.status === "SCHEDULED" && new Date(appointment.startsAt).getTime() === new Date(slot!).getTime()).length < SLOTS_PER_WINDOW) {
      expect((await book(slot!)).status).toBe(201);
      rows = await taggedRows();
    }

    expect(rows.appointments.filter((appointment) => appointment.status === "SCHEDULED" && new Date(appointment.startsAt).getTime() === new Date(slot!).getTime())).toHaveLength(SLOTS_PER_WINDOW);
    expect(rows.quotes).toHaveLength(SLOTS_PER_WINDOW);
    expect((await book(slot!)).status).toBe(409);
    expect((await taggedRows()).appointments).toHaveLength(SLOTS_PER_WINDOW);
  });
  it("answers a double-submit from the same address with the held appointment, not a second seat", async () => {
    marker = "appointment-postgres-dupe-" + randomUUID();
    usedMarkers.push(marker);
    const slot = computeAvailability({ now: new Date(), bookingCounts: new Map() }).days
      .flatMap((day) => day.slots)
      .filter((candidate) => candidate.available && new Date(candidate.start).getTime() > Date.now() + 36 * 60 * 60 * 1000)
      .at(-1)?.start; // the capacity test above fills the first open slot; use a different one
    expect(slot).toBeTruthy();

    const first = await book(slot!, "postgres-dupe@example.test");
    expect(first.status).toBe(201);
    const second = await book(slot!, "postgres-dupe@example.test");
    expect(second.status).toBe(200);
    expect((await second.json()).id).toBe((await first.json()).id);

    const rows = await taggedRows();
    expect(rows.appointments).toHaveLength(1);
    expect(rows.quotes).toHaveLength(1);
  });
});
