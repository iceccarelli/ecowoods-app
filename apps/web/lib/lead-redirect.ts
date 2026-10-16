/**
 * The no-JavaScript (or pre-hydration) lead POST answers with a 303 back to the
 * page it came from. These two helpers are the contract between that redirect
 * (app/api/leads/route.ts) and the form that has to tell the visitor what
 * happened (app/components/EstimateForm.tsx).
 */

const SOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

/** The form `source` is echoed in the redirect only when it is a plain slug. */
export function safeLeadSource(source: unknown): string | null {
  return typeof source === 'string' && SOURCE_RE.test(source) ? source : null;
}

export type LeadRedirectOutcome = 'sent' | 'error';

/**
 * What the redirect says about the form with this `source`, or null when the
 * URL carries no outcome for it. A redirect that names another form is ignored,
 * so a page with two forms never confirms one for the other's submission.
 */
export function leadRedirectOutcome(search: string, source: string): LeadRedirectOutcome | null {
  const p = new URLSearchParams(search);
  const outcome = p.get('sent') === '1' ? 'sent' : p.get('error') === '1' ? 'error' : null;
  if (!outcome) return null;
  const from = p.get('from');
  return from === source ? outcome : null;
}
