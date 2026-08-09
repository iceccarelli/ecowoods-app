import type { Config } from 'tailwindcss';

/**
 * Tailwind config for Ecowoods.
 *
 * The actual design tokens (wood palette, type scale, motion easings, shadows)
 * live in globals.css as CSS variables. This config only:
 *   1. Tells Tailwind where to look for class names.
 *   2. Tells Tailwind what "dark" means on this site.
 *   3. Exposes a thin theme bridge so utilities like `text-walnut-900` work
 *      if you ever want them — but most styling is already done via the
 *      component classes in globals.css, so this is intentionally minimal.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],

  /**
   * Without this key Tailwind defaults to `media`, i.e. the OS-level
   * `prefers-color-scheme`. This site's dark mode is `html[data-theme='dark']`,
   * written before paint by the no-flash script in app/layout.tsx and driven by
   * the ThemeToggle and the `ecowoods:theme` localStorage key.
   *
   * Those two mechanisms were completely decoupled, so a visitor with the site
   * toggled to dark and a light OS got a light /authority on a dark site — and
   * the reverse. /authority is the only page using `dark:` variants (55 of
   * them). See audit/FINDINGS.md F-03.
   *
   * This aligns the wiring. It does NOT resolve the palette drift on that page
   * — /authority is still styled in stock `stone-*`/`amber-*` rather than brand
   * tokens, which is open question Q1 in audit/DEFERRED.md.
   */
  darkMode: ['selector', "html[data-theme='dark']"],

  theme: {
    extend: {
      colors: {
        /**
         * Only steps that actually exist in globals.css are listed. The removed
         * entries (walnut 50-500, oak 600, cream 200) pointed at custom
         * properties defined nowhere, so a utility like `bg-walnut-300` emitted
         * a background-color referencing an undefined custom property — an
         * invalid declaration that silently falls back to the inherited value.
         * Nothing errored; the utility just did nothing. No usage was found, so
         * this is a landmine removal rather than a fix. See audit/FINDINGS.md
         * F-14.
         *
         * If a step is wanted back, define the token in globals.css first, in
         * BOTH themes, then re-add it here — not the other way round.
         */
        walnut: {
          600: 'var(--walnut-600)',
          700: 'var(--walnut-700)',
          800: 'var(--walnut-800)',
          900: 'var(--walnut-900)',
          950: 'var(--walnut-950)',
        },
        oak: {
          300: 'var(--oak-300)',
          400: 'var(--oak-400)',
          500: 'var(--oak-500)',
        },
        cream: {
          50: 'var(--cream-50)',
          100: 'var(--cream-100)',
        },
        maple: {
          200: 'var(--maple-200)',
        },
        copper: {
          DEFAULT: 'var(--copper)',
          bright: 'var(--copper-bright)',
          deep: 'var(--copper-deep)',
          /* the only copper safe behind cream text — see globals.css */
          surface: 'var(--copper-surface)',
        },
        forest: 'var(--forest)',
        /* semantic and theme-aware — prefer these over the primitives above */
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        surface: 'var(--surface)',
        line: 'var(--line)',
      },
      fontFamily: {
        serif: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        /* --radius is now defined; before this `rounded` was a no-op */
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      spacing: {
        '2xs': 'var(--space-2xs)',
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
      },
      transitionDuration: {
        fast: 'var(--dur-fast)',
        DEFAULT: 'var(--dur-base)',
        slow: 'var(--dur-slow)',
        enter: 'var(--dur-enter)',
      },
    },
  },
  plugins: [],
};

export default config;
