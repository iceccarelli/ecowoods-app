'use client';

import { useEffect, useState } from 'react';

/**
 * PIPEDA (Canada) requires clear notice + consent before non-essential
 * tracking runs. Essential cookies are always on; Analytics/Marketing
 * only load their scripts after the visitor opts in.
 */
const CONSENT_STORAGE_KEY = 'cookie_consent';
const CONSENT_VERSION = 1;
const OPEN_PREFERENCES_EVENT = 'open-cookie-preferences';

type OptionalConsent = {
  analytics: boolean;
  marketing: boolean;
};

type StoredConsent = OptionalConsent & {
  essential: true;
  acceptedAt: string;
  country: 'CA';
  version: number;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    gaLoaded?: boolean;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[] };
    _fbq?: unknown;
    metaPixelLoaded?: boolean;
  }
}

function readConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    return parsed.version === CONSENT_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeConsent(consent: OptionalConsent): StoredConsent {
  const full: StoredConsent = {
    essential: true,
    analytics: consent.analytics,
    marketing: consent.marketing,
    acceptedAt: new Date().toISOString(),
    country: 'CA',
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(full));
  return full;
}

function loadGoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || window.gaLoaded) return;
  window.gaLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { anonymize_ip: true });
}

function loadMetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId || window.metaPixelLoaded) return;
  window.metaPixelLoaded = true;

  (function (f: Window, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: NonNullable<Window['fbq']> = function (...args: unknown[]) {
      if (n.callMethod) {
        (n.callMethod as (...a: unknown[]) => void).apply(n, args);
      } else {
        n.queue!.push(args);
      }
    };
    n.callMethod = undefined;
    n.queue = [];
    f.fbq = n;
    f._fbq = n;
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
}

function applyConsent(consent: StoredConsent) {
  if (consent.analytics) loadGoogleAnalytics();
  if (consent.marketing) loadMetaPixel();
}

/** Lets other components (e.g. the footer) reopen the preferences panel. */
export function openCookiePreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT));
  }
}

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<OptionalConsent>({ analytics: false, marketing: false });

  useEffect(() => {
    const consent = readConsent();
    if (consent) {
      applyConsent(consent);
    } else {
      setShowBanner(true);
    }

    const handleOpenPreferences = () => {
      const existing = readConsent();
      setDraft({
        analytics: existing?.analytics ?? false,
        marketing: existing?.marketing ?? false,
      });
      setModalOpen(true);
    };

    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
  }, []);

  const acceptAll = () => {
    applyConsent(writeConsent({ analytics: true, marketing: true }));
    setShowBanner(false);
    setModalOpen(false);
  };

  const rejectOptional = () => {
    applyConsent(writeConsent({ analytics: false, marketing: false }));
    setShowBanner(false);
    setModalOpen(false);
  };

  const openSettings = () => {
    const existing = readConsent();
    setDraft({
      analytics: existing?.analytics ?? false,
      marketing: existing?.marketing ?? false,
    });
    setModalOpen(true);
  };

  const savePreferences = () => {
    applyConsent(writeConsent(draft));
    setShowBanner(false);
    setModalOpen(false);
  };

  return (
    <>
      {showBanner && !modalOpen && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 z-[100] px-5 py-5 sm:px-8"
          style={{
            backgroundColor: '#2a1810',
            borderTop: '1px solid #4d3322',
            boxShadow: '0 12px 32px rgba(26, 15, 8, 0.35)',
          }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed" style={{ color: '#ffffff' }}>
              We use cookies to run this site and, only with your permission, to understand
              traffic and measure marketing performance. Essential cookies are always on.{' '}
              <a
                href="/privacy"
                className="underline underline-offset-2"
                style={{ color: '#e09464' }}
              >
                Privacy Policy
              </a>
            </p>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-3">
              <button type="button" onClick={acceptAll} className="btn btn-copper btn-sm">
                Accept All
              </button>
              <button type="button" onClick={rejectOptional} className="btn btn-ghost-light btn-sm">
                Reject Optional
              </button>
              <button type="button" onClick={openSettings} className="btn btn-ghost-light btn-sm">
                Cookie Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cookie preferences"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8"
            style={{ backgroundColor: '#2a1810', border: '1px solid #4d3322' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: '#ffffff' }}>
                Cookie Preferences
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="text-xl leading-none"
                style={{ color: '#cbb8a8' }}
              >
                &times;
              </button>
            </div>

            <p className="mb-6 text-sm" style={{ color: '#cbb8a8' }}>
              Choose which optional cookies we can use. Essential cookies can&apos;t be turned
              off.
            </p>

            <div className="flex flex-col gap-4">
              <ConsentRow
                label="Essential"
                description="Required for login, checkout, and security. Always on."
                checked
                disabled
              />
              <ConsentRow
                label="Analytics"
                description="Helps us see which pages are useful (Google Analytics)."
                checked={draft.analytics}
                onChange={(checked) => setDraft((d) => ({ ...d, analytics: checked }))}
              />
              <ConsentRow
                label="Marketing"
                description="Personalized ads and campaign tracking (Meta Pixel)."
                checked={draft.marketing}
                onChange={(checked) => setDraft((d) => ({ ...d, marketing: checked }))}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={rejectOptional}
                className="btn btn-ghost-light btn-sm flex-1"
              >
                Reject Optional
              </button>
              <button type="button" onClick={savePreferences} className="btn btn-copper btn-sm flex-1">
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div
      className="flex items-start justify-between gap-4 rounded-xl p-4"
      style={{ border: '1px solid #4d3322' }}
    >
      <div>
        <div className="text-sm font-semibold" style={{ color: '#ffffff' }}>
          {label}
        </div>
        <p className="mt-1 text-xs" style={{ color: '#cbb8a8' }}>
          {description}
        </p>
      </div>
      <ConsentToggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function ConsentToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      style={{ backgroundColor: checked ? '#c87e4f' : '#4d3322' }}
    >
      <span
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
