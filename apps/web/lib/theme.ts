/**
 * Theme resolution for the Ecowoods "night showroom".
 *
 * Contract:
 *  - `data-theme` on <html> is the ONLY switch. globals.css keys off it.
 *  - The stored value can be 'light' | 'dark' | 'system'.
 *  - 'system' follows prefers-color-scheme live (no reload).
 *
 * The script below runs *before paint*, inlined in <head>. It must stay
 * dependency-free, synchronous, and small — it is the difference between a
 * premium first impression and a white flash on a dark-mode phone at 11pm.
 */

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

export const THEME_STORAGE_KEY = 'ecowoods:theme';

/** Inlined into <head>. Sets data-theme before first paint. Never throws. */
export const THEME_NO_FLASH_SCRIPT = `(function(){try{
var k='${THEME_STORAGE_KEY}';
var p=localStorage.getItem(k)||'system';
var m=window.matchMedia('(prefers-color-scheme: dark)');
var t=p==='system'?(m.matches?'dark':'light'):p;
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t;
}catch(e){}})();`;

export function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(pref: ThemePreference): Theme {
  return pref === 'system' ? systemTheme() : pref;
}

/** Single write path — keeps <html>, color-scheme, and storage in lockstep. */
export function applyPreference(pref: ThemePreference): Theme {
  const theme = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* Safari private mode — the DOM is already correct, so degrade silently. */
  }
  window.dispatchEvent(new CustomEvent<Theme>('ecowoods:themechange', { detail: theme }));
  return theme;
}
