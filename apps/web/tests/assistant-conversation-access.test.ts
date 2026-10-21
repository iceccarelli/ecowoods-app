/**
 * Regression: `designId` is a SHAREABLE design label (Floor Studio share links
 * carry it) and must never be the credential for an anonymous Ask Francisco
 * conversation. Drives the real route handlers against an in-memory fake of
 * the AssistantConversation / AssistantMessage tables.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Msg { id: string; conversationId: string; role: string; content: string; blocks: unknown; attachments: unknown; model: string | null; createdAt: Date }
interface Conv { id: string; designId: string; userId: string | null; accessTokenHash: string | null }

const state = vi.hoisted(() => ({
  convs: [] as Conv[],
  msgs: [] as Msg[],
  session: null as { user: { id: string } } | null,
  deleted: [] as string[],
  seq: 0,
}));

vi.mock('@/lib/db', () => {
  const pick = (row: Record<string, unknown>, select?: Record<string, unknown>) => {
    if (!select) return row;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(select)) out[k] = row[k];
    return out;
  };
  return {
    db: {
      assistantConversation: {
        findUnique: async ({ where, select }: { where: { designId: string }; select?: Record<string, unknown> }) => {
          const c = state.convs.find((x) => x.designId === where.designId);
          if (!c) return null;
          const row: Record<string, unknown> = { ...c };
          if (select && 'messages' in select) {
            row.messages = state.msgs.filter((m) => m.conversationId === c.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return pick(row, select);
        },
        create: async ({ data }: { data: { designId: string; userId: string | null; accessTokenHash: string } }) => {
          if (state.convs.some((x) => x.designId === data.designId)) throw new Error('unique');
          const c = { id: `conv-${++state.seq}`, designId: data.designId, userId: data.userId, accessTokenHash: data.accessTokenHash };
          state.convs.push(c);
          return { id: c.id };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Conv> }) => {
          Object.assign(state.convs.find((x) => x.id === where.id)!, data);
        },
        updateMany: async ({ where, data }: { where: Partial<Conv>; data: Partial<Conv> }) => {
          for (const c of state.convs.filter((x) => x.id === where.id && x.userId === where.userId && x.accessTokenHash === where.accessTokenHash)) Object.assign(c, data);
        },
      },
      assistantMessage: {
        create: async ({ data }: { data: Omit<Msg, 'id' | 'createdAt' | 'model'> & { model?: string } }) => {
          state.msgs.push({ id: `m-${++state.seq}`, createdAt: new Date(), model: data.model ?? null, ...(data as object) } as Msg);
        },
      },
      $executeRaw: async (_s: TemplateStringsArray, next: string, id: string, expected: string) => {
        const m = state.msgs.find((x) => x.id === id);
        if (!m || JSON.stringify(m.attachments) !== JSON.stringify(JSON.parse(expected))) return 0;
        m.attachments = JSON.parse(next);
        return 1;
      },
    },
  };
});

vi.mock('@/lib/auth', () => ({ auth: async () => state.session }));
vi.mock('@/lib/rate-limit-durable', () => ({ enforceRateLimit: async () => ({ allowed: true, retryAfterSeconds: 0 }) }));
vi.mock('@/lib/floor-graph/consent', () => ({
  grantConsent: async () => 'consent-1',
  withdrawConsentById: async () => true,
}));
vi.mock('@/lib/image-sniff', () => ({
  sniffFile: async () => ({ contentType: 'image/png', ext: 'png' }),
  safeFilename: () => 'room.png',
}));
vi.mock('@/lib/assistant-workspace/attachment-storage', () => ({
  storeAttachment: async (_b: Buffer, key: string) => ({ ok: true, path: `supabase://assistant-attachments/${key}.png` }),
  signAttachmentUrl: async (p: string) => `https://signed.example/${encodeURIComponent(p)}`,
  deleteAttachment: async (p: string) => {
    state.deleted.push(p);
    return true;
  },
  attachmentConsentSurface: (id: string) => `assistant-chat:attachment:${id}`,
}));

import { GET as getConversation } from '@/app/api/assistant/conversation/route';
import { POST as uploadAttachment } from '@/app/api/assistant/attachments/route';
import { DELETE as deleteAttachment } from '@/app/api/assistant/attachments/[id]/route';
import { appendTurn, establishConversation, loadTranscript } from '@/lib/assistant-workspace/conversation-store';
import { ACCESS_COOKIE_PREFIX } from '@/lib/assistant-workspace/conversation-access';
import { decodeStudioDesign, emptyStudioDesign, encodeStudioDesign } from '@/lib/floor-studio/studio-config';

const DESIGN = 'abcdefgh1234';

function cookieOf(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  return raw.split(';')[0]!; // name=value
}

async function upload(designId: string, cookie?: string): Promise<Response> {
  const form = new FormData();
  form.append('designId', designId);
  form.append('photo', new File([new Uint8Array([1, 2, 3])], 'room.png', { type: 'image/png' }));
  return uploadAttachment(new Request('http://localhost/api/assistant/attachments', { method: 'POST', body: form, headers: cookie ? { cookie } : {} }));
}

const readTranscript = (designId: string, cookie?: string) =>
  getConversation(new Request(`http://localhost/api/assistant/conversation?designId=${designId}`, { headers: cookie ? { cookie } : {} }));

const del = (designId: string, id: string, cookie?: string) =>
  deleteAttachment(new Request(`http://localhost/api/assistant/attachments/${id}?designId=${designId}`, { method: 'DELETE', headers: cookie ? { cookie } : {} }), {
    params: Promise.resolve({ id }),
  });

/** The homeowner uploads a photo, then tells Francisco something private. Returns the capability cookie and the attachment id. */
async function homeownerSession() {
  const res = await upload(DESIGN);
  expect(res.status).toBe(201);
  const cookie = cookieOf(res);
  const body = await res.json();
  const access = await establishConversation(DESIGN, null, cookie.split('=')[1]!);
  expect(access.ok).toBe(true);
  if (!access.ok) throw new Error('unreachable');
  // Persist the photo ref the way the chat route does, plus a private message.
  await appendTurn({
    conversationId: access.conversationId,
    role: 'user',
    content: 'My name is Maria Lopez, 12 Elm St.',
    attachments: [{ id: body.id, kind: 'room_photo', status: 'analyzed', filename: 'room.png', url: body.path, consentId: 'consent-1' }],
  });
  return { cookie, attachmentId: body.id as string };
}

beforeEach(() => {
  state.convs.length = 0;
  state.msgs.length = 0;
  state.deleted.length = 0;
  state.session = null;
  state.seq = 0;
});

describe('anonymous conversation access is not granted by designId', () => {
  it('upload mints an httpOnly capability cookie; only its hash is stored', async () => {
    const res = await upload(DESIGN);
    expect(res.status).toBe(201);
    const setCookie = res.headers.get('set-cookie')!;
    expect(setCookie).toMatch(new RegExp(`^${ACCESS_COOKIE_PREFIX}${DESIGN}=[A-Za-z0-9_-]{43};`));
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    const token = setCookie.split(';')[0]!.split('=')[1]!;
    expect(state.convs[0]!.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(state.convs)).not.toContain(token);
  });

  it('designId alone cannot read the transcript; the owner token can', async () => {
    const { cookie } = await homeownerSession();

    const stranger = await (await readTranscript(DESIGN)).json();
    expect(stranger.turns).toEqual([]);
    expect(JSON.stringify(stranger)).not.toContain('Maria');

    const wrongToken = await (await readTranscript(DESIGN, `${ACCESS_COOKIE_PREFIX}${DESIGN}=${'Z'.repeat(43)}`)).json();
    expect(wrongToken.turns).toEqual([]);

    const owner = await (await readTranscript(DESIGN, cookie)).json();
    expect(owner.turns).toHaveLength(1);
    expect(owner.turns[0].content).toContain('Maria Lopez');
    expect(owner.turns[0].attachments[0].url).toContain('signed.example'); // preview only for the owner
  });

  it('designId alone cannot see or delete attachments; the owner token can', async () => {
    const { cookie, attachmentId } = await homeownerSession();

    expect((await del(DESIGN, attachmentId)).status).toBe(403);
    expect((await del(DESIGN, attachmentId, `${ACCESS_COOKIE_PREFIX}${DESIGN}=${'Z'.repeat(43)}`)).status).toBe(403);
    expect(state.deleted).toEqual([]);
    expect((state.msgs[0]!.attachments as Array<{ status: string }>)[0]!.status).toBe('analyzed');

    const ok = await del(DESIGN, attachmentId, cookie);
    expect(ok.status).toBe(200);
    expect((await ok.json()).complete).toBe(true);
    expect(state.deleted).toHaveLength(1);
  });

  it('designId alone cannot upload photos into, or write turns to, someone else\'s conversation', async () => {
    const { cookie } = await homeownerSession();
    const before = state.msgs.length;

    expect((await upload(DESIGN)).status).toBe(403);
    expect(await establishConversation(DESIGN, null, null)).toEqual({ ok: false, reason: 'forbidden' });
    expect(state.msgs.length).toBe(before);

    expect((await upload(DESIGN, cookie)).status).toBe(201); // owner still can
  });

  it('a signed-in owner keeps working without the cookie; another account does not', async () => {
    const { cookie } = await homeownerSession();
    state.session = { user: { id: 'user-1' } };
    // Owner links their account using the capability…
    expect((await establishConversation(DESIGN, 'user-1', cookie.split('=')[1]!)).ok).toBe(true);
    // …after which the session alone is enough, from any browser.
    expect((await (await readTranscript(DESIGN)).json()).turns).toHaveLength(1);
    state.session = { user: { id: 'user-2' } };
    expect((await (await readTranscript(DESIGN, cookie)).json()).turns).toEqual([]);
    expect(await loadTranscript(DESIGN, null, cookie.split('=')[1]!)).toEqual([]);
  });

  it('a pre-fix anonymous conversation (no stored hash) is unreadable and degrades to a fresh empty conversation', async () => {
    state.convs.push({ id: 'legacy', designId: DESIGN, userId: null, accessTokenHash: null });
    state.msgs.push({ id: 'm-legacy', conversationId: 'legacy', role: 'user', content: 'old private note', blocks: null, attachments: null, model: null, createdAt: new Date() });

    expect(await loadTranscript(DESIGN, null, null)).toEqual([]);

    const res = await upload(DESIGN); // no crash, new conversation
    expect(res.status).toBe(201);
    const cookie = cookieOf(res);
    expect(await loadTranscript(DESIGN, null, cookie.split('=')[1]!)).toEqual([]); // nothing of the old transcript
    expect(state.convs.find((c) => c.id === 'legacy')!.designId).not.toBe(DESIGN); // detached, not reachable by id
  });
});

describe('Floor Studio share link still carries the floor only', () => {
  const design = () => ({ ...emptyStudioDesign(), designId: DESIGN });

  it('round-trips the floor and designId, with no transcript, photo or access capability in the code', () => {
    const code = encodeStudioDesign(design());
    expect(code).toContain(`d=${DESIGN}`);
    expect(code).not.toMatch(/token|cookie|transcript|photo|ew_ac/i);
    const back = decodeStudioDesign(code);
    expect(back?.designId).toBe(DESIGN);
    expect(back?.config).toEqual(design().config);
  });

  it('knowing the share-link designId grants no conversation access', async () => {
    const { cookie } = await homeownerSession();
    const idFromLink = decodeStudioDesign(encodeStudioDesign(design()))!.designId!;
    expect(idFromLink).toBe(DESIGN);
    expect((await (await readTranscript(idFromLink)).json()).turns).toEqual([]);
    expect((await (await readTranscript(idFromLink, cookie)).json()).turns).toHaveLength(1);
  });
});
