/**
 * lib/floor-plan.ts — the one pure order-line helper this product needs.
 * No tiers, unlike EW-0001/EW-0003, so there is no resolve-a-tier step —
 * $99 is the only price content/constants/floor-plan-product.ts declares.
 */

import { FLOOR_PLAN_PRODUCT } from '@/content/constants/floor-plan-product';

export type OrderLineItem = {
  productName: string;
  unit: 'EACH';
  quantity: number;
  unitPrice: number;
  selectedOptions: Array<{ name: string; choice: string; priceDelta: number }>;
  lineTotal: number;
};

export function buildFloorPlanOrderItem(): OrderLineItem {
  return {
    productName: FLOOR_PLAN_PRODUCT.name,
    unit: 'EACH',
    quantity: 1,
    unitPrice: FLOOR_PLAN_PRODUCT.priceCad,
    selectedOptions: [],
    lineTotal: FLOOR_PLAN_PRODUCT.priceCad,
  };
}
