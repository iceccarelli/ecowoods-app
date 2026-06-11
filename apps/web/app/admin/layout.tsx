import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import SignOutButton from '@/app/components/SignOutButton';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/quotes', label: 'Quotes & Leads', icon: '📋' },
  { href: '/admin/projects', label: 'Projects', icon: '🏗' },
  { href: '/admin/invoices', label: 'Invoices', icon: '🧾' },
  { href: '/admin/users', label: 'Customers', icon: '👥' },
  { href: '/admin/inquiries', label: 'Inquiries', icon: '✉' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  return (
    <div className="portal-layout">
      {/* Admin Sidebar */}
      <aside className="portal-sidebar admin-sidebar">
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
              <small style={{ color: 'var(--copper-bright)' }}>Admin Portal</small>
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
            <div className="portal-user-avatar" style={{ background: 'var(--copper)' }}>
              {session.user.name?.[0] ?? 'A'}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{session.user.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--copper-bright)' }}>Administrator</div>
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
