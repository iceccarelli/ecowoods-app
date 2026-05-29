export default function SiteFooter() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="shell">
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <div className="brand-lockup" style={{ marginBottom: '1.25rem' }}>
              <span className="brand-mark" style={{ width: '42px', height: '42px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path
                    d="M12 2C9 6 6 8 6 12c0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3-6-6-10Z"
                    fill="currentColor"
                    fillOpacity="0.18"
                  />
                  <path d="M12 4.5c-2 3-4 4.5-4 7.5 0 2.5 1.8 4.5 4 4.5" strokeLinecap="round" />
                </svg>
              </span>
              <span className="brand-copy">
                <strong style={{ color: 'var(--cream-50)' }}>Ecowoods</strong>
                <small style={{ color: 'rgba(245, 239, 230, 0.55)' }}>Toronto · Est. 1998</small>
              </span>
            </div>
            <p style={{ marginBottom: '1.5rem', maxWidth: '320px' }}>
              Master hardwood flooring craftsmen serving Toronto and the GTA for over 25 years.
              Eco-friendly finishes, lifetime workmanship warranty, dust-free refinishing.
            </p>
            <div className="availability-pill dark">
              <span className="availability-dot" />
              Now booking · Spring 2026
            </div>
          </div>

          {/* Services */}
          <div>
            <h5>Services</h5>
            <div className="footer-links">
              <a href="#services">Hardwood Installation</a>
              <a href="#services">Refinishing & Restoration</a>
              <a href="#services">Dust-Free Sanding</a>
              <a href="#services">Custom Stain Matching</a>
              <a href="#services">Stair Refinishing</a>
              <a href="#services">Custom Inlays & Borders</a>
              <a href="#services">Commercial Projects</a>
            </div>
          </div>

          {/* Service Areas */}
          <div>
            <h5>Service Areas</h5>
            <div className="footer-links">
              <a href="#areas">Toronto · Downtown</a>
              <a href="#areas">North York</a>
              <a href="#areas">Etobicoke</a>
              <a href="#areas">Scarborough</a>
              <a href="#areas">Vaughan & Markham</a>
              <a href="#areas">Richmond Hill</a>
              <a href="#areas">Mississauga · Oakville</a>
            </div>
          </div>

          {/* Visit */}
          <div>
            <h5>Showroom & Office</h5>
            <p style={{ marginBottom: '1.25rem', lineHeight: 1.7 }}>
              2899 Steeles Avenue West<br />
              Toronto, ON M3J 3A1
            </p>
            <div className="footer-links" style={{ marginBottom: '1.5rem' }}>
              <a href="tel:+14165559663" style={{ color: 'var(--copper-bright)', fontWeight: 600 }}>
                (416) 555-WOOD
              </a>
              <a href="mailto:hello@ecowoods.ca">hello@ecowoods.ca</a>
            </div>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
              <span style={{ color: 'var(--cream-50)', fontWeight: 600 }}>Hours</span>
              <br />
              Mon–Sat · 8:00 AM – 7:00 PM<br />
              Sunday · 10:00 AM – 4:00 PM
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div>© {new Date().getFullYear()} Ecowoods Hardwood Flooring Inc. — All rights reserved.</div>
          <div className="footer-social" aria-label="Social media">
            <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
              </svg>
            </a>
            <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10.9H7.7V14h2.7v8h3.1Z" />
              </svg>
            </a>
            <a href="https://www.houzz.com/" target="_blank" rel="noopener noreferrer" aria-label="Houzz">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12v9h-3v-5h-3v5h-3V3l9 5.4V12Z" />
              </svg>
            </a>
            <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" aria-label="Google Reviews">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </a>
          </div>
          <div>
            <a href="/privacy" style={{ marginRight: '1.5rem' }}>Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
