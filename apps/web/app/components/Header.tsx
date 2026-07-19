'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import ThemeToggle from './ThemeToggle';
import CommandPalette from './CommandPalette';
import { EcowoodsLeaf } from './EcowoodsLeaf';

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
const navigation = [
  { label: 'Services', href: '#services' },
  { label: 'Species', href: '#species' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Process', href: '#process' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'FAQ', href: '#faq' },
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

const PHONE_DISPLAY = '(416) 249-1276';
const PHONE_HREF = 'tel:+14162491276';

/* ---------------------- Component ---------------------- */
export default function Header() {
  const { direction, scrolled } = useScrollState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalExpanded, setPortalExpanded] = useState(false);
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
        role="banner"
      >
        <div className="topbar-inner">
          {/* Brand Lockup */}
          <a className="brand-lockup" href={baseUrl} aria-label="Ecowoods home">
            <span className="brand-mark" aria-hidden="true">
              <EcowoodsLeaf size={24} />
            </span>
            <span className="brand-copy">
              <strong>Ecowoods</strong>
              <small>Toronto · Est. 1998</small>
            </span>
          </a>

          {/* Primary Nav */}
          <nav className="topbar-nav" aria-label="Primary">
            {navigation.map((item) => {
              const id = item.href.replace('#', '');
              const isActive = activeSection === id;
              return (
                <a
                  key={item.href}
                  href={`${baseUrl}${item.href}`}
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
      <div
        id="mobile-sheet"
        className={`mobile-sheet ${mobileOpen ? 'open' : ''}`}
        aria-hidden={!mobileOpen}
      >
        <nav aria-label="Mobile navigation">
          {navigation.map((item, idx) => (
            <a
              key={item.href}
              href={`${baseUrl}${item.href}`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
              <span className="num">0{idx + 1}</span>
            </a>
          ))}
          <a href={`${baseUrl}#quote`} onClick={() => setMobileOpen(false)}>
            Free Quote
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
            Mon–Sat · 8:00 AM – 7:00 PM<br />
            Showroom: 32 Norfield Crescent, Toronto, Ontario
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
        <a className="btn btn-copper btn-sm" href={`${baseUrl}#quote`} style={{ flex: 2 }}>
          Get Free Quote
        </a>
      </div>
    </>
  );
}
