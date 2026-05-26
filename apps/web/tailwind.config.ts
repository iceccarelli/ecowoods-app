import type { Config } from 'tailwindcss';

/**
 * Tailwind config for Ecowoods.
 *
 * The actual design tokens (wood palette, type scale, motion easings, shadows)
 * live in globals.css as CSS variables. This config only:
 *   1. Tells Tailwind where to look for class names.
 *   2. Exposes a thin theme bridge so utilities like `text-walnut-900` work
 *      if you ever want them — but most styling is already done via the
 *      component classes in globals.css, so this is intentionally minimal.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        walnut: {
          50: 'var(--walnut-50)',
          100: 'var(--walnut-100)',
          200: 'var(--walnut-200)',
          300: 'var(--walnut-300)',
          400: 'var(--walnut-400)',
          500: 'var(--walnut-500)',
          600: 'var(--walnut-600)',
          700: 'var(--walnut-700)',
          800: 'var(--walnut-800)',
          900: 'var(--walnut-900)',
          950: 'var(--walnut-950)',
        },
        oak: {
          400: 'var(--oak-400)',
          500: 'var(--oak-500)',
          600: 'var(--oak-600)',
        },
        cream: {
          50: 'var(--cream-50)',
          100: 'var(--cream-100)',
          200: 'var(--cream-200)',
        },
        copper: 'var(--copper)',
        forest: 'var(--forest)',
      },
      fontFamily: {
        serif: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
};

export default config;
