import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  DashboardIcon,
  QuotesIcon,
  ProjectsIcon,
  InvoicesIcon,
  InquiriesIcon,
} from '@/app/components/PortalIcons';

const navItems = [
  { href: '/mypage', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/mypage/quotes', label: 'My Quotes', icon: <QuotesIcon /> },
  { href: '/mypage/projects', label: 'My Projects', icon: <ProjectsIcon /> },
  { href: '/mypage/invoices', label: 'Invoices & Payments', icon: <InvoicesIcon /> },
  { href: '/mypage/inquiries', label: 'Inquiries', icon: <InquiriesIcon /> },
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
        <nav className="portal-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="portal-nav-item">
              <span className="portal-nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="portal-main">
        {children}
      </main>
    </div>
  );
}
