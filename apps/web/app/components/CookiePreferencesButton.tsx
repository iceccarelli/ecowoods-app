'use client';

import { openCookiePreferences } from './CookieConsentBanner';

export default function CookiePreferencesButton() {
  return (
    // Measured 132x22 in every one of the 220 audited cells — the single most
    // frequent sub-44px tap target on the site. .footer-legal-btn gives it the
    // same 44px min-height as the surrounding footer links.
    <button type="button" onClick={openCookiePreferences} className="footer-legal-btn">
      Cookie Preferences
    </button>
  );
}
