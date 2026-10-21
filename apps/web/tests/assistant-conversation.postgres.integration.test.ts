/**
 * Real PostgreSQL checks for the assistant conversation store: capability
 * (access-token hash) flow, the legacy no-hash row rename path, and the
 * unique-designId creation race. Runs only with RUN_POSTGRES_INTEGRATION=1.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { newDesignId } from '@/lib/floor-studio/design-id';

const enabled = process.env.RUN_POSTGRES_INTEGRATION === '1';

describe.skipIf(!enabled)('assistant conversation store against real PostgreSQL', () => {
  const designIds: string[] = [];
  const userIds: string[] = [];

  const freshDesignId = () => {
    const id = newDesignId();
    designIds.push(id);
    return id;
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(async () => {
    if (!enabled) return;
    const { db } = await import('@/lib/db');
    await db.assistantConversation.deleteMany({
      where: { OR: [{ designId: { in: designIds } }, { designId: { startsWith: 'lg' }, id: { in: legacyIds } }] },
    });
    for (const id of userIds) await db.user.delete({ where: { id } }).catch(() => undefined);
  });
  const legacyIds: string[] = [];

  it('establish mints a capability once; the token (and only the token) opens the transcript', async () => {
    const { db } = await import('@/lib/db');
    const { establishConversation, appendTurn, loadTranscript } = await import('@/lib/assistant-workspace/conversation-store');
    const { hashAccessToken } = await import('@/lib/assistant-workspace/conversation-access');
    const designId = freshDesignId();

    const created = await establishConversation(designId, null, null);
    expect(created.ok).toBe(true);
    if (!created.ok || !created.newToken) throw new Error('expected a new token');
    const row = await db.assistantConversation.findUniqueOrThrow({ where: { designId } });
    expect(row.accessTokenHash).toBe(hashAccessToken(created.newToken));
    expect(row.accessTokenHash).not.toContain(created.newToken);

    await appendTurn({ conversationId: created.conversationId, role: 'user', content: 'hello' });
    await new Promise((r) => setTimeout(r, 5));
    await appendTurn({ conversationId: created.conversationId, role: 'assistant', content: 'hi there' });

    const withToken = await loadTranscript(designId, null, created.newToken);
    expect(withToken.map((t) => t.content)).toEqual(['hello', 'hi there']);
    expect(await loadTranscript(designId, null, null)).toEqual([]);
    expect(await loadTranscript(designId, null, 'A'.repeat(43))).toEqual([]);
    expect(await loadTranscript(designId, randomUUID(), null)).toEqual([]);

    // Re-establishing: the holder reuses it (no new token); a stranger is forbidden.
    expect(await establishConversation(designId, null, created.newToken)).toEqual({ ok: true, conversationId: created.conversationId });
    expect(await establishConversation(designId, null, null)).toEqual({ ok: false, reason: 'forbidden' });
    expect(await establishConversation(designId, null, 'B'.repeat(43))).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('a signed-in holder links the account onto the anonymous row; afterwards only that session opens it', async () => {
    const { db } = await import('@/lib/db');
    const { establishConversation, appendTurn, loadTranscript } = await import('@/lib/assistant-workspace/conversation-store');
    const user = await db.user.create({ data: { email: `conv-${randomUUID()}@example.test` } });
    userIds.push(user.id);
    const designId = freshDesignId();
    const created = await establishConversation(designId, null, null);
    if (!created.ok || !created.newToken) throw new Error('expected a new token');
    await appendTurn({ conversationId: created.conversationId, role: 'user', content: 'mine' });

    expect(await establishConversation(designId, user.id, created.newToken)).toEqual({ ok: true, conversationId: created.conversationId });
    expect((await db.assistantConversation.findUniqueOrThrow({ where: { designId } })).userId).toBe(user.id);

    expect((await loadTranscript(designId, user.id, null)).map((t) => t.content)).toEqual(['mine']);
    expect(await loadTranscript(designId, null, created.newToken)).toEqual([]); // token no longer consulted
    expect(await establishConversation(designId, null, created.newToken)).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('a legacy anonymous row with no hash is detached (renamed, data kept) and a fresh conversation takes the designId', async () => {
    const { db } = await import('@/lib/db');
    const { establishConversation, loadTranscript } = await import('@/lib/assistant-workspace/conversation-store');
    const designId = freshDesignId();
    const legacy = await db.assistantConversation.create({
      data: { designId, messages: { create: [{ role: 'user', content: 'old private message' }] } },
    });
    legacyIds.push(legacy.id);
    // Nobody holds a credential for it, so it reads as empty even before the rename.
    expect(await loadTranscript(designId, null, 'C'.repeat(43))).toEqual([]);

    const out = await establishConversation(designId, null, null);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.conversationId).not.toBe(legacy.id);
    expect(out.newToken).toBeTruthy();

    const renamed = await db.assistantConversation.findUniqueOrThrow({ where: { id: legacy.id }, include: { messages: true } });
    expect(renamed.designId).toBe(`lg${legacy.id.replace(/-/g, '').slice(0, 14)}`);
    expect(renamed.designId).toHaveLength(16);
    expect(renamed.messages).toHaveLength(1); // retained
    expect((await db.assistantConversation.findUniqueOrThrow({ where: { designId } })).id).toBe(out.conversationId);
    // The new conversation starts empty and does not inherit the old messages.
    expect(await loadTranscript(designId, null, out.newToken!)).toEqual([]);
  });

  it('racing first-time establishes on one designId: exactly one wins the capability, the rest are forbidden, one row exists', async () => {
    const { db } = await import('@/lib/db');
    const { establishConversation } = await import('@/lib/assistant-workspace/conversation-store');
    const designId = freshDesignId();
    const results = await Promise.all(Array.from({ length: 10 }, () => establishConversation(designId, null, null)));
    const winners = results.filter((r) => r.ok && r.newToken);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'forbidden')).toHaveLength(9);
    expect(results.filter((r) => !r.ok && r.reason === 'db_error')).toHaveLength(0);
    expect(await db.assistantConversation.count({ where: { designId } })).toBe(1);
  });

  it('racing establishes against a legacy hashless row: one fresh conversation, no db_error, legacy row preserved', async () => {
    const { db } = await import('@/lib/db');
    const { establishConversation } = await import('@/lib/assistant-workspace/conversation-store');
    const designId = freshDesignId();
    const legacy = await db.assistantConversation.create({ data: { designId } });
    legacyIds.push(legacy.id);
    const results = await Promise.all(Array.from({ length: 8 }, () => establishConversation(designId, null, null)));
    expect(results.filter((r) => r.ok && r.newToken)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.reason === 'db_error')).toHaveLength(0);
    expect(await db.assistantConversation.count({ where: { designId } })).toBe(1);
    expect((await db.assistantConversation.findUniqueOrThrow({ where: { id: legacy.id } })).designId).not.toBe(designId);
  });

  it('the unique constraint on designId is enforced by the schema', async () => {
    const { db } = await import('@/lib/db');
    const designId = freshDesignId();
    await db.assistantConversation.create({ data: { designId, accessTokenHash: 'a'.repeat(64) } });
    await expect(db.assistantConversation.create({ data: { designId, accessTokenHash: 'b'.repeat(64) } })).rejects.toMatchObject({ code: 'P2002' });
  });
});
