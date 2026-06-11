import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import SignOutButton from '@/app/components/SignOutButton';

const navItems = [
  { href: '/mypage', label: 'Dashboard', icon: '⊡' },
  { href: '/mypage/quotes', label: 'My Quotes', icon: '📋' },
  { href: '/mypage/projects', label: 'My Projects', icon: '🏗' },
  { href: '/mypage/invoices', label: 'Invoices & Payments', icon: '🧾' },
  { href: '/mypage/inquiries', label: 'Inquiries', icon: '✉' },
];

export default async function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="portal-layout">
      {/* Sidebar */}
      <aside className="portal-sidebar">
        <div className="portal-sidebar-brand">
          <Link href="/" className="brand-lockup">
            <span className="brand-mark" style={{ width: 36, height: 36 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 2C9 6 6 8 6 12c0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3-6-6-10Z" fill="currentColor" fillOpacity="0.18" />
                <path d="M12 4.5c-2 3-4 4.5-4 7.5 0 2.5 1.8 4.5 4 4.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="brand-copy">
              <strong>Ecowoods</strong>
              <small>My Account</small>
            </span>
          </Link>
        </div>

        <nav className="portal-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="portal-nav-item">
              <span className="portal-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="portal-sidebar-footer">
          <div className="portal-user">
            <div className="portal-user-avatar">
              {session.user.name?.[0] ?? session.user.email?.[0] ?? '?'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {session.user.name ?? 'Customer'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                {session.user.email}
              </div>
            </div>
          </div>

          <SignOutButton />
        </div>
      </aside>

      {/* Main content */}
      <main className="portal-main">
        {children}
      </main>
    </div>
  );
}
