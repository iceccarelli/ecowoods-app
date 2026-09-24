/**
 * OWN-01 — the first real write to FloorRecord, through the real route
 * handler (POST /api/admin/floor-graph/outcome). Only Prisma and auth() are
 * faked; createFloorRecord/recordAssessment (lib/floor-graph/index.ts) run
 * for real against the fake db.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Project = { id: string; city: string | null; province: string | null; squareFeet: number | null; species: unknown };
type FloorRecord = { id: string; publicRef: string; originProjectId: string | null; [k: string]: unknown };
type FloorAssessment = { id: string; floorRecordId: string | null; source: string; reviewedBy: string | null; [k: string]: unknown };
type JobOutcome = { id: string; projectId: string | null; floorRecordId: string | null; [k: string]: unknown };

const state = vi.hoisted(() => ({
  projects: new Map<string, Project>(),
  floorRecords: new Map<string, FloorRecord>(),
  assessments: [] as FloorAssessment[],
  outcomes: [] as JobOutcome[],
  session: null as null | { user: { email: string; role: string } },
}));

vi.mock('@/lib/db', () => ({
  db: {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) => state.projects.get(where.id) ?? null,
    },
    floorRecord: {
      findFirst: async ({ where }: { where: { originProjectId: string } }) =>
        [...state.floorRecords.values()].find((r) => r.originProjectId === where.originProjectId) ?? null,
      count: async () => state.floorRecords.size,
      create: async ({ data }: { data: Omit<FloorRecord, 'id'> }) => {
        const id = crypto.randomUUID();
        const row = { id, ...data } as FloorRecord;
        state.floorRecords.set(id, row);
        return { id: row.id, publicRef: row.publicRef };
      },
    },
    floorAssessment: {
      create: async ({ data }: { data: Omit<FloorAssessment, 'id'> }) => {
        const row = { id: crypto.randomUUID(), ...data } as FloorAssessment;
        state.assessments.push(row);
        return { id: row.id };
      },
    },
    jobOutcome: {
      create: async ({ data }: { data: Omit<JobOutcome, 'id'> }) => {
        const row = { id: crypto.randomUUID(), ...data } as JobOutcome;
        state.outcomes.push(row);
        return { id: row.id };
      },
    },
    quoteRequest: { findFirst: async () => null },
    prediction: { findMany: async () => [] },
  },
}));

vi.mock('@/lib/auth', () => ({ auth: async () => state.session }));

const outcomeRoute = await import('@/app/api/admin/floor-graph/outcome/route');

function postJson(body: unknown): Request {
  return new Request('http://localhost/api/admin/floor-graph/outcome', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.projects.clear();
  state.floorRecords.clear();
  state.assessments.length = 0;
  state.outcomes.length = 0;
  state.session = { user: { email: 'estimator@ecowoods.ca', role: 'ADMIN' } };
  state.projects.set('11111111-1111-1111-1111-111111111111', {
    id: '11111111-1111-1111-1111-111111111111',
    city: 'Etobicoke',
    province: 'ON',
    squareFeet: 850,
    species: ['white-oak'],
  });
});

afterEach(() => vi.restoreAllMocks());

describe('POST /api/admin/floor-graph/outcome — Floor Passport activation', () => {
  it('requires admin', async () => {
    state.session = { user: { email: 'x@example.com', role: 'USER' } };
    const res = await outcomeRoute.POST(postJson({ projectId: '11111111-1111-1111-1111-111111111111' }));
    expect(res.status).toBe(401);
  });

  it('creates no FloorRecord when saveToFloorPassport is not set — pure backward compatibility', async () => {
    const res = await outcomeRoute.POST(postJson({ projectId: '11111111-1111-1111-1111-111111111111', service: 'full-sand-and-finish' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.floorRecordId).toBeNull();
    expect(state.floorRecords.size).toBe(0);
  });

  it('creates a FloorRecord from real Project facts only — never invents a value', async () => {
    const res = await outcomeRoute.POST(
      postJson({ projectId: '11111111-1111-1111-1111-111111111111', service: 'full-sand-and-finish', saveToFloorPassport: true }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.floorRecordId).toBeTruthy();

    const record = state.floorRecords.get(body.floorRecordId)!;
    expect(record.city).toBe('Etobicoke');
    expect(record.province).toBe('ON');
    expect(record.areaSqFt).toBe(850);
    expect(record.species).toBe('white-oak');
    expect(record.originProjectId).toBe('11111111-1111-1111-1111-111111111111');
    expect(record.publicRef).toMatch(/^FR-\d{4}-0001$/);
    // Nothing the admin didn't type is invented for the physical facts:
    expect(record.pattern).toBeNull();
    expect(record.finishSystem).toBeNull();
  });

  it('records provenance: a JOB_EXECUTION assessment naming who closed it', async () => {
    await outcomeRoute.POST(postJson({ projectId: '11111111-1111-1111-1111-111111111111', saveToFloorPassport: true }));
    expect(state.assessments).toHaveLength(1);
    expect(state.assessments[0]!.source).toBe('JOB_EXECUTION');
    expect(state.assessments[0]!.reviewedBy).toBe('estimator@ecowoods.ca');
    expect(state.assessments[0]!.floorRecordId).toBe(state.outcomes[0]!.floorRecordId);
  });

  it('links the JobOutcome to the new FloorRecord', async () => {
    await outcomeRoute.POST(postJson({ projectId: '11111111-1111-1111-1111-111111111111', saveToFloorPassport: true }));
    expect(state.outcomes).toHaveLength(1);
    expect(state.outcomes[0]!.floorRecordId).toBe([...state.floorRecords.keys()][0]);
  });

  it('reuses an existing Floor Passport for the same project instead of creating a duplicate', async () => {
    const first = await outcomeRoute.POST(postJson({ projectId: '11111111-1111-1111-1111-111111111111', saveToFloorPassport: true }));
    const firstId = (await first.json()).floorRecordId;

    const second = await outcomeRoute.POST(
      postJson({ projectId: '11111111-1111-1111-1111-111111111111', service: 'recoat', saveToFloorPassport: true }),
    );
    const secondId = (await second.json()).floorRecordId;

    expect(secondId).toBe(firstId);
    expect(state.floorRecords.size).toBe(1);
    // The second outcome still gets linked to the (same) passport.
    expect(state.outcomes).toHaveLength(2);
    expect(state.outcomes[1]!.floorRecordId).toBe(firstId);
  });

  it('accepts admin-typed physical facts (pattern, finish, substrate, board dimensions) at job close', async () => {
    const res = await outcomeRoute.POST(
      postJson({
        projectId: '11111111-1111-1111-1111-111111111111',
        saveToFloorPassport: true,
        storey: 'main',
        pattern: 'herringbone',
        finishSystem: 'waterborne poly',
        substrate: 'plywood subfloor',
        installMethod: 'nail-down',
        boardWidthMm: 90,
        boardThickMm: 19,
      }),
    );
    const { floorRecordId } = await res.json();
    const record = state.floorRecords.get(floorRecordId)!;
    expect(record.pattern).toBe('herringbone');
    expect(record.finishSystem).toBe('waterborne poly');
    expect(record.boardWidthMm).toBe(90);
  });

  it('an explicit floorRecordId from the client is honoured without re-deriving one', async () => {
    state.floorRecords.set('22222222-2222-2222-2222-222222222222', { id: '22222222-2222-2222-2222-222222222222', publicRef: 'FR-2026-0001', originProjectId: null });
    const res = await outcomeRoute.POST(
      postJson({ projectId: '11111111-1111-1111-1111-111111111111', floorRecordId: '22222222-2222-2222-2222-222222222222', saveToFloorPassport: true }),
    );
    const body = await res.json();
    expect(body.floorRecordId).toBe('22222222-2222-2222-2222-222222222222');
    expect(state.floorRecords.size).toBe(1); // no second record minted
  });
});
