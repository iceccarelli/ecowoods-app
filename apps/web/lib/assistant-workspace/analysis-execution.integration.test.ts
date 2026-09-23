/**
 * analysis-execution.integration.test.ts — REAL Postgres. Exercises the
 * reserve -> execute -> settle orchestrator end to end, including the
 * exact scenarios directive rule 47 calls out: insufficient balance,
 * duplicate retry, unauthorized/absent wallet.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('runRenovationAnalysis (real Postgres)', () => {
  let db: typeof import('@/lib/db').db;
  let ledger: typeof import('./credit-ledger');
  let exec: typeof import('./analysis-execution');
  let state: typeof import('./state');
  let userId: string;

  beforeAll(async () => {
    db = (await import('@/lib/db')).db;
    ledger = await import('./credit-ledger');
    exec = await import('./analysis-execution');
    state = await import('./state');
    const user = await db.user.create({
      data: { email: `analysis-test-${randomUUID()}@example.com`, name: 'Analysis Test' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.renovationAnalysis.deleteMany({ where: { userId } });
    await db.creditTransaction.deleteMany({ where: { wallet: { userId } } });
    await db.creditWallet.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  function richState() {
    return state.applyPatch(state.defaultWorkspaceState(), {
      objective: 'refinish',
      sellHorizon: 'selling-soon',
      rooms: [{ label: 'Whole project', squareFeet: 900 }],
      personalization: {
        neighbourhood: 'Rexdale',
        floorCondition: 'scratched and dull',
        otherTrades: { roof: 'mentioned' },
      },
    });
  }

  it('fails honestly with not_enough_context when fewer than two projects are known — no charge attempted', async () => {
    const out = await exec.runRenovationAnalysis({
      userId,
      designId: 'test-design-001',
      workspaceState: state.defaultWorkspaceState(),
      idempotencyKey: `run-${randomUUID()}`,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('not_enough_context');
  });

  it('rejects with insufficient_credits when the wallet has nothing, and charges nothing', async () => {
    const out = await exec.runRenovationAnalysis({
      userId,
      designId: 'test-design-001',
      workspaceState: richState(),
      idempotencyKey: `run-${randomUUID()}`,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toBe('insufficient_credits');
    const summary = await ledger.getWalletSummary(userId);
    expect(summary?.balance ?? 0).toBe(0);
  });

  it('runs a real analysis end to end: grant -> reserve -> settle, using the actual stored context', async () => {
    await ledger.grantCredits({ userId, amount: 30, type: 'PROMOTIONAL_GRANT', reason: 'test_grant', idempotencyKey: `grant-${randomUUID()}` });
    const before = await ledger.getWalletSummary(userId);

    const out = await exec.runRenovationAnalysis({
      userId,
      designId: 'test-design-002',
      workspaceState: richState(),
      idempotencyKey: `run-${randomUUID()}`,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.items.some((i) => i.key === 'roof')).toBe(true);
      expect(out.result.items.some((i) => i.key === 'floor')).toBe(true);
      // uses the ACTUAL stored context, not a generic template
      expect(out.result.uncertainty.join(' ')).not.toContain('square footage');
    }

    const after = await ledger.getWalletSummary(userId);
    expect(before!.balance - after!.balance).toBe(20); // exactly the analysis's credit cost, once

    const saved = out.ok ? await exec.getRenovationAnalysis(out.analysisId) : null;
    expect(saved?.status).toBe('COMPLETED');
    expect(saved?.designId).toBe('test-design-002');
    expect(saved?.resultJson).toBeTruthy();
  });

  it('a retried call with the SAME idempotency key never double-charges', async () => {
    await ledger.grantCredits({ userId, amount: 20, type: 'PROMOTIONAL_GRANT', reason: 'top_up_for_test', idempotencyKey: `grant-${randomUUID()}` });
    const key = `run-dup-${randomUUID()}`;
    const before = await ledger.getWalletSummary(userId);
    const first = await exec.runRenovationAnalysis({ userId, designId: 'test-design-003', workspaceState: richState(), idempotencyKey: key });
    const second = await exec.runRenovationAnalysis({ userId, designId: 'test-design-003', workspaceState: richState(), idempotencyKey: key });
    expect(first.ok).toBe(true);
    // The retry's reservation call is idempotent (same key), so it does not
    // create a second reservation/settlement — the balance moves once.
    const after = await ledger.getWalletSummary(userId);
    expect(before!.balance - after!.balance).toBe(20);
    void second;
  });

  it('a saved analysis can be listed and read back later', async () => {
    const analyses = await exec.listRenovationAnalyses(userId, 'test-design-002');
    expect(analyses.length).toBeGreaterThan(0);
    expect(analyses[0]!.designId).toBe('test-design-002');
  });
});
