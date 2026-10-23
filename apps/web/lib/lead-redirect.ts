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

/**
 * Where a no-JavaScript lead POST is sent back to: the page it came from, with
 * the outcome, the form's `source` and (for the photo form) `track=photos`, at
 * `#estimate` — the id EstimateForm renders on every page that embeds it.
 * Same-origin only; anything else goes to the homepage.
 *
 * The photo route used to build this itself with `#quote` and no `from`, so
 * `leadRedirectOutcome` ignored it and the visitor landed on a silent page.
 * Both routes now share this one function.
 */
export function leadBackTo(opts: {
  referer: string | null;
  siteUrl?: string;
  ok: boolean;
  source?: unknown;
  track?: 'photos';
}): string {
  const siteUrl = opts.siteUrl ?? 'https://ecowoods.ca';
  try {
    const site = new URL(siteUrl);
    const u = new URL(opts.referer ?? '/', site);
    if (u.host !== site.host) return '/?sent=1';
    for (const k of ['sent', 'error', 'from', 'track']) u.searchParams.delete(k);
    u.searchParams.set(opts.ok ? 'sent' : 'error', '1');
    const from = safeLeadSource(opts.source);
    if (from) u.searchParams.set('from', from);
    if (opts.track) u.searchParams.set('track', opts.track);
    u.hash = 'estimate';
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return opts.ok ? '/?sent=1' : '/?error=1';
  }
}

/** Which form the redirect came from; only the photo form sets it. */
export function leadRedirectTrack(search: string): 'photos' | null {
  return new URLSearchParams(search).get('track') === 'photos' ? 'photos' : null;
}
