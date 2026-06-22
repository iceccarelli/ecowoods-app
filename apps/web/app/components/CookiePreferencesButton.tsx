'use client';

import { openCookiePreferences } from './CookieConsentBanner';

export default function CookiePreferencesButton() {
  return (
    <button type="button" onClick={openCookiePreferences} style={{ marginRight: '1.5rem' }}>
      Cookie Preferences
    </button>
  );
}
