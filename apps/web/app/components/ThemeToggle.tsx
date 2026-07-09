'use client';

import { useTheme } from './useTheme';

const SunIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path
      d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M5.9 5.9 4.4 4.4M19.6 19.6l-1.5-1.5M18.1 5.9l1.5-1.5M4.4 19.6l1.5-1.5"
      strokeLinecap="round"
    />
  </svg>
);

const MoonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4Z" strokeLinejoin="round" />
  </svg>
);

export default function ThemeToggle() {
  const { mounted, theme, toggle } = useTheme();

  // Reserve the exact box before mount so the header never reflows.
  if (!mounted) {
    return <span className="theme-toggle" aria-hidden="true" style={{ visibility: 'hidden' }} />;
  }

  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? SunIcon : MoonIcon}
    </button>
  );
}
