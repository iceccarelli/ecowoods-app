/**
 * lib/acquisition.ts — how a visitor first reached the site.
 *
 * ONE CONTRACT, THREE PLACES. A closed set of channel slugs and a plain landing
 * path are captured in the browser, validated here on the server, and stored in
 * three structured columns: QuoteRequest.acquisitionChannel,
 * QuoteRequest.acquisitionLanding and FunnelEvent.acquisition. The funnel report
 * aggregates the slug; the estimating desk reads the same facts as one line in
 * the lead's notes. Nothing is stored as free text, so nothing can be reported
 * wrongly by parsing prose.
 *
 * WHAT NULL MEANS. A lead with no acquisition (null) is one where nothing was
 * captured: no JavaScript, a phone call, an assistant handoff, or a lead from
 * before this existed. That is NOT the same as `no_referrer`, which is a
 * captured visit whose browser sent no referrer. The report keeps them apart.
 *
 * HONEST LIMITS. `no_referrer` is not "confirmed direct": it is a bookmark, a
 * typed address, an app or a privacy setting that hid the sender. Google AI
 * Overviews and AI Mode send the same referrer as Google search, and most
 * assistants send none, so the AI rows count only visits that DID name an
 * assistant, and understate AI-driven visits. The labels say what the browser
 * said, no more.
 *
 * PRIVACY. Only the referrer's HOST is read, never its path or query, and only
 * a plain landing PATH is kept, never its query string, a token, or a signed-in
 * or share route. campaign tags (utm_*) are reduced to the single slug
 * `campaign`; their text is not stored. Held in sessionStorage for the visit
 * and sent only when the visitor submits the estimate form.
 */

export const ACQUISITION_CHANNELS = [
  'google_search',
  'bing_search',
  'duckduckgo_search',
  'chatgpt',
  'perplexity',
  'gemini',
  'claude',
  'copilot',
  'homestars',
  'facebook',
  'instagram',
  'campaign',
  'other_site',
  'no_referrer',
] as const;
export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number];

export const ACQUISITION_LABEL: Record<AcquisitionChannel, string> = {
  google_search: 'Google search',
  bing_search: 'Bing search',
  duckduckgo_search: 'DuckDuckGo search',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Copilot',
  homestars: 'HomeStars',
  facebook: 'Facebook',
  instagram: 'Instagram',
  campaign: 'Tagged campaign link',
  other_site: 'Another website',
  no_referrer: 'No referrer (typed, bookmarked, or hidden by the sender)',
};

const HOSTS: Array<[RegExp, AcquisitionChannel]> = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, 'chatgpt'],
  [/(^|\.)perplexity\.ai$/, 'perplexity'],
  [/(^|\.)gemini\.google\.com$/, 'gemini'],
  [/(^|\.)claude\.ai$/, 'claude'],
  [/(^|\.)copilot\.microsoft\.com$/, 'copilot'],
  [/(^|\.)google\.(com|ca|co\.uk|com\.au|co\.in|de|fr|es|it|nl|com\.mx)$/, 'google_search'],
  [/(^|\.)bing\.com$/, 'bing_search'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo_search'],
  [/(^|\.)homestars\.com$/, 'homestars'],
  [/(^|\.)facebook\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
];

/** Channel for a visit, from the referrer URL and whether the landing URL carried a utm_source. */
export function classifyReferrer(referrer: string, hasUtmSource: boolean, ownHost: string): AcquisitionChannel {
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  if (host) {
    for (const [re, channel] of HOSTS) if (re.test(host)) return channel;
  }
  if (hasUtmSource) return 'campaign';
  const bare = (h: string) => h.replace(/^www\./, '');
  if (!host || bare(host) === bare(ownHost.toLowerCase())) return 'no_referrer';
  return 'other_site';
}

/** Pages whose address can carry a token or belong to a signed-in visitor: never recorded as a landing page. */
const PRIVATE_PATH = /^\/(?:r|share|floor-plan|listing-floor-report|well-installed-review|mypage|admin|login|register|verify-email|api)(?:\/|$)/i;

/** The landing path, or '/' when it is a private route or does not look like a plain page address. */
export function landingPath(pathname: string): string {
  if (PRIVATE_PATH.test(pathname)) return '/';
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.every((s) => /^[a-z0-9-]+$/i.test(s))) return '/';
  return `/${segments.slice(0, 3).join('/')}`.slice(0, 80);
}

export type Acquisition = { channel: AcquisitionChannel; landing: string };

export const isAcquisitionChannel = (v: unknown): v is AcquisitionChannel => typeof v === 'string' && (ACQUISITION_CHANNELS as readonly string[]).includes(v);

/**
 * Validate what a client sent. Anything outside the closed set, or a landing
 * that is not a plain public path, is dropped to null rather than rejected: a
 * bad attribution field must never cost a lead.
 */
export function parseAcquisition(channel: unknown, landing: unknown): Acquisition | null {
  if (!isAcquisitionChannel(channel)) return null;
  return { channel, landing: typeof landing === 'string' ? landingPath(landing) : '/' };
}

/** Readable label for a stored slug; tolerates a value this build does not know. */
export const acquisitionLabel = (slug: string): string => (isAcquisitionChannel(slug) ? ACQUISITION_LABEL[slug] : 'Unrecognised channel');

/** The one line the estimating desk reads in the lead notes. */
export function acquisitionNote(a: Acquisition | null): string | null {
  return a ? `Found us via: ${ACQUISITION_LABEL[a.channel]} → ${a.landing}` : null;
}

const KEY = 'ew_acquisition';

/** First-touch acquisition for this visit. Browser only; null when storage or window is unavailable. */
export function captureAcquisition(): Acquisition | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) {
      const v = JSON.parse(stored) as { channel?: unknown; landing?: unknown } | null;
      const parsed = v ? parseAcquisition(v.channel, v.landing) : null;
      if (parsed) return parsed;
      /* A value written by an older build is not re-classified: by now the
         referrer is the previous internal page, which would record a visit that
         began on Google as no_referrer. Not captured is the honest answer. */
      return null;
    }
    const a: Acquisition = {
      channel: classifyReferrer(document.referrer, new URLSearchParams(window.location.search).has('utm_source'), window.location.hostname),
      landing: landingPath(window.location.pathname),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(a));
    return a;
  } catch {
    return null;
  }
}
