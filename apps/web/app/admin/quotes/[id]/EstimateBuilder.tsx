'use client';

/**
 * EstimateBuilder — Admin UI for building the formal quote/estimate (견적서).
 * Step 2: Enter line items + pricing
 * Step 3: Generate PDF → Send to customer
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveEstimate, sendEstimateEmail, type EstimateLineItem } from '@/lib/actions/quotes';
import { format } from 'date-fns';

const EMPTY_LINE: EstimateLineItem = { description: '', qty: 1, unit: 'sq ft', unitPrice: 0, amount: 0 };
const UNIT_OPTIONS = ['sq ft', 'lm ft', 'hrs', 'unit', 'lot'];

function cad(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

interface Props {
  quoteId: string;
  existingLineItems: EstimateLineItem[] | null;
  existingAmount: number | null | undefined;
  existingTaxRate: number;
  existingNotes: string;
  quotePdfUrl: string | null | undefined;
  quoteIssuedAt: Date | null | undefined;
  step: number;
}

export default function EstimateBuilder({
  quoteId, existingLineItems, existingAmount, existingTaxRate,
  existingNotes, quotePdfUrl, quoteIssuedAt, step,
}: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<EstimateLineItem[]>(
    Array.isArray(existingLineItems) && existingLineItems.length > 0
      ? existingLineItems
      : [{ ...EMPTY_LINE }]
  );
  const [taxRate, setTaxRate] = useState(existingTaxRate);
  const [notes, setNotes] = useState(existingNotes);
  const [validDays, setValidDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [genPdf, setGenPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [isEditing, setIsEditing] = useState(!existingAmount);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxAmt = subtotal * taxRate / 100;
  const total = subtotal + taxAmt;

  const updateLine = (i: number, field: keyof EstimateLineItem, val: string | number) => {
    setLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === 'description' || field === 'unit' ? val : Number(val) };
      // Auto-calc amount
      if (field === 'qty' || field === 'unitPrice') {
        const qty = field === 'qty' ? Number(val) : next[i].qty;
        const price = field === 'unitPrice' ? Number(val) : next[i].unitPrice;
        next[i].amount = Math.round(qty * price * 100) / 100;
      }
      return next;
    });
  };

  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (lines.every(l => !l.description)) {
      toast.error('Add at least one line item.');
      return;
    }
    setSaving(true);
    try {
      await saveEstimate(quoteId, { quotedAmount: subtotal, quoteTaxRate: taxRate, quoteLineItems: lines, quoteNotes: notes, validDays });
      toast.success('Estimate saved.');
      setIsEditing(false);
      router.refresh();
    } catch { toast.error('Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleGeneratePdf = async () => {
    setGenPdf(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/pdf`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Estimate PDF generated!');
      window.open(data.url, '_blank');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF generation failed.'); }
    finally { setGenPdf(false); }
  };

  const handleSendEmail = async () => {
    if (!confirm(`Send the estimate PDF to the customer's email?`)) return;
    setSending(true);
    try {
      await sendEstimateEmail(quoteId);
      toast.success('Estimate emailed to customer! Status updated to QUOTED.');
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Email send failed.'); }
    finally { setSending(false); }
  };

  return (
    <div className="portal-card" style={{ borderColor: step === 2 || step === 3 ? 'var(--copper)' : undefined, borderWidth: step === 2 || step === 3 ? 2 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
          📋 Estimate (견적서)
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {quotePdfUrl && !quotePdfUrl.startsWith('data:') && (
            <a href={quotePdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
              📄 View PDF
            </a>
          )}
          {!isEditing && existingAmount && (
            <button onClick={() => setIsEditing(true)} className="btn btn-ghost btn-sm">
              ✏️ Edit
            </button>
          )}
        </div>
      </div>

      {/* If estimate was already sent */}
      {quoteIssuedAt && !isEditing && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(74,124,89,0.08)', border: '1px solid rgba(74,124,89,0.25)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          ✅ Estimate sent to customer on <strong>{format(quoteIssuedAt, 'MMMM d, yyyy')}</strong>
          {existingAmount && <> · Total: <strong>{cad(existingAmount * (1 + taxRate / 100))}</strong></>}
        </div>
      )}

      {/* Summary when not editing */}
      {!isEditing && existingAmount ? (
        <div>
          <table className="portal-table" style={{ marginBottom: '1rem' }}>
            <thead>
              <tr>
                <th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.description}</td>
                  <td>{l.qty}</td>
                  <td>{l.unit}</td>
                  <td>{cad(l.unitPrice)}</td>
                  <td style={{ fontWeight: 600 }}>{cad(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', fontSize: '0.9rem', lineHeight: 1.8 }}>
            <div>Subtotal: {cad(subtotal)}</div>
            <div>HST ({taxRate}%): {cad(taxAmt)}</div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--copper-deep)' }}>
              Total: {cad(total)}
            </div>
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div>
          {/* Line items */}
          <div style={{ marginBottom: '1rem', overflowX: 'auto' }}>
            <div style={{ minWidth: 620 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 110px 110px 32px', gap: '0.35rem', marginBottom: '0.35rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                <span>Description</span><span>Qty</span><span>Unit</span><span>Unit Price</span><span>Amount</span><span></span>
              </div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 110px 110px 32px', gap: '0.35rem', marginBottom: '0.35rem' }}>
                  <input
                    placeholder="e.g. Hardwood installation – white oak"
                    value={line.description}
                    onChange={e => updateLine(i, 'description', e.target.value)}
                    style={{ fontSize: '0.85rem', minWidth: 0 }}
                  />
                  <input type="number" value={line.qty} min={0} onChange={e => updateLine(i, 'qty', e.target.value)} style={{ fontSize: '0.85rem', minWidth: 0 }} />
                  <select value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)} style={{ fontSize: '0.85rem', minWidth: 0 }}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" value={line.unitPrice} min={0} step="0.01" onChange={e => updateLine(i, 'unitPrice', e.target.value)} style={{ fontSize: '0.85rem', minWidth: 0 }} />
                  <input type="number" value={line.amount} min={0} step="0.01" onChange={e => updateLine(i, 'amount', e.target.value)} style={{ fontSize: '0.85rem', minWidth: 0, background: 'var(--cream-100)' }} readOnly />
                  <button onClick={() => removeLine(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1.1rem', padding: 0, lineHeight: 1, alignSelf: 'center' }}>×</button>
                </div>
              ))}
              <button onClick={addLine} className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                + Add line item
              </button>
            </div>
          </div>

          {/* Tax + totals */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div className="field">
              <label>Tax Rate (HST %)</label>
              <input type="number" value={taxRate} min={0} max={20} onChange={e => setTaxRate(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Quote Valid For (days)</label>
              <input type="number" value={validDays} min={1} max={90} onChange={e => setValidDays(Number(e.target.value))} />
            </div>
          </div>

          {/* Totals preview */}
          <div style={{ padding: '0.75rem 1rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.88rem' }}>
            <div><div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Subtotal</div><div style={{ fontWeight: 700 }}>{cad(subtotal)}</div></div>
            <div><div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>HST ({taxRate}%)</div><div style={{ fontWeight: 700 }}>{cad(taxAmt)}</div></div>
            <div><div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>Total</div><div style={{ fontWeight: 800, color: 'var(--copper-deep)', fontSize: '1.05rem' }}>{cad(total)}</div></div>
          </div>

          {/* Notes */}
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Notes for customer (visible on PDF)</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Price includes materials, labour, dust-free sanding, and 3 coats finish. Subfloor prep billed separately if required." />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn btn-copper btn-sm">
            {saving ? 'Saving…' : '💾 Save Estimate'}
          </button>
        </div>
      )}

      {/* PDF + Send buttons — show after estimate is saved */}
      {existingAmount && !isEditing && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
          {/* Warn if old data-URL PDF exists — needs regeneration */}
          {quotePdfUrl?.startsWith('data:') && (
            <div style={{ fontSize: '0.82rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', marginBottom: '0.75rem' }}>
              ⚠️ Old PDF stored as data URL — please click <strong>Generate PDF</strong> to create a shareable link.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={handleGeneratePdf} disabled={genPdf} className="btn btn-ghost btn-sm">
              {genPdf ? 'Generating…' : quotePdfUrl && !quotePdfUrl.startsWith('data:') ? '🔄 Regenerate PDF' : '📄 Generate PDF'}
            </button>
            {quotePdfUrl && !quotePdfUrl.startsWith('data:') && (
              <button onClick={handleSendEmail} disabled={sending} className="btn btn-copper btn-sm">
                {sending ? 'Sending…' : '📧 Send Estimate to Customer'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
