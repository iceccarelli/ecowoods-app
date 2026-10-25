/**
 * lib/acquisition.ts — how a visitor first reached the site.
 *
 * A lead already records WHICH FORM it came through (`source`). It did not
 * record how the person found us, so organic search, an AI assistant's citation
 * and a direct visit were indistinguishable in the lead — and the work done to
 * be found could not be tied to the work it brought in.
 *
 * Privacy: only the referrer's HOST is read (never its path or query string)
 * and only the landing PATH is kept (never its query string, which can carry
 * anything). It lives in sessionStorage for the visit, is sent only when the
 * visitor submits the estimate form, and lands in the lead's notes line for the
 * estimating desk. No identifier, no cookie, nothing sent anywhere else.
 *
 * Honest limits: Google AI Overviews and AI Mode send the same referrer as
 * Google search, and many assistants send none, so "direct" includes some AI
 * visits. The label says what the browser said, no more.
 */

const AI_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
  [/(^|\.)gemini\.google\.com$/, 'Gemini'],
  [/(^|\.)claude\.ai$/, 'Claude'],
  [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'],
];
const OTHER_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)google\.(com|ca|co\.uk|com\.au|co\.in|de|fr|es|it|nl|com\.mx)$/, 'Google search'],
  [/(^|\.)bing\.com$/, 'Bing search'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo search'],
  [/(^|\.)homestars\.com$/, 'HomeStars'],
  [/(^|\.)facebook\.com$|(^|\.)l\.facebook\.com$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
];

/** Label for a visit, from the referrer URL and the utm_source parameter. */
export function classifyReferrer(referrer: string, utmSource: string | null, ownHost: string): string {
  const utm = (utmSource ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  let host = '';
  try {
    host = referrer ? new URL(referrer).hostname.toLowerCase() : '';
  } catch {
    host = '';
  }
  if (host) {
    for (const [re, label] of [...AI_HOSTS, ...OTHER_HOSTS]) if (re.test(host)) return label;
  }
  if (utm) return `campaign: ${utm}`;
  const bare = (h: string) => h.replace(/^www\./, '');
  if (!host || bare(host) === bare(ownHost.toLowerCase())) return 'direct or unknown';
  return 'other site';
}

export type Acquisition = { channel: string; landing: string };

/** Pages whose address can carry a token or belongs to a signed-in visitor: never recorded as a landing page. */
const PRIVATE_PATH = /^\/(?:r|share|floor-plan|listing-floor-report|well-installed-review|mypage|admin|login|register|verify-email|api)(?:\/|$)/i;

/** The landing path, or '/' when it is a private route or does not look like a plain page address. */
export function landingPath(pathname: string): string {
  if (PRIVATE_PATH.test(pathname) || !/^\/(?:[a-z0-9-]+\/?){0,3}$/i.test(pathname)) return '/';
  return pathname.slice(0, 80);
}

const KEY = 'ew_acquisition';

/** First-touch acquisition for this visit. Browser only; null when storage or window is unavailable. */
export function captureAcquisition(): Acquisition | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) {
      const v = JSON.parse(stored) as Partial<Acquisition> | null;
      if (v && typeof v.channel === 'string' && typeof v.landing === 'string') {
        return { channel: v.channel.slice(0, 40), landing: v.landing.slice(0, 80) };
      }
    }
    const a: Acquisition = {
      channel: classifyReferrer(document.referrer, new URLSearchParams(window.location.search).get('utm_source'), window.location.hostname),
      landing: landingPath(window.location.pathname),
    };
    window.sessionStorage.setItem(KEY, JSON.stringify(a));
    return a;
  } catch {
    return null;
  }
}

/** The single line stored with the lead, e.g. "Google search → /service-areas/oakville". */
export function formatAcquisition(a: Acquisition | null): string | undefined {
  return a ? `${a.channel} → ${a.landing}`.slice(0, 120) : undefined;
}
