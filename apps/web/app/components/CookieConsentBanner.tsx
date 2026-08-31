'use client';

import { useEffect, useState } from 'react';

/**
 * PIPEDA (Canada) requires clear notice + consent before non-essential
 * tracking runs. Essential cookies are always on; Analytics/Marketing
 * only load their scripts after the visitor opts in.
 */
const CONSENT_STORAGE_KEY = 'cookie_consent';
/**
 * Bumped to 2 when the Meta Pixel was removed (P2.4). A stored consent records
 * a decision about a NAMED set of processors; when that set changes, the old
 * decision no longer describes anything and re-asking is the honest move — a
 * v1 record saying "marketing: true" is consent to a processor that no longer
 * exists.
 */
const CONSENT_VERSION = 2;
const OPEN_PREFERENCES_EVENT = 'open-cookie-preferences';

type OptionalConsent = {
  analytics: boolean;
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


function applyConsent(consent: StoredConsent) {
  if (consent.analytics) loadGoogleAnalytics();
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
  const [draft, setDraft] = useState<OptionalConsent>({ analytics: false });

  useEffect(() => {
    const consent = readConsent();
    if (consent) {
      applyConsent(consent);
    } else {
      setShowBanner(true);
    }

    const handleOpenPreferences = () => {
      const existing = readConsent();
      setDraft({ analytics: existing?.analytics ?? false });
      setModalOpen(true);
    };

    window.addEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
    return () => window.removeEventListener(OPEN_PREFERENCES_EVENT, handleOpenPreferences);
  }, []);

  const acceptAll = () => {
    applyConsent(writeConsent({ analytics: true }));
    setShowBanner(false);
    setModalOpen(false);
  };

  const rejectOptional = () => {
    applyConsent(writeConsent({ analytics: false }));
    setShowBanner(false);
    setModalOpen(false);
  };

  const openSettings = () => {
    const existing = readConsent();
    setDraft({ analytics: existing?.analytics ?? false });
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
            backgroundColor: 'var(--walnut-900)',
            borderTop: '1px solid var(--on-dark-line)',
            boxShadow: '0 12px 32px rgba(26, 15, 8, 0.35)',
          }}
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--on-dark)' }}>
              We use cookies to run this site and, only with your permission, to understand which
              pages are useful. We run no advertising trackers. Essential cookies are always on.{' '}
              <a
                href="/privacy"
                className="underline underline-offset-2"
                style={{ color: 'var(--copper-bright)' }}
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
            style={{ backgroundColor: 'var(--walnut-900)', border: '1px solid var(--on-dark-line)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--on-dark)' }}>
                Cookie Preferences
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="text-xl leading-none"
                style={{ color: 'var(--on-dark-muted)' }}
              >
                &times;
              </button>
            </div>

            <p className="mb-6 text-sm" style={{ color: 'var(--on-dark-muted)' }}>
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
      style={{ border: '1px solid var(--on-dark-line)' }}
    >
      <div>
        <div className="text-sm font-semibold" style={{ color: 'var(--on-dark)' }}>
          {label}
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--on-dark-muted)' }}>
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
      style={{ backgroundColor: checked ? 'var(--copper)' : 'var(--on-dark-line)' }}
    >
      <span
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
