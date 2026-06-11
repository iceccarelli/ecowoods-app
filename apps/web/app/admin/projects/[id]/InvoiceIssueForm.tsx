'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { issueInvoice, markInvoicePaid, resendInvoice, reissueInvoice } from '@/lib/actions/invoices';
import type { Invoice } from '@prisma/client';
import { format } from 'date-fns';

function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function computeTotal(subtotal: number, discountPct: number, surchargePct: number, taxRate: number) {
  const afterDiscount = subtotal * (1 - discountPct / 100);
  const afterSurcharge = afterDiscount * (1 + surchargePct / 100);
  return afterSurcharge * (1 + taxRate / 100);
}

export default function InvoiceIssueForm({
  invoice,
}: {
  invoice: Invoice;
  projectId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [paidNotes, setPaidNotes] = useState('');
  const [paidRef, setPaidRef] = useState('');
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [showReissueForm, setShowReissueForm] = useState(false);

  const [reissueForm, setReissueForm] = useState({
    subtotal: String(invoice.subtotal),
    discountPct: String(invoice.discountPct),
    surchargePct: String(invoice.surchargePct),
    taxRate: String(invoice.taxRate),
    description: invoice.description ?? '',
    dueDate: invoice.dueDate ? format(new Date(invoice.dueDate), 'yyyy-MM-dd') : '',
  });

  const setField = (key: keyof typeof reissueForm, val: string) =>
    setReissueForm((f) => ({ ...f, [key]: val }));

  const previewTotal = computeTotal(
    parseFloat(reissueForm.subtotal) || 0,
    parseFloat(reissueForm.discountPct) || 0,
    parseFloat(reissueForm.surchargePct) || 0,
    parseFloat(reissueForm.taxRate) || 0,
  );

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

  const handleResend = async () => {
    setLoading(true);
    try {
      await resendInvoice(invoice.id);
      toast.success(`Invoice #${invoice.number} re-sent to customer.`);
    } catch {
      toast.error('Failed to resend invoice.');
    } finally {
      setLoading(false);
    }
  };

  const handleReissue = async () => {
    if (!reissueForm.subtotal || parseFloat(reissueForm.subtotal) <= 0) {
      toast.error('Subtotal must be greater than 0.');
      return;
    }
    setLoading(true);
    try {
      await reissueInvoice(invoice.id, {
        subtotal: parseFloat(reissueForm.subtotal),
        discountPct: parseFloat(reissueForm.discountPct) || 0,
        surchargePct: parseFloat(reissueForm.surchargePct) || 0,
        taxRate: parseFloat(reissueForm.taxRate) || 13,
        description: reissueForm.description || undefined,
        dueDate: reissueForm.dueDate || null,
      });
      toast.success(`Invoice #${invoice.number} updated, PDF regenerated, and re-sent.`);
      setShowReissueForm(false);
      router.refresh();
    } catch {
      toast.error('Failed to reissue invoice.');
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

  if (invoice.status === 'PAID' || invoice.status === 'VOID') {
    return (
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>—</span>
        {invoice.pdfUrl && (
          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', position: 'relative' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {/* View PDF */}
        {invoice.pdfUrl && (
          <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            PDF
          </a>
        )}

        {/* DRAFT: Issue */}
        {invoice.status === 'DRAFT' && (
          <button onClick={handleIssue} disabled={loading} className="btn btn-copper btn-sm">
            {loading ? '…' : '📤 Issue'}
          </button>
        )}

        {/* SENT / OVERDUE: Resend + Edit & Reissue + Mark Paid */}
        {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
          <>
            <button onClick={handleResend} disabled={loading} className="btn btn-ghost btn-sm" title="Re-send same invoice email">
              {loading ? '…' : '📨 Resend'}
            </button>
            <button
              onClick={() => { setShowReissueForm((v) => !v); setShowPaidForm(false); }}
              className="btn btn-ghost btn-sm"
              title="Edit amounts/dates and re-issue"
            >
              ✏️ Edit & Reissue
            </button>
            <button
              onClick={() => { setShowPaidForm((v) => !v); setShowReissueForm(false); }}
              className="btn btn-ghost btn-sm"
            >
              ✅ Mark Paid
            </button>
          </>
        )}
      </div>

      {/* Mark Paid panel */}
      {showPaidForm && (
        <div style={{ position: 'absolute', zIndex: 50, right: 0, top: '2rem', background: 'white', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '1rem', width: 280, boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.75rem' }}>Mark as Paid</div>
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

      {/* Edit & Reissue panel */}
      {showReissueForm && (
        <div style={{ position: 'absolute', zIndex: 50, right: 0, top: '2rem', background: 'white', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', width: 320, boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.75rem' }}>Edit & Reissue Invoice #{invoice.number}</div>

          <div className="field-row">
            <div className="field">
              <label>Subtotal (CAD)</label>
              <input type="number" value={reissueForm.subtotal} onChange={(e) => setField('subtotal', e.target.value)} />
            </div>
            <div className="field">
              <label>Tax %</label>
              <input type="number" value={reissueForm.taxRate} onChange={(e) => setField('taxRate', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Discount %</label>
              <input type="number" value={reissueForm.discountPct} onChange={(e) => setField('discountPct', e.target.value)} min="0" max="100" />
            </div>
            <div className="field">
              <label>Surcharge %</label>
              <input type="number" value={reissueForm.surchargePct} onChange={(e) => setField('surchargePct', e.target.value)} min="0" />
            </div>
          </div>

          {/* Live total */}
          <div style={{ padding: '0.5rem 0.75rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', marginBottom: '0.75rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>New Total</span>
            <span>{formatCAD(previewTotal)}</span>
          </div>

          <div className="field">
            <label>Due Date</label>
            <input type="date" value={reissueForm.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea rows={2} value={reissueForm.description} onChange={(e) => setField('description', e.target.value)} placeholder="Visible to customer…" style={{ resize: 'vertical' }} />
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
            PDF will be regenerated and a new email will be sent to the customer.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleReissue} disabled={loading} className="btn btn-copper btn-sm">
              {loading ? '…' : '📤 Save & Resend'}
            </button>
            <button onClick={() => setShowReissueForm(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
