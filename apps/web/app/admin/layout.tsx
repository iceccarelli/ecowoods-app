import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { countOpenPaymentCases } from '@/lib/payment-reconciliation';
import { countMissingCritical } from '@/lib/config-status';
import {
  DashboardIcon,
  QuotesIcon,
  ProjectsIcon,
  InvoicesIcon,
  CustomersIcon,
  InquiriesIcon,
  SettingsIcon,
  ShopIcon,
  FloorGraphIcon,
} from '@/app/components/PortalIcons';

/* Private surface: noindex in the document as well as in the X-Robots-Tag
   header (vercel.json), so one cannot silently lose the other. */
export const metadata = { robots: { index: false, follow: false } };

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/admin/quotes', label: 'Quotes & Leads', icon: <QuotesIcon /> },
  { href: '/admin/projects', label: 'Projects', icon: <ProjectsIcon /> },
  { href: '/admin/orders', label: 'Orders', icon: <ShopIcon /> },
  { href: '/admin/invoices', label: 'Invoices', icon: <InvoicesIcon /> },
  { href: '/admin/payment-cases', label: 'Payment cases', icon: <InvoicesIcon /> },
  { href: '/admin/users', label: 'Customers', icon: <CustomersIcon /> },
  { href: '/admin/inquiries', label: 'Inquiries', icon: <InquiriesIcon /> },
  { href: '/admin/floor-graph', label: 'Floor Graph', icon: <FloorGraphIcon /> },
  /* MEAS-02. Reachable from the chrome on purpose: an admin page that exists
     but is not linked is a page nobody opens, and a funnel nobody opens is the
     write-only failure PG0 found three times over. */
  { href: '/admin/funnel', label: 'Funnel', icon: <FloorGraphIcon /> },
  /* Which settings are configured (names only, never values). */
  { href: '/admin/system', label: 'System status', icon: <SettingsIcon /> },
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

  // Unresolved money cases stay visible from every admin page (admin-only: the guard above has run).
  const openCases = await countOpenPaymentCases();

  // Missing critical settings. Pure env read, wrapped so it can never fail the layout.
  let missingCritical = 0;
  try {
    missingCritical = countMissingCritical(process.env);
  } catch {
    missingCritical = 0;
  }

  return (
    <div className="portal-layout">
      {/* Admin Sidebar */}
      <aside className="portal-sidebar admin-sidebar">
        <nav className="portal-nav" aria-label="Admin">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="portal-nav-item">
              <span className="portal-nav-icon">{item.icon}</span>
              {item.label}
              {item.href === '/admin/payment-cases' && openCases ? (
                <span
                  role="status"
                  aria-label={`${openCases} open payment case${openCases === 1 ? '' : 's'}`}
                  style={{ marginLeft: 'auto', minWidth: '1.4rem', padding: '0 0.4rem', borderRadius: '999px', background: 'var(--warning, #b45309)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}
                >
                  {openCases}
                </span>
              ) : null}
              {item.href === '/admin/system' && missingCritical ? (
                <span
                  role="status"
                  aria-label={`${missingCritical} critical setting${missingCritical === 1 ? '' : 's'} missing`}
                  style={{ marginLeft: 'auto', minWidth: '1.4rem', padding: '0 0.4rem', borderRadius: '999px', background: 'var(--danger, #b91c1c)', color: '#fff', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}
                >
                  {missingCritical}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="portal-main">
        {children}
      </div>
    </div>
  );
}
