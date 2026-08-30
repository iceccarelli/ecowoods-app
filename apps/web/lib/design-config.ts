/**
 * lib/design-config.ts — the handoff between /design and the quote form.
 *
 * The floor configurator used to lose everything on reload and its only exit
 * was the chat widget. Now every change is persisted under ONE localStorage
 * key, `ew-design-v1`, and mirrored into the querystring so a configured
 * floor survives a reload AND can be shared as a link. The estimate form
 * reads the same key, prefills, and shows a summary chip — the visitor never
 * retypes what they already told us.
 *
 * The key is versioned. If the shape changes, bump to `ew-design-v2` and
 * leave a migration or a silent discard here — never reinterpret old data.
 */

export const DESIGN_CONFIG_KEY = 'ew-design-v1';

export type DesignConfig = {
  species: string;
  finish: string;
  pattern: string;
  sqft: number;
  /** ISO timestamp of the last edit — lets the form ignore stale configs. */
  savedAt: string;
};

/** How old a saved design may be before the quote form ignores it. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function saveDesignConfig(config: Omit<DesignConfig, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const full: DesignConfig = { ...config, savedAt: new Date().toISOString() };
    window.localStorage.setItem(DESIGN_CONFIG_KEY, JSON.stringify(full));
  } catch {
    /* storage full / private mode — the querystring still carries the config */
  }
}

export function readDesignConfig(): DesignConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DESIGN_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesignConfig>;
    if (
      typeof parsed.species !== 'string' ||
      typeof parsed.finish !== 'string' ||
      typeof parsed.pattern !== 'string' ||
      typeof parsed.sqft !== 'number' ||
      typeof parsed.savedAt !== 'string'
    ) {
      return null;
    }
    if (Date.now() - Date.parse(parsed.savedAt) > MAX_AGE_MS) return null;
    return parsed as DesignConfig;
  } catch {
    return null;
  }
}

export function clearDesignConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DESIGN_CONFIG_KEY);
  } catch {
    /* nothing to do */
  }
}

/** One human-readable line for the summary chip and the lead notes. */
export function describeDesignConfig(c: DesignConfig): string {
  return `${c.species} · ${c.finish} finish · ${c.pattern} · ~${c.sqft} sq ft`;
}
