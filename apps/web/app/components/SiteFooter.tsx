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
import { CITIES, SERVICES } from '@/lib/seo-data';
import { BUSINESS_NAP, PROFILE_LINKS, REVIEW_PROFILES, HOURS_LINE } from '@ecowoods/shared/constants';
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
/** Verified HomeStars profile — see PROFILE_LINKS in @ecowoods/shared/constants. */
const HOMESTARS_URL = REVIEW_PROFILES.find((p) => p.label === 'HomeStars')?.href;

/**
 * Every profile URL in this footer comes from PROFILE_LINKS, and none is typed
 * here.
 *
 * The comment above this block already stated the policy — "never invent a
 * handle", "an icon renders ONLY when a real profile URL is set" — while the
 * Instagram and Facebook entries below it carried the URL as a hardcoded
 * string. So the two links on every page of the site sat outside the one file
 * that records which profiles have been opened and confirmed, and outside the
 * array that feeds `sameAs`. If somebody corrects a handle in PROFILE_LINKS,
 * the schema changes and the footer does not: the site would then be telling
 * Google one thing and a visitor another about the same profile.
 *
 * PROFILE_LINKS is the verified-profiles file. It is the only place a profile
 * URL is allowed to exist. verify-destinations.mjs derives its external-host
 * allowlist from it, so a host that is not in it cannot be linked from anywhere
 * in the app without failing the build.
 */
const profileHref = (label: string) => PROFILE_LINKS.find((p) => p.label === label)?.href;

/**
 * An entry without an href is not rendered (see the .filter below). Seven
 * icons lost their href here because they pointed at platform home pages, not
 * at Ecowoods. Restore one by pasting the real profile URL — after opening it.
 */
const SOCIAL_LINKS: { label: string; href?: string; icon: ReactNode }[] = [
  { label: 'Instagram', href: profileHref('Instagram'), icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>) },
  { label: 'HomeStars', href: HOMESTARS_URL, icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" strokeLinejoin="round"/><path d="m12 10 1.2 2.5 2.8.4-2 2 .5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-2 2.8-.4Z" fill="currentColor" stroke="none"/></svg>) },
  { label: 'Facebook', href: profileHref('Facebook'), icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10.9H7.7V14h2.7v8h3.1Z"/></svg>) },
  { label: 'Houzz', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12v9h-3v-5h-3v5h-3V3l9 5.4V12Z"/></svg>) },
  { label: 'Google Reviews', icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>) },
  { label: 'Pinterest', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.8 6.2 9.3-.1-.8-.2-2 0-2.8l1.1-4.7s-.3-.6-.3-1.4c0-1.3.8-2.3 1.7-2.3.8 0 1.2.6 1.2 1.4 0 .8-.5 2-.8 3.2-.2 1 .5 1.7 1.4 1.7 1.7 0 3-1.8 3-4.4 0-2.3-1.6-3.9-4-3.9-2.7 0-4.3 2-4.3 4.1 0 .8.3 1.7.7 2.2.1.1.1.2 0 .3l-.3 1.2c0 .2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4 0-3.2 2.4-6.2 6.8-6.2 3.6 0 6.3 2.6 6.3 6 0 3.6-2.2 6.4-5.4 6.4-1 0-2-.5-2.4-1.2l-.6 2.5c-.2.9-.8 2-1.3 2.6 1 .3 2 .5 3.1.5 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>) },
  { label: 'YouTube', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.3-.4-4.9c-.2-.9-.9-1.6-1.8-1.8C19.1 5 12 5 12 5s-7.1 0-8.8.3c-.9.2-1.6.9-1.8 1.8C1 8.7 1 12 1 12s0 3.3.4 4.9c.2.9.9 1.6 1.8 1.8C4.9 19 12 19 12 19s7.1 0 8.8-.3c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.9.4-4.9zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>) },
  { label: 'LinkedIn', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 118.3 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"/></svg>) },
  { label: 'TikTok', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.27 0 .52.04.77.13V9.4a6.84 6.84 0 00-.77-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.04-.1z"/></svg>) },
  { label: 'X', icon: (<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.51l-7.67 8.77 9.02 11.93h-7.06l-5.53-7.23-6.33 7.23H.66l8.2-9.38L0 2.25h7.24l5 6.61 5.99-6.61zm-1.24 17.6h1.95L7.08 4.25H5l11.99 15.6z"/></svg>) },
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

/**
 * The booking window, derived — F-164.
 *
 * This pill read "Now booking · Spring 2026" on 28 August 2026. A hardcoded
 * season is a promise with a shelf life, and past its date it does not read as
 * an old string: it reads as a business that stopped paying attention, on the
 * element whose entire job is to say the opposite.
 *
 * Derived from the clock instead, so it cannot go stale. Deliberately coarse —
 * a season, not a date — because the honest claim is availability, and a
 * specific week would be a scheduling commitment nobody here has authorised the
 * footer to make.
 */
function bookingWindow(now = new Date()): string {
  const m = now.getMonth();
  const y = now.getFullYear();
  if (m <= 1) return `Winter ${y}`;
  if (m <= 4) return `Spring ${y}`;
  if (m <= 7) return `Summer ${y}`;
  if (m <= 9) return `Autumn ${y}`;
  return `Winter ${y + 1}`;
}

export default function SiteFooter() {
  const { mounted, isMobile } = useIsMobile();
  const m = mounted && isMobile;

  const backToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="shell">
        {m && (
          <a href="/#quote" className="footer-cta">
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
                <small style={{ color: 'rgba(245, 239, 230, 0.55)' }}>Toronto · Est. {BUSINESS_NAP.foundedYear}</small>
              </span>
            </div>
            <p style={{ marginBottom: '1.5rem', maxWidth: '320px' }}>
              Master hardwood flooring craftsmen serving Toronto and the GTA since {BUSINESS_NAP.foundedYear}.
              Eco-friendly finishes, manufacturer-backed warranties, dust-free refinishing.
            </p>
            <div className="availability-pill dark">
              <span className="availability-dot" />
              Now booking · {bookingWindow()}
            </div>
            {m && (
              <a href={BUSINESS_NAP.phoneHref} className="footer-call">
                <span className="footer-call-label">Call the shop</span>
                <span className="footer-call-num">{BUSINESS_NAP.phoneDisplay}</span>
              </a>
            )}
          </div>

          {/* Services.

              Every one of these used to be `/#services` — seven links, seven
              labels, one anchor on the homepage. The highest-intent phrases this
              business could rank for had no URL of their own to rank, and the
              LocalBusiness graph was meanwhile emitting a Service node per
              service with an @id of /services/{slug}#service, which 404'd. Both
              halves of that are fixed by the same six pages. See F-146.

              Labels are the published SERVICES names so the link text, the page
              H1 and the schema `name` are one string, not three that drift. */}
          <FooterCol title="Services" mobile={m}>
            <div className="footer-links">
              <a href="/hardwood-flooring-toronto">Hardwood Flooring Toronto</a>
              <a href="/hardwood-floor-refinishing-toronto">Floor Refinishing Toronto</a>
              <a href="/hardwood-stairs-toronto">Hardwood Stairs Toronto</a>
              <a href="/hardwood-floor-problems-toronto">Floor Problems &amp; Repairs</a>
              {/* P1 — the two buyers who are not homeowners. In the Services
                  column rather than Learn because that is what they are buying,
                  and because a page with no inbound chrome link fails
                  verify-links no matter how good it is. */}
              <a href="/commercial">Commercial &amp; Property Managers</a>
              <a href="/realtors">For Realtors — Pre-List Recoat</a>
              <a href="/refer">Refer Someone</a>
              {SERVICES.map((s) => (
                <a key={s.slug} href={`/services/${s.slug}`}>
                  {s.name}
                </a>
              ))}
              <a href="/services">All services</a>
            </div>
          </FooterCol>

          {/* Learn — every page on the site that is written to be read.
              Until this existed, /papers and /case-studies were reachable only
              from the header or from inside another article. */}
          <FooterCol title="Learn" mobile={m}>
            <div className="footer-links">
              <a href="/about">About Ecowoods</a>
              <a href="/team">The crew — salaried, no subcontractors</a>
              <a href="/reviews">Reviews</a>
              <a href="/press">Press &amp; Media Kit</a>
              <a href="/resources">All resources</a>
              <a href="/whats-new">What&rsquo;s New</a>
              <a href="/market">What Moves a Quote</a>
              <a href="/standards">Standards Register</a>
              <a href="/framework">The Well-Installed Framework</a>
              <a href="/framework/assess">Score a quote</a>
              <a href="/guides">Decision Guides</a>
              <a href="/glossary">Glossary</a>
              <a href="/data">Data &amp; Figures</a>
              <a href="/library">Visual Library</a>
              <a href="/papers">Technical Papers</a>
              <a href="/technical-library">Technical Library</a>
              <a href="/blog">Articles</a>
              <a href="/case-studies">Case Studies</a>
              <a href="/design">Floor Designer</a>
              {/* F-163 moved FloorForge out of the primary nav, where it spent a
                  tenth of the header on a product name a homeowner comparing three
                  quotes has never heard. It is a real page and it keeps a real
                  inbound link — verify-links.mjs failed the build the moment it
                  had none, which is exactly what that guard is for. */}
              <a href="/products/floorforge">FloorForge</a>
              <a href="/authority">Citation Guide</a>
              <a href="/feed.xml">RSS Feed</a>
            </div>
          </FooterCol>

          {/* Service Areas — real routes, not homepage anchors.
              Every entry here used to be href="#areas", which scrolled to a
              section of the homepage. Meanwhile /service-areas/<city> existed,
              was prerendered for all 16 cities, and was declared in the sitemap
              — with a single inbound link in the entire app. The highest
              commercial-intent surface on a local trade site had no internal
              link equity at all. Derived from CITIES so this column cannot
              drift from the routes that are actually built.
              See audit/FINDINGS.md F-73. */}
          <FooterCol title="Service Areas" mobile={m}>
            <div className="footer-links">
              {CITIES.slice(0, 8).map((c) => (
                <a key={c.slug} href={`/service-areas/${c.slug}`}>{c.name}</a>
              ))}
              <a href="/service-areas">All service areas →</a>
            </div>
          </FooterCol>

          {/* Visit */}
          <FooterCol title="Showroom & Office" mobile={m}>
            {/* Was two hand-typed lines that printed the city twice —
                "32 Norfield Crescent, Toronto, Ontario" followed by  claims-allow
                "Toronto, ON M9W 1X6". Derived from BUSINESS_NAP, it cannot
                say Toronto twice and cannot drift from the JSON-LD address. */}
            <p style={{ marginBottom: '1.25rem', lineHeight: 1.7 }}>
              {BUSINESS_NAP.address.streetAddress}<br />
              {BUSINESS_NAP.address.addressLocality}, {BUSINESS_NAP.address.addressRegion}{' '}
              {BUSINESS_NAP.address.postalCode}
            </p>
            <div className="footer-links" style={{ marginBottom: '1.5rem' }}>
              <a href={BUSINESS_NAP.phoneHref} style={{ color: 'var(--copper-bright)', fontWeight: 600 }}>
                {BUSINESS_NAP.phoneDisplay}
              </a>
              <a href={`mailto:${BUSINESS_NAP.email}`}>{BUSINESS_NAP.email}</a>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.7 }}>
              <span style={{ color: 'var(--cream-50)', fontWeight: 600 }}>Hours</span>
              <br />
              {HOURS_LINE}
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
