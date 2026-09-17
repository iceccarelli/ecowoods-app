import { describe, expect, it } from 'vitest';
import { buildFloorPlanOrderItem } from './floor-plan';

describe('buildFloorPlanOrderItem', () => {
  it('prices the line item from the declared constant, never from caller input', () => {
    const item = buildFloorPlanOrderItem();
    expect(item.unitPrice).toBe(99);
    expect(item.lineTotal).toBe(99);
    expect(item.productName).toBe('Personal Floor Plan');
  });
});
