'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  applyPreference,
  readPreference,
  resolveTheme,
  systemTheme,
  type Theme,
  type ThemePreference,
} from '@/lib/theme';

/**
 * Reads the theme the no-flash script already applied, then keeps React in
 * sync with it. Returns `mounted:false` on the server and the first client
 * render so consumers can render a stable placeholder and avoid hydration
 * mismatch (the DOM already has the right theme — only React doesn't yet).
 */
export function useTheme() {
  const [mounted, setMounted] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const pref = readPreference();
    setPreference(pref);
    setTheme(resolveTheme(pref));
    setMounted(true);
  }, []);

  // 'system' must track the OS live — no reload, no stale showroom.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyPreference('system');
      setTheme(systemTheme());
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    setTheme(applyPreference(pref));
  }, []);

  const toggle = useCallback(() => {
    // An explicit click is an explicit preference. Leave 'system' behind.
    setThemePreference(resolveTheme(readPreference()) === 'dark' ? 'light' : 'dark');
  }, [setThemePreference]);

  return { mounted, theme, preference, toggle, setThemePreference };
}
