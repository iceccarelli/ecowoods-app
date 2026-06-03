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
          <div className="footer-social flex flex-wrap gap-x-4 gap-y-2" aria-label="Social media">
  {/* Instagram */}
  <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  </a>

  {/* Facebook */}
  <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1V10.9H7.7V14h2.7v8h3.1Z" />
    </svg>
  </a>

  {/* Houzz */}
  <a href="https://www.houzz.com/" target="_blank" rel="noopener noreferrer" aria-label="Houzz">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M16.5 12v9h-3v-5h-3v5h-3V3l9 5.4V12Z" />
    </svg>
  </a>

  {/* Google Reviews */}
  <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" aria-label="Google Reviews">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  </a>

  {/* Pinterest */}
  <a href="https://www.pinterest.com/" target="_blank" rel="noopener noreferrer" aria-label="Pinterest">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5-.09-.64-.17-1.63.04-2.33.19-.64 1.22-4.1 1.22-4.1s-.31-.62-.31-1.54c0-1.44.84-2.52 1.88-2.52.89 0 1.32.67 1.32 1.46 0 .89-.57 2.22-.86 3.46-.24 1.03.52 1.87 1.54 1.87 1.85 0 3.27-1.95 3.27-4.76 0-2.49-1.79-4.23-4.35-4.23-2.96 0-4.7 2.22-4.7 4.51 0 .89.34 1.85.77 2.37.08.1.1.19.07.3-.08.32-.25 1.05-.28 1.2-.04.18-.14.22-.34.13-1.25-.58-2.03-2.4-2.03-3.86 0-3.14 2.29-6.03 6.6-6.03 3.46 0 6.16 2.47 6.16 5.76 0 3.44-2.17 6.21-5.2 6.21-1.01 0-1.97-.53-2.29-1.15l-.62 2.37c-.23.88-.84 1.99-1.26 2.66.95.29 1.96.45 3 .45 5.52 0 10-4.48 10-10S17.52 2 12 2z" />
    </svg>
  </a>

  {/* YouTube */}
  <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l6.425 4-6.425 4z" />
    </svg>
  </a>

  {/* LinkedIn */}
  <a href="https://www.linkedin.com/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3v9zM6.5 8.25A1.75 1.75 0 118.3 6.5 1.75 1.75 0 016.5 8.25zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z" />
    </svg>
  </a>

  {/* TikTok */}
  <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.04-.1z" />
    </svg>
  </a>

  {/* X (Twitter) */}
  <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M18.244 2.25l-7.451 8.502L4.5 2.25H1.5l7.13 8.134L1.5 21.75h3l7.3-8.34 7.3 8.34h3l-7.13-8.366L21.75 2.25h-3.506z" />
    </svg>
  </a>

  {/* Threads */}
  <a href="https://www.threads.net/" target="_blank" rel="noopener noreferrer" aria-label="Threads">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
    </svg>
  </a>

  {/* Yelp */}
  <a href="https://www.yelp.com/" target="_blank" rel="noopener noreferrer" aria-label="Yelp">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-1-3 3-1 1 3-3 1zm4-6l-3 1-1-3 3-1 1 3zm-4-2l3-1 1 3-3 1-1-3z" />
    </svg>
  </a>

  {/* WhatsApp */}
  <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.67-1.611-.922-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.372-.01-.571-.01-.198 0-.52.074-.793.372-.273.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l4.92-1.38A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
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
