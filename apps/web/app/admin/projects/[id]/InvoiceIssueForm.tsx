'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { issueInvoice, markInvoicePaid } from '@/lib/actions/invoices';
import type { Invoice } from '@prisma/client';

export default function InvoiceIssueForm({
  invoice,
  projectId,
}: {
  invoice: Invoice;
  projectId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paidNotes, setPaidNotes] = useState('');
  const [paidRef, setPaidRef] = useState('');
  const [showPaidForm, setShowPaidForm] = useState(false);

  const handleIssue = async () => {
    setLoading(true);
    try {
      await issueInvoice(invoice.id);
      toast.success(`Invoice #${invoice.number} issued and emailed to customer.`);
      router.refresh();
    } catch {
      toast.error('Failed to issue invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    setLoading(true);
    try {
      await markInvoicePaid(invoice.id, 'BANK_TRANSFER', paidRef, paidNotes);
      toast.success(`Invoice #${invoice.number} marked as paid.`);
      setShowPaidForm(false);
      router.refresh();
    } catch {
      toast.error('Failed to mark as paid.');
    } finally {
      setLoading(false);
    }
  };

  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    return <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {invoice.status === 'DRAFT' && (
        <button onClick={handleIssue} disabled={loading} className="btn btn-copper btn-sm">
          {loading ? '…' : '📤 Issue'}
        </button>
      )}
      {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
        <>
          <button onClick={() => setShowPaidForm(!showPaidForm)} className="btn btn-ghost btn-sm">
            ✅ Mark Paid
          </button>
          {showPaidForm && (
            <div style={{ position: 'absolute', zIndex: 50, right: 0, background: 'white', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '1rem', width: 280, boxShadow: 'var(--shadow-lg)' }}>
              <div className="field">
                <label>Bank Reference / E-Transfer #</label>
                <input value={paidRef} onChange={(e) => setPaidRef(e.target.value)} placeholder="Optional" />
              </div>
              <div className="field">
                <label>Admin Notes</label>
                <input value={paidNotes} onChange={(e) => setPaidNotes(e.target.value)} placeholder="e.g. Received $5,000" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleMarkPaid} disabled={loading} className="btn btn-copper btn-sm">
                  {loading ? '…' : 'Confirm Paid'}
                </button>
                <button onClick={() => setShowPaidForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
