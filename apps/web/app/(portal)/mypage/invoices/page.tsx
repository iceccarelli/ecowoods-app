import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { format } from 'date-fns';
import BankPaymentForm from './BankPaymentForm';

function formatCAD(amount: number | { toNumber(): number }) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(
    typeof amount === 'number' ? amount : amount.toNumber()
  );
}

const statusLabel: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  OVERDUE: 'Overdue',
  PAID: 'Paid',
  VOID: 'Void',
};

export default async function MyInvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [invoices, settings] = await Promise.all([
    db.invoice.findMany({
      where: { project: { userId: session.user.id } },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { title: true, city: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    }),
    db.settings.findFirst(),
  ]);

  // Only show SENT/OVERDUE/PAID — DRAFT invoices are admin-only
  const outstanding = invoices.filter((i) => i.status === 'SENT' || i.status === 'OVERDUE');
  const paid = invoices.filter((i) => i.status === 'PAID');

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Invoices &amp; Payments</h1>
          <p className="portal-subtitle">
            {outstanding.length > 0
              ? `${outstanding.length} invoice${outstanding.length > 1 ? 's' : ''} outstanding`
              : 'All invoices are settled — thank you!'}
          </p>
        </div>
      </div>

      {/* Outstanding invoices */}
      {outstanding.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Outstanding Invoices
          </h2>
          <div className="portal-invoice-grid">
            {outstanding.map((inv) => (
              <div key={inv.id} className="portal-invoice-card outstanding">
                <div className="portal-invoice-card-header">
                  <div>
                    <div className="portal-invoice-number">#{inv.number}</div>
                    <div className="portal-invoice-project">{inv.project.title}</div>
                  </div>
                  <span className={`portal-badge portal-badge-${inv.status.toLowerCase()}`}>
                    {statusLabel[inv.status]}
                  </span>
                </div>

                <div className="portal-invoice-amount">{formatCAD(inv.total)}</div>

                {inv.description && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '0.5rem 0' }}>
                    {inv.description}
                  </p>
                )}

                {inv.dueDate && (
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '1rem' }}>
                    Due: <strong>{format(inv.dueDate, 'MMMM d, yyyy')}</strong>
                  </div>
                )}

                <div className="portal-invoice-actions">
                  {/* Stripe checkout */}
                  <Link
                    href={`/mypage/invoices/${inv.id}/pay`}
                    className="btn btn-copper btn-sm"
                  >
                    Pay Now — Card / Apple Pay
                  </Link>
                  {/* View / download PDF */}
                  {inv.pdfUrl && !inv.pdfUrl.startsWith('data:') && (
                    <>
                      <Link href={`/docs/invoice/${inv.id}`} className="btn btn-ghost btn-sm">
                        View Invoice
                      </Link>
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Download PDF
                      </a>
                    </>
                  )}
                </div>

                {/* Bank transfer option */}
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.88rem', color: 'var(--copper-deep)', fontWeight: 600 }}>
                    Pay by e-Transfer / Bank Transfer
                  </summary>
                  <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', fontSize: '0.88rem' }}>
                    <p style={{ marginBottom: '0.75rem' }}>
                      {settings?.aiBankTransferInstructions ?? 'Please e-transfer payment to accounting@ecowoods.ca with your invoice number as the memo.'}
                    </p>
                    <BankPaymentForm invoiceId={inv.id} invoiceNumber={inv.number ?? ''} />
                  </div>
                </details>

                {/* Pending bank payments */}
                {inv.payments.some((p) => p.status === 'PENDING') && (
                  <div className="portal-badge portal-badge-pending" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
                    ⏳ Bank payment pending admin confirmation
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment history */}
      {paid.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
            Payment History
          </h2>
          <div className="portal-card">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Project</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {paid.map((inv) => (
                  <tr key={inv.id}>
                    <td><strong>#{inv.number}</strong></td>
                    <td style={{ fontSize: '0.88rem' }}>{inv.project.title}</td>
                    <td style={{ fontWeight: 700 }}>{formatCAD(inv.total)}</td>
                    <td style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)' }}>
                      {inv.paidAt ? format(inv.paidAt, 'MMM d, yyyy') : '—'}
                    </td>
                    <td>
                      {inv.pdfUrl && !inv.pdfUrl.startsWith('data:') ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Link href={`/docs/invoice/${inv.id}`} style={{ color: 'var(--copper-deep)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                            View
                          </Link>
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                            PDF
                          </a>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--muted-soft)', fontSize: 'var(--fs-sm)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {invoices.length === 0 && (
        <div className="portal-empty-state">
          <p>No invoices yet. Invoices will appear here once your project contract is signed.</p>
          <Link href="/#quote" className="btn btn-copper btn-sm">Request a quote</Link>
        </div>
      )}
    </div>
  );
}
