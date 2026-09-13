/**
 * lib/design-config.ts — the handoff between /design and the quote form.
 *
 * The floor configurator used to lose everything on reload and its only exit
 * was the chat widget. Now every change is persisted under ONE localStorage
 * key, `ew-design-v1`. The estimate form reads the same key, prefills, and
 * shows a summary chip — the visitor never retypes what they already told us.
 *
 * MEAS-04 CORRECTED A CLAIM THIS COMMENT USED TO MAKE.
 *
 * It said the config was "mirrored into the querystring so a configured floor
 * survives a reload AND can be shared as a link". Half true, and the half that
 * was false is the half that mattered. /design DOES mirror into its own
 * address bar (FloorConfigurator's persistence effect), so the design page is
 * genuinely reload-proof and shareable.
 *
 * The HANDOFF was not. Its primary CTA was the bare anchor `/#quote`, carrying
 * no parameters at all, landing on a homepage section whose form reads
 * localStorage. So the design survived being shared and the handoff did not: a
 * link opened in another browser, a private window, or on a spouse's phone
 * showed the right floor and then dropped every bit of it at the quote form.
 *
 * The spec sheet's exit was worse: `/#quote?spec=…` put the query string AFTER
 * the fragment, so it was part of the hash and silently discarded on arrival —
 * and it fired `design_handoff` anyway, reporting a successful handoff on the
 * one CTA that lost its payload.
 *
 * `designEstimateHref` below is now the ONE place either exit is built.
 *
 * The key is versioned. If the shape changes, bump to `ew-design-v2` and
 * leave a migration or a silent discard here — never reinterpret old data.
 */

import { designIdOf, ensureDesignId } from '@/lib/floor-studio/design-id';

export const DESIGN_CONFIG_KEY = 'ew-design-v1';

export type DesignConfig = {
  species: string;
  finish: string;
  pattern: string;
  sqft: number;
  /**
   * MEAS-01's join key, extended to this configurator.
   *
   * Without it, a lead from /design is unattributable while a lead from
   * /floor-studio is not — which would make Floor Studio look like the only
   * tool that converts, purely because it is the only one that can be counted.
   * Optional: a config saved before MEAS-04 has none, and must still open.
   */
  designId?: string;
  /** ISO timestamp of the last edit — lets the form ignore stale configs. */
  savedAt: string;
};

/** How old a saved design may be before the quote form ignores it. */
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export function saveDesignConfig(config: Omit<DesignConfig, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    /* Minted here, once, and kept across every subsequent edit. A caller that
       already has an id — saveStudioDesign mirroring a studio design into this
       key — passes it in, so one design never ends up with two ids and gets
       counted twice. */
    const full: DesignConfig = {
      ...config,
      designId: ensureDesignId(config.designId),
      savedAt: new Date().toISOString(),
    };
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
    /* Validated, not trusted — dropped rather than repaired if it is not ours.
       Spread rather than `designId: undefined`, for the reason MEAS-01 learned
       the hard way: a config saved before this patch must come back identical
       instead of growing a key that is always empty. */
    const designId = designIdOf(parsed.designId);
    const { designId: _drop, ...rest } = parsed as DesignConfig;
    return designId ? { ...rest, designId } : (rest as DesignConfig);
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

/**
 * THE ONE EXIT. Both /design and /design/spec build their quote link here.
 *
 * Two CTAs that each assembled their own URL is how one of them came to drop
 * its payload after a `#` and stay broken without anybody noticing — nothing
 * threw, and the analytics event beside it kept reporting success. There is
 * now one builder, one shape, and a test that asserts the query string comes
 * before the fragment.
 *
 * It targets /estimate rather than /#quote: a real page with a real form,
 * whose parameters the form reads, instead of an anchor on the homepage whose
 * fragment nothing parses.
 */
export function designEstimateHref(c: DesignConfig, from = 'design'): string {
  const params = new URLSearchParams({
    species: c.species,
    finish: c.finish,
    pattern: c.pattern,
    sqft: String(c.sqft),
    service: 'installation',
    source: from,
  });
  if (c.designId) params.set('did', c.designId);
  /* Query BEFORE fragment. The reverse is what shipped for months. */
  return `/estimate?${params.toString()}#form`;
}

/**
 * Read a configuration back out of a link.
 *
 * Returns null unless species and a positive area are both present, because a
 * partial config prefills a form with half an answer and the visitor cannot
 * tell which half came from them.
 */
export function designConfigFromParams(params: URLSearchParams): DesignConfig | null {
  const species = params.get('species');
  const sqft = Number(params.get('sqft'));
  if (!species || !Number.isFinite(sqft) || sqft <= 0) return null;
  const designId = designIdOf(params.get('did'));
  return {
    species,
    finish: params.get('finish') ?? '',
    pattern: params.get('pattern') ?? '',
    sqft: Math.round(sqft),
    ...(designId ? { designId } : {}),
    savedAt: new Date().toISOString(),
  };
}

/** One human-readable line for the summary chip and the lead notes. */
export function describeDesignConfig(c: DesignConfig): string {
  return `${c.species} · ${c.finish} finish · ${c.pattern} · ~${c.sqft} sq ft`;
}
