'use client';

/**
 * SiteFooter — four columns on desktop, accordion columns on mobile.
 *
 * At <=767px the grid collapsed to a single column, which turned the footer
 * into ~14 screens of links every visitor had to thumb past to reach the legal
 * row. AWS solves the same problem the same way: each column becomes a
 * disclosure, so the footer is a short menu you open rather than a list you
 * scroll.
 *
 * The mobile branch uses NATIVE <details>/<summary>: no useState, no JS toggle,
 * keyboard + screen-reader behaviour for free, and the links stay in the DOM
 * (collapsed, not removed) so nothing is lost for SEO. Desktop and SSR render
 * the original markup untouched.
 *
 * Kept out of the accordions on purpose: the brand block, the phone number
 * (tap-to-call is a live conversion path) and the social row — same rule as the
 * quote section, never gate the conversion path behind a tap.
 */

import { EW_MARK } from '@/lib/brand';
import type { ReactNode } from 'react';
import CookiePreferencesButton from './CookiePreferencesButton';
import { useIsMobile } from './SwipeDeck';

/**
 * Social links are config-driven and fail safe. Previously every icon linked to
 * the bare platform homepage (instagram.com/, facebook.com/, x.com/ …), which is
 * a dead link that hurts credibility and SEO. We never ship a homepage link and
 * never invent a handle: an icon renders ONLY when a real profile URL is set via
 * the matching NEXT_PUBLIC_SOCIAL_* env var. Unset → the icon is omitted.
 * Fill these in .env once the real Ecowoods profiles are confirmed.
 */
const XIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);
const TtIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
  </svg>
);
const YtIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
  </svg>
);
const PtIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345c-.091.378-.293 1.194-.333 1.361-.052.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Z" />
  </svg>
);
const LiIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
  </svg>
);
const HzIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M15.4 11.63V2.19l3.71 2.14v14.6l-6.48-3.74v-3.56H8.89v3.56L2.4 18.93V4.33L6.11 2.19v9.44H15.4Z" />
  </svg>
);
const GgIcon = () => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
    <path d="M12 2C7.802 2 4.4 5.402 4.4 9.6c0 4.8 6.08 11.28 7.06 12.29a.75.75 0 0 0 1.08 0c.98-1.01 7.06-7.49 7.06-12.29C19.6 5.402 16.198 2 12 2Zm0 10.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2Z" />
  </svg>
);

const SOCIAL_LINKS: { label: string; href?: string; icon: ReactNode }[] = [
  { label: 'Instagram', href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>) },
  { label: 'Facebook', href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10.9H7.7V14h2.7v8h3.1Z"/></svg>) },
  { label: 'Houzz', href: process.env.NEXT_PUBLIC_SOCIAL_HOUZZ, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12v9h-3v-5h-3v5h-3V3l9 5.4V12Z"/></svg>) },
  { label: 'Google Reviews', href: process.env.NEXT_PUBLIC_SOCIAL_GOOGLE, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>) },
  { label: 'Pinterest', href: process.env.NEXT_PUBLIC_SOCIAL_PINTEREST, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.2 9.3-.1-.8-.2-2 0-2.8l1.1-4.7s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.4 0 .8-.5 2-.8 3.2-.2 1 .5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.1 0 .8.3 1.7.7 2.2.1.1.1.2 0 .3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.2 2.4-6.2 6.8-6.2 3.6 0 6.3 2.6 6.3 6 0 3.6-2.2 6.4-5.4 6.4-1 0-2-.5-2.4-1.2l-.6 2.5c-.2.9-.8 2-1.3 2.6 1 .3 2 .5 3.1.5 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>) },
  { label: 'YouTube', href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.3-.4-4.9c-.2-.9-.9-1.6-1.8-1.8C19.1 5 12 5 12 5s-7.1 0-8.8.3c-.9.2-1.6.9-1.8 1.8C1 8.7 1 12 1 12s0 3.3.4 4.9c.2.9.9 1.6 1.8 1.8C4.9 19 12 19 12 19s7.1 0 8.8-.3c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.9.4-4.9zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>) },
  { label: 'LinkedIn', href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 118.3 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>) },
  { label: 'TikTok', href: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.27 0 .52.04.77.13V9.4a6.84 6.84 0 00-.77-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.04-.1z"/></svg>) },
  { label: 'X', href: process.env.NEXT_PUBLIC_SOCIAL_X, icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.51l-7.67 8.77 9.02 11.93h-7.06l-5.53-7.23-6.33 7.23H.66l8.2-9.38L0 2.25h7.24l5 6.61 5.99-6.61zm-1.24 17.6h1.95L7.08 4.25H5l11.99 15.6z"/></svg>) },
];

/** Desktop: a plain column. Mobile: a native disclosure. */
function FooterCol({
  title,
  mobile,
  children,
}: {
  title: string;
  mobile: boolean;
  children: ReactNode;
}) {
  if (!mobile) {
    return (
      <div>
        <h5>{title}</h5>
        {children}
      </div>
    );
  }
  return (
    <details className="footer-col">
      <summary className="footer-col-summary">
        <h5>{title}</h5>
        <span className="footer-col-chevron" aria-hidden="true" />
      </summary>
      <div className="footer-col-body">{children}</div>
    </details>
  );
}

export default function SiteFooter() {
  const { mounted, isMobile } = useIsMobile();
  const m = mounted && isMobile;

  const backToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="shell">
        {m && (
          <a href="#quote" className="footer-cta">
            Get your free estimate
          </a>
        )}
        <div className={`footer-grid ${m ? 'footer-grid--stacked' : ''}`}>
          {/* Brand */}
          <div>
            <div className="brand-lockup" style={{ marginBottom: '1.25rem' }}>
              <span className="brand-mark" style={{ width: '42px', height: '42px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={EW_MARK} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </span>
              <span className="brand-copy">
                <strong style={{ color: 'var(--cream-50)' }}>Ecowoods</strong>
                <small style={{ color: 'rgba(245, 239, 230, 0.55)' }}>Toronto · Est. 1998</small>
              </span>
            </div>
            <p style={{ marginBottom: '1.5rem', maxWidth: '320px' }}>
              Master hardwood flooring craftsmen serving Toronto and the GTA for over 25 years.
              Eco-friendly finishes, manufacturer-backed warranties, dust-free refinishing.
            </p>
            <div className="availability-pill dark">
              <span className="availability-dot" />
              Now booking · Spring 2026
            </div>
            {m && (
              <a href="tel:+16472445156" className="footer-call">
                <span className="footer-call-label">Call the shop</span>
                <span className="footer-call-num">(647) 244-5156</span>
              </a>
            )}
          </div>

          {/* Services */}
          <FooterCol title="Services" mobile={m}>
            <div className="footer-links">
              <a href="#services">Hardwood Installation</a>
              <a href="#services">Refinishing & Restoration</a>
              <a href="#services">Dust-Free Sanding</a>
              <a href="#services">Custom Stain Matching</a>
              <a href="#services">Stair Refinishing</a>
              <a href="#services">Custom Inlays & Borders</a>
              <a href="#services">Commercial Projects</a>
            </div>
          </FooterCol>

          {/* Service Areas */}
          <FooterCol title="Service Areas" mobile={m}>
            <div className="footer-links">
              <a href="#areas">Toronto · Downtown</a>
              <a href="#areas">North York</a>
              <a href="#areas">Etobicoke</a>
              <a href="#areas">Scarborough</a>
              <a href="#areas">Vaughan & Markham</a>
              <a href="#areas">Richmond Hill</a>
              <a href="#areas">Mississauga · Oakville</a>
            </div>
          </FooterCol>

          {/* Visit */}
          <FooterCol title="Showroom & Office" mobile={m}>
            <p style={{ marginBottom: '1.25rem', lineHeight: 1.7 }}>
              32 Norfield Crescent, Toronto, Ontario<br />
              Toronto, ON M9W 1X6
            </p>
            <div className="footer-links" style={{ marginBottom: '1.5rem' }}>
              <a href="tel:+16472445156" style={{ color: 'var(--copper-bright)', fontWeight: 600 }}>
                (647) 244-5156
              </a>
              <a href="mailto:services@ecowoods.ca">services@ecowoods.ca</a>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
              <span style={{ color: 'var(--cream-50)', fontWeight: 600 }}>Hours</span>
              <br />
              Mon–Sat · 8:00 AM – 7:00 PM<br />
              Sunday · 10:00 AM – 4:00 PM
            </p>
          </FooterCol>
        </div>

        <div className="footer-bottom">
          <div className="footer-copy">
            © {new Date().getFullYear()} Ecowoods Hardwood Flooring Inc. — All rights reserved.
          </div>
<div className="footer-social" aria-label="Social media">
            {SOCIAL_LINKS.filter((s) => s.href).map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer me" aria-label={s.label}>
                {s.icon}
              </a>
            ))}
          </div>


          {m && (
            <button type="button" className="footer-top-btn" onClick={backToTop}>
              Back to top <span aria-hidden="true">↑</span>
            </button>
          )}

          <div className="footer-legal">
            <CookiePreferencesButton />
            <a href="/privacy" style={{ marginRight: '1.5rem' }}>Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
