/**
 * lib/money.ts — invoice and estimate arithmetic in whole cents.
 *
 * Prices, percentages and tax rates are inputs and are never changed here;
 * this only fixes HOW they are combined. Plain floats made the stored total
 * disagree with the printed line items by a cent in some cases (the PDF
 * printed discount, surcharge and HST each rounded on its own, while the
 * total was rounded once from the unrounded product). Every figure is now
 * rounded half-up to cents at the step where it is printed, and the total is
 * the sum of the printed figures, so a customer adding the lines up always
 * lands on the total.
 *
 * Dependency-free on purpose: the admin forms use it for their live preview,
 * so the preview and the stored number cannot drift apart.
 */

/** Nudge so a binary-float value that is really x.5 rounds up, never down. */
const HALF = 1e-7;

/** Dollars (any float) to whole cents, half-up. */
const toCents = (dollars: number): number => Math.round(dollars * 100 + HALF);
/** `rate` percent of an amount held in cents, as whole cents, half-up. */
const pctCents = (cents: number, rate: number): number => Math.round((cents * rate) / 100 + HALF);
const fromCents = (cents: number): number => cents / 100;

/** Round half-up to cents. */
export function roundCents(value: number): number {
  return fromCents(toCents(value));
}

export interface InvoiceAmounts {
  subtotal: number;
  discount: number;
  surcharge: number;
  tax: number;
  total: number;
}

/** subtotal → discount → surcharge → HST, each step rounded to cents. */
export function invoiceAmounts(subtotal: number, discountPct: number, surchargePct: number, taxRate: number): InvoiceAmounts {
  const sub = toCents(subtotal);
  const discount = pctCents(sub, discountPct);
  const afterDiscount = sub - discount;
  const surcharge = pctCents(afterDiscount, surchargePct);
  const taxable = afterDiscount + surcharge;
  const tax = pctCents(taxable, taxRate);
  return {
    subtotal: fromCents(sub),
    discount: fromCents(discount),
    surcharge: fromCents(surcharge),
    tax: fromCents(tax),
    total: fromCents(taxable + tax),
  };
}

/** Estimate totals: the quoted amount is the pre-tax subtotal. */
export function estimateAmounts(subtotal: number, taxRate: number): { subtotal: number; tax: number; total: number } {
  const sub = toCents(subtotal);
  const tax = pctCents(sub, taxRate);
  return { subtotal: fromCents(sub), tax: fromCents(tax), total: fromCents(sub + tax) };
}

/**
 * Split a contract value into stage subtotals. Each stage is rounded to
 * cents; when the percentages add up to exactly 100 the LAST stage takes the
 * rounding remainder so the stages always sum to the contract value.
 */
export function splitContract(contractValue: number, stagePcts: number[]): number[] {
  const total = toCents(contractValue);
  const parts = stagePcts.map((p) => pctCents(total, p));
  const pctSum = Math.round(stagePcts.reduce((s, p) => s + p, 0) * 100);
  if (parts.length > 0 && pctSum === 10_000) {
    const head = parts.slice(0, -1).reduce((s, p) => s + p, 0);
    parts[parts.length - 1] = total - head;
  }
  return parts.map(fromCents);
}

/** A finite, non-negative number within bounds (money amount or percentage). */
export function isValidAmount(n: unknown, max = 1_000_000_000): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
}
