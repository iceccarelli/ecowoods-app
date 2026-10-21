/**
 * Real PostgreSQL check that concurrent chargeForAnalysis calls cannot
 * overdraw a wallet. Runs only with RUN_POSTGRES_INTEGRATION=1 against a
 * disposable database (same gate as appointments-capacity.postgres.integration.test.ts);
 * skips cleanly otherwise.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";

describe.skipIf(!enabled)("chargeForAnalysis against real PostgreSQL", () => {
  const email = `credits-race-${randomUUID()}@example.test`;
  let userId: string | null = null;

  afterAll(async () => {
    if (!enabled || !userId) return;
    const { db } = await import("@/lib/db");
    await db.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("two parallel charges against a balance for one: exactly one wins", async () => {
    const { db } = await import("@/lib/db");
    const { chargeForAnalysis } = await import("@/lib/credit-ledger");
    const user = await db.user.create({ data: { email } });
    userId = user.id;
    await db.creditWallet.create({ data: { userId: user.id, balance: 5 } });

    const run = () =>
      chargeForAnalysis({
        userId: user.id,
        credits: 5,
        requestIdempotencyKey: `race-${randomUUID()}`,
        contextSnapshot: {},
        compute: () => ({ ok: true }),
      });
    const outcomes = await Promise.all([run(), run()]);

    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    const wallet = await db.creditWallet.findUniqueOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(0);
    expect(await db.creditTransaction.count({ where: { userId: user.id, type: "SETTLE" } })).toBe(1);
  });
});
