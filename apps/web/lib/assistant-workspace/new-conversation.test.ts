/**
 * "Start a new conversation": a fresh private conversation (new design id)
 * that keeps the project the homeowner already described, and survives a
 * reload as exactly that.
 */
import { describe, expect, it } from 'vitest';
import { isDesignId, newDesignId } from '@/lib/floor-studio/design-id';
import { applyPatch, defaultWorkspaceState, restartConversation } from './state';
import { parseWorkspaceState, serializeWorkspaceState } from './persistence';

const base = () => {
  const s = applyPatch(defaultWorkspaceState(), {
    objective: 'refinish',
    sellHorizon: 'selling-soon',
    stairs: true,
    rooms: [{ label: 'Living room', squareFeet: 420 }],
    selectedServiceSlugs: ['floor-refinishing'],
    targetFloor: { productId: 'white-oak' },
    pendingQuestions: ['Is there a moisture issue?'],
    nextAction: 'measure',
    designCode: 'c=white-oak.satin.herringbone.5&a=420',
  });
  return { ...s, designId: newDesignId() };
};

describe('restartConversation', () => {
  it('changes only the design id (and the timestamp): every project field is kept', () => {
    const before = base();
    const nextId = newDesignId();
    const after = restartConversation(before, nextId, () => '2027-01-01T00:00:00.000Z');
    expect(after.designId).toBe(nextId);
    expect(after.designId).not.toBe(before.designId);
    expect(isDesignId(after.designId)).toBe(true);
    expect({ ...after, designId: '', updatedAt: '' }).toEqual({ ...before, designId: '', updatedAt: '' });
    expect(after.updatedAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('does not mutate the previous state', () => {
    const before = base();
    const snapshot = JSON.stringify(before);
    restartConversation(before, newDesignId());
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('round-trips through localStorage serialisation with the new id and the same project', () => {
    const after = restartConversation(base(), newDesignId());
    const back = parseWorkspaceState(serializeWorkspaceState(after));
    expect(back).not.toBeNull();
    expect(back!.designId).toBe(after.designId);
    expect(back!.rooms).toEqual(after.rooms);
    expect(back!.selectedServiceSlugs).toEqual(['floor-refinishing']);
    expect(back!.designCode).toBe(after.designCode);
  });

  it('a stored state whose design id is not one we minted is refused rather than reused', () => {
    const raw = JSON.stringify({ ...base(), designId: 'not-a-design-id' });
    expect(parseWorkspaceState(raw)).toBeNull();
  });
});
