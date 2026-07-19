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

import type { ReactNode } from 'react';
import CookiePreferencesButton from './CookiePreferencesButton';
import { EcowoodsLeaf } from './EcowoodsLeaf';
import { useIsMobile } from './SwipeDeck';

/**
 * Social links are config-driven and fail safe. Previously every icon linked to
 * the bare platform homepage (instagram.com/, facebook.com/, x.com/ …), which is
 * a dead link that hurts credibility and SEO. We never ship a homepage link and
 * never invent a handle: an icon renders ONLY when a real profile URL is set via
 * the matching NEXT_PUBLIC_SOCIAL_* env var. Unset → the icon is omitted.
 * Fill these in .env once the real Ecowoods profiles are confirmed.
 */
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
                <EcowoodsLeaf size={24} />
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
              <a href="tel:+14162491276" className="footer-call">
                <span className="footer-call-label">Call the shop</span>
                <span className="footer-call-num">(416) 249-1276</span>
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
              Toronto, ON M3J 3A1
            </p>
            <div className="footer-links" style={{ marginBottom: '1.5rem' }}>
              <a href="tel:+14162491276" style={{ color: 'var(--copper-bright)', fontWeight: 600 }}>
                (416) 249-1276
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
