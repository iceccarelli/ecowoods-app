'use client';
import Link from 'next/link';
import { MegaMenu, type MegaColumn } from './MegaMenu';

import { useState, useEffect, useRef } from 'react';
import { BUSINESS_NAP, BUSINESS_ADDRESS_LINE, HOURS_LINE } from '@ecowoods/shared/constants';
import { useSession, signOut } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import CommandPalette from './CommandPalette';
import { EW_MARK, EW_MARK_ALT, EW_MARK_SIZE } from '@/lib/brand';

/* ---------------------- Hooks ---------------------- */
function useScrollState() {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const current = window.scrollY;
      setScrolled(current > 16);
      if (Math.abs(current - lastY) > 40) {
        setDirection(current > lastY && current > 220 ? 'down' : 'up');
        setLastY(current);
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastY]);

  return { direction, scrolled };
}

/* ---------------------- Navigation ---------------------- */
/* THE PANELS — the AWS "Products ▾" mechanism, applied to a corpus this site
 * had no way to show anyone.
 *
 * Curated, not generated. AWS does not list 240 services in its panel; it lists
 * the categories a visitor arrives with. Dumping forty-four glossary terms here
 * would be a directory, and a directory is what /glossary already is. These are
 * the entries that answer a question someone is holding.
 *
 * Every href is a real page and every one is also reachable from its hub, so
 * nothing here is the ONLY path to anything — a mega-menu that is the sole route
 * to a page is a page that dies the day the menu breaks.
 */
const SERVICES_MENU: MegaColumn[] = [
  {
    title: 'By the job',
    href: '/services',
    items: [
      { label: 'Refinishing', href: '/hardwood-floor-refinishing-toronto', note: 'Screen and recoat, or full sand' },
      { label: 'New installation', href: '/hardwood-flooring-toronto', note: 'Solid and engineered' },
      { label: 'Dust-free sanding', href: '/services/dust-free-sanding', note: 'HEPA-sealed, stay in the house' },
      { label: 'Stairs', href: '/hardwood-stairs-toronto', note: 'Four different jobs, one word' },
      { label: 'Floor restoration', href: '/services/floor-restoration' },
      { label: 'Custom inlays', href: '/services/custom-inlays' },
    ],
  },
  {
    title: 'By who you are',
    href: '/commercial',
    items: [
      { label: 'Condo boards & property managers', href: '/commercial', note: 'After-hours, COI, priced by area' },
      { label: 'Realtors & sellers', href: '/realtors', note: 'Three-day pre-list recoat' },
      { label: 'Score a quote you already have', href: '/framework/assess', note: 'Any contractor, including us' },
    ],
  },
  {
    title: 'By the problem',
    href: '/hardwood-floor-problems-toronto',
    items: [
      { label: 'Cupping, gapping, crowning', href: '/hardwood-floor-problems-toronto', note: 'Five symptoms, one mechanism' },
      { label: 'Buckling and edge peaking', href: '/hardwood-floor-problems-toronto' },
      { label: 'Matching stairs to a floor', href: '/hardwood-stairs-toronto' },
      { label: 'Is my floor refinishable?', href: '/guides/reference-refinishing-existing-hardwood' },
    ],
  },
  {
    title: 'Before you decide',
    href: '/guides',
    items: [
      { label: 'What it costs in Toronto', href: '/guides/hardwood-flooring-cost-toronto', note: 'Three published bands' },
      { label: 'Score a quote you already have', href: '/framework/assess', note: '27 criteria' },
      { label: 'Solid or engineered', href: '/guides/solid-vs-engineered-hardwood-toronto' },
      { label: 'How to choose a contractor', href: '/guides/how-to-choose-hardwood-contractor-toronto' },
    ],
  },
];

const LIBRARY_MENU: MegaColumn[] = [
  {
    title: 'Technical papers',
    href: '/papers',
    items: [
      { label: 'Provenance', href: '/papers/where-toronto-hardwood-comes-from', note: 'Where the wood comes from' },
      { label: 'Grade', href: '/papers/hardwood-grading-standards-nhla-nwfa', note: 'NHLA and NWFA, side by side' },
      { label: 'Climate Mastery', href: '/papers/toronto-hardwood-climate-moisture-protocol' },
      { label: 'The Craft', href: '/papers/hardwood-refinishing-machines-and-sequence' },
      { label: 'Selection and cost', href: '/papers/hardwood-selection-and-cost-framework-gta' },
    ],
  },
  {
    title: 'Species dossiers',
    href: '/guides',
    items: [
      { label: 'White oak', href: '/guides/white-oak-flooring-toronto' },
      { label: 'Red oak', href: '/guides/red-oak-flooring-toronto' },
      { label: 'Hard maple', href: '/guides/hard-maple-flooring-toronto' },
      { label: 'White ash', href: '/guides/white-ash-flooring-toronto', note: 'Cut faster than it grows' },
      { label: 'Hickory · Black walnut', href: '/guides/hickory-flooring-toronto' },
    ],
  },
  {
    title: 'Reference',
    href: '/resources',
    items: [
      { label: 'Glossary', href: '/glossary', note: '44 terms, each citing a paper' },
      { label: 'Standards register', href: '/standards', note: 'NHLA, NWFA, ASTM, FPL' },
      { label: 'Figures and data', href: '/data' },
      { label: 'The Well-Installed Framework', href: '/framework' },
      { label: 'Visual library', href: '/library' },
    ],
  },
  {
    title: 'Evidence',
    href: '/case-studies',
    items: [
      { label: 'Case studies', href: '/case-studies', note: 'Measured jobs, published readings' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'What we publish about ourselves', href: '/about' },
      { label: 'Everything, as it shipped', href: '/whats-new' },
    ],
  },
];

const navigation = [
  /* Two panels and four links. See MegaMenu.tsx for why a panel beats a hub, and
   * F-163 for why the five commercial pages are here at all. */
  { label: 'Refinishing', href: '/hardwood-floor-refinishing-toronto' },
  { label: 'Installation', href: '/hardwood-flooring-toronto' },
  { label: 'Stairs', href: '/hardwood-stairs-toronto' },
  { label: 'Problems', href: '/hardwood-floor-problems-toronto' },
];

const MYPAGE_NAV = [
  { href: '/mypage', label: 'Dashboard' },
  { href: '/mypage/quotes', label: 'My Quotes' },
  { href: '/mypage/projects', label: 'My Projects' },
  { href: '/mypage/invoices', label: 'Invoices & Payments' },
  { href: '/mypage/inquiries', label: 'Inquiries' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/quotes', label: 'Quotes & Leads' },
  { href: '/admin/projects', label: 'Projects' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/users', label: 'Customers' },
  { href: '/admin/inquiries', label: 'Inquiries' },
  { href: '/admin/settings', label: 'Settings' },
];

const PHONE_DISPLAY = BUSINESS_NAP.phoneDisplay;
const PHONE_HREF = BUSINESS_NAP.phoneHref;

/* ---------------------- Component ---------------------- */
export default function Header() {
  const { direction, scrolled } = useScrollState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(false);
  /* Which mega-menu group is open in the mobile drawer. The panel is a pointer
     affordance and hides under 1000px (see .mm in globals.css), so without this
     the library tree — five papers, sixteen guides, forty-four glossary terms —
     would exist on desktop and vanish on a phone. AWS solves the same problem
     the same way: the footer and drawer become accordions. */
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [portalMenuOpen, setPortalMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState('/');
  const { data: session, status } = useSession();
  const portalMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBaseUrl(window.location.origin + '/');
  }, []);

  const isHidden = direction === 'down' && !mobileOpen;

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Reset portal sub-menu when mobile sheet closes
  useEffect(() => {
    if (!mobileOpen) setPortalExpanded(false);
  }, [mobileOpen]);

  // Track active section on scroll
  useEffect(() => {
    const onScroll = () => {
      const sections = navigation
        .map((n) => n.href.replace('#', ''))
        .map((id) => document.getElementById(id))
        .filter(Boolean) as HTMLElement[];
      const offset = 140;
      let current = '';
      for (const section of sections) {
        const top = section.getBoundingClientRect().top;
        if (top <= offset) current = section.id;
      }
      setActiveSection(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        setPortalMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close portal dropdown when clicking outside of it
  useEffect(() => {
    if (!portalMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (portalMenuRef.current && !portalMenuRef.current.contains(e.target as Node)) {
        setPortalMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [portalMenuOpen]);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isLoggedIn = status === 'authenticated';
  const portalLabel = isAdmin ? 'Admin' : 'My Page';
  const portalNav = isAdmin ? ADMIN_NAV : MYPAGE_NAV;
  const portalIndex = navigation.length + 2;

  return (
    <>
      <header
        className={`topbar ${isHidden ? 'hidden' : ''} ${scrolled ? 'scrolled' : ''}`}
      >
        <div className="topbar-inner">
          {/* Brand Lockup */}
          <a className="brand-lockup" href={baseUrl} aria-label="Ecowoods home">
            {/* F-167. This was aria-hidden with alt="", wrapping a 14.5 KB base64
                data URI. A data URI has no URL: it cannot be crawled, indexed,
                linked or shared, which is why Google Images could not find this
                company's logo. And the two accessibility attributes told the one
                crawler that did parse the tag to ignore it.

                Now a real file at a real address, with alt text that says what
                the mark is, and explicit dimensions so reserving its box costs
                no layout shift. Same pixels. */}
            <span className="brand-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={EW_MARK}
                alt={EW_MARK_ALT}
                width={EW_MARK_SIZE}
                height={EW_MARK_SIZE}
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </span>
            <span className="brand-copy">
              <strong>Ecowoods</strong>
              <small>Toronto · Est. {BUSINESS_NAP.foundedYear}</small>
            </span>
          </a>

          {/* Primary Nav */}
          <nav className="topbar-nav" aria-label="Primary">
            <MegaMenu label="Services" id="services" columns={SERVICES_MENU} footer={{ label: 'All six services', href: '/services' }} />
            <MegaMenu label="Library" id="library" columns={LIBRARY_MENU} footer={{ label: 'Everything published here', href: '/resources' }} />
            {navigation.map((item) => {
              // Check if this is an anchor link or a page link
              const isAnchor = item.href.startsWith('#');
              const id = isAnchor ? item.href.replace('#', '') : '';
              const isActive = isAnchor && activeSection === id;
              const href = isAnchor ? `${baseUrl}${item.href}` : item.href;
              return (
                <a
                  key={item.href}
                  href={href}
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Right CTA cluster */}
          <div className="topbar-cta">
            <CommandPalette />
            <ThemeToggle />
            {isLoggedIn ? (
              <div className="portal-menu" ref={portalMenuRef}>
                <button
                  type="button"
                  className="login-btn"
                  onClick={() => setPortalMenuOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={portalMenuOpen}
                  aria-label={portalLabel}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
                    <circle cx="12" cy="8" r="3.5" strokeLinecap="round" />
                    <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {portalLabel}
                  <svg
                    className="login-btn-chevron"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ transform: portalMenuOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {portalMenuOpen && (
                  <div className="portal-menu-panel" role="menu">
                    <div className="portal-menu-user">
                      <div className="portal-menu-name">{session?.user?.name ?? 'Account'}</div>
                      <div className="portal-menu-email">{session?.user?.email}</div>
                    </div>
                    <div className="portal-menu-divider" />
                    <a
                      className="portal-menu-item"
                      href={isAdmin ? '/admin' : '/mypage'}
                      role="menuitem"
                      onClick={() => setPortalMenuOpen(false)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                      </svg>
                      Dashboard
                    </a>
                    <button
                      type="button"
                      className="portal-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setPortalMenuOpen(false);
                        signOut({ callbackUrl: '/' });
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="16" height="16">
                        <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M16 16l4-4-4-4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 12H9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a className="login-btn" href="/login" aria-label="Login to your account">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15">
                  <circle cx="12" cy="8" r="3.5" strokeLinecap="round" />
                  <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Login
              </a>
            )}
            <a className="phone-pill" href={PHONE_HREF} aria-label={`Call ${PHONE_DISPLAY}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .95.68l1.5 4.4a1 1 0 0 1-.5 1.21l-1.85 1a13 13 0 0 0 6.33 6.33l1-1.85a1 1 0 0 1 1.21-.5l4.4 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="phone-pill-label">{PHONE_DISPLAY}</span>
            </a>
            {/* P0.4 secondary CTA — the photo-triage track. Same visibility
                rule as topbar-quote: hidden <=768px, the mobile sticky bar
                carries its own. */}
            <a className="btn btn-ghost btn-sm topbar-quote topbar-photos" href={`${baseUrl}#photo-triage`}>
              Send photos
            </a>
            {/* topbar-quote: hidden <=768px — .sticky-cta-mobile already carries it. */}
            <a className="btn btn-copper btn-sm topbar-quote" href={`${baseUrl}#quote`}>
              Free Quote
              <svg
                className="btn-arrow"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </a>
            <button
              className={`hamburger ${mobileOpen ? 'open' : ''}`}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-sheet"
            >
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      {/* `inert` is what actually removes the closed sheet from the tab order and
          the accessibility tree. aria-hidden alone left every link inside it
          focusable, which axe reported as aria-hidden-focus on 201 of 220
          measured cells — a keyboard user tabbing any page fell into an
          invisible off-screen menu. See audit/FINDINGS.md F-30. */}
      <div
        id="mobile-sheet"
        className={`mobile-sheet ${mobileOpen ? 'open' : ''}`}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <nav aria-label="Mobile navigation">
          {navigation.map((item, idx) => {
            const href = item.href.startsWith('#') ? `${baseUrl}${item.href}` : item.href;
            return (
              <a
                key={item.href}
                href={href}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
                <span className="num">0{idx + 1}</span>
              </a>
            );
          })}
          {[
            { key: 'services', label: 'Services', cols: SERVICES_MENU },
            { key: 'library', label: 'Library', cols: LIBRARY_MENU },
          ].map((group) => (
            <div className="mnav-group" key={group.key}>
              <button
                type="button"
                className="mnav-group-trigger"
                aria-expanded={openGroup === group.key}
                onClick={() => setOpenGroup((v) => (v === group.key ? null : group.key))}
              >
                <span>{group.label}</span>
                <span className="mnav-group-sign" aria-hidden="true">{openGroup === group.key ? '\u2212' : '+'}</span>
              </button>
              {openGroup === group.key && (
                <div className="mnav-group-body">
                  {group.cols.map((col) => (
                    <div key={col.title}>
                      <p className="mnav-group-title">{col.title}</p>
                      <ul>
                        {col.items.map((it) => (
                          <li key={it.href}>
                            <Link href={it.href} onClick={() => setMobileOpen(false)}>{it.label}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <a href={`${baseUrl}#estimate`} onClick={() => setMobileOpen(false)}>
            Get a written price
            <span className="num">0{navigation.length + 1}</span>
          </a>

          {/* Portal section — Login or My Page / Admin */}
          {!isLoggedIn && status !== 'loading' ? (
            <a href="/login" onClick={() => setMobileOpen(false)}>
              Login
              <span className="num">0{portalIndex}</span>
            </a>
          ) : isLoggedIn ? (
            <div className="mobile-portal-section">
              <button
                className="mobile-portal-trigger"
                onClick={() => setPortalExpanded((v) => !v)}
                aria-expanded={portalExpanded}
              >
                <span>{portalLabel}</span>
                <span className="mobile-portal-right">
                  <span
                    className="mobile-portal-arrow"
                    style={{ transform: portalExpanded ? 'rotate(180deg)' : 'none' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                  <span className="num" style={{ position: 'static' }}>0{portalIndex}</span>
                </span>
              </button>
              {portalExpanded && (
                <div className="mobile-portal-submenu">
                  {portalNav.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </nav>

        <div className="mobile-sheet-foot">
          <a className="btn btn-copper btn-lg" href={PHONE_HREF}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .95.68l1.5 4.4a1 1 0 0 1-.5 1.21l-1.85 1a13 13 0 0 0 6.33 6.33l1-1.85a1 1 0 0 1 1.21-.5l4.4 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Call {PHONE_DISPLAY}
          </a>
          <a className="btn btn-ghost btn-lg" href={`${baseUrl}#quote`} onClick={() => setMobileOpen(false)}>
            Request a free in-home estimate
          </a>
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
            {HOURS_LINE}<br />
            Showroom: {BUSINESS_ADDRESS_LINE}
          </p>
        </div>
      </div>

      {/* Mobile sticky bottom CTA */}
      <div className="sticky-cta-mobile">
        <a className="btn btn-ghost btn-sm" href={PHONE_HREF} style={{ flex: 1 }}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .95.68l1.5 4.4a1 1 0 0 1-.5 1.21l-1.85 1a13 13 0 0 0 6.33 6.33l1-1.85a1 1 0 0 1 1.21-.5l4.4 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Call
        </a>
        <a className="btn btn-ghost btn-sm" href={`${baseUrl}#photo-triage`} style={{ flex: 1 }}>
          Send photos
        </a>
        <a className="btn btn-copper btn-sm" href={`${baseUrl}#quote`} style={{ flex: 2 }}>
          Get Free Quote
        </a>
      </div>
    </>
  );
}
