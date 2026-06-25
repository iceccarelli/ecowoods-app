import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import {
  DashboardIcon,
  QuotesIcon,
  ProjectsIcon,
  InvoicesIcon,
  CustomersIcon,
  InquiriesIcon,
  SettingsIcon,
} from '@/app/components/PortalIcons';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/admin/quotes', label: 'Quotes & Leads', icon: <QuotesIcon /> },
  { href: '/admin/projects', label: 'Projects', icon: <ProjectsIcon /> },
  { href: '/admin/invoices', label: 'Invoices', icon: <InvoicesIcon /> },
  { href: '/admin/users', label: 'Customers', icon: <CustomersIcon /> },
  { href: '/admin/inquiries', label: 'Inquiries', icon: <InquiriesIcon /> },
  { href: '/admin/settings', label: 'Settings', icon: <SettingsIcon /> },
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
