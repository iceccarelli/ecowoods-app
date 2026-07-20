/**
 * Shared shop catalog helpers — option-group shape and price computation,
 * used by the checkout API route and the customer/admin UI.
 */

export type ShopOptionChoice = { label: string; priceDelta: number };
export type ShopOptionGroup = { name: string; choices: ShopOptionChoice[] };

export function parseProductOptions(options: unknown): ShopOptionGroup[] {
  if (!Array.isArray(options)) return [];
  return options as ShopOptionGroup[];
}

/** Resolve a customer's chosen option labels against a product's option groups. */
export function resolveSelectedOptions(
  options: ShopOptionGroup[],
  selected: Record<string, string> | undefined
) {
  return options.map((group) => {
    const chosenLabel = selected?.[group.name] ?? group.choices[0]?.label;
    const choice = group.choices.find((c) => c.label === chosenLabel) ?? group.choices[0];
    return { name: group.name, choice: choice?.label ?? '', priceDelta: choice?.priceDelta ?? 0 };
  });
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
