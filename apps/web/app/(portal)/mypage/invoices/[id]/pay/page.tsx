/**
 * Stripe Checkout initiation page.
 * Redirects to Stripe Checkout hosted page.
 * 스트라이프 결제 페이지: Stripe Checkout으로 리디렉션
 */
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import StripeCheckoutButton from './StripeCheckoutButton';

function formatCAD(amount: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export default async function InvoicePayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { project: { include: { user: true } } },
  });

  if (!invoice || invoice.project.userId !== session.user.id) {
    redirect('/mypage/invoices');
  }

  if (invoice.status === 'PAID') {
    return (
      <div className="portal-page">
        <div className="portal-header">
          <h1 className="portal-title">Invoice Already Paid</h1>
        </div>
        <div className="portal-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <p>Invoice #{invoice.number} has already been paid. Thank you!</p>
          <Link href="/mypage/invoices" className="btn btn-copper btn-sm" style={{ marginTop: '1.5rem' }}>
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Pay Invoice</h1>
          <p className="portal-subtitle">{invoice.project.title}</p>
        </div>
        <Link href="/mypage/invoices" className="btn btn-ghost btn-sm">
          ← Back
        </Link>
      </div>

      <div className="portal-card" style={{ maxWidth: 540 }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--muted)' }}>Invoice #</span>
            <span style={{ fontWeight: 600 }}>{invoice.number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--muted)' }}>Stage</span>
            <span>{invoice.stage}</span>
          </div>
          {invoice.description && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--muted)' }}>Description</span>
              <span style={{ maxWidth: 260, textAlign: 'right', fontSize: '0.88rem' }}>{invoice.description}</span>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>Total (CAD)</span>
            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--copper-deep)' }}>
              {formatCAD(invoice.total)}
            </span>
          </div>
        </div>

        <StripeCheckoutButton invoiceId={invoice.id} amount={invoice.total} invoiceNumber={invoice.number} />

        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '1rem', textAlign: 'center' }}>
          Secured by Stripe. Accepts Visa, Mastercard, Amex, Apple Pay, Google Pay.
          <br />
          HST #: {invoice.project.user.email}
        </p>
      </div>
    </div>
  );
}
