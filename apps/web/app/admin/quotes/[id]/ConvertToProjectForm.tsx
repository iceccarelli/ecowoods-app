'use client';

/**
 * ConvertToProjectForm — Step 4.
 * Customer approved the estimate → create the formal Project + Contract.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { convertQuoteToProject } from '@/lib/actions/quotes';

interface Props {
  quoteId: string;
  customers: { id: string; name: string | null; email: string }[];
  defaultTitle: string;
  defaultUserId: string;
  quotedAmount: number | null | undefined;
  defaultTaxRate: number;
  defaultDepositPct: number;
  defaultMidpointPct: number;
  defaultFinalPct: number;
}

export default function ConvertToProjectForm({
  quoteId, customers, defaultTitle, defaultUserId,
  quotedAmount, defaultTaxRate, defaultDepositPct, defaultMidpointPct, defaultFinalPct,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: defaultTitle,
    userId: defaultUserId || (customers[0]?.id ?? ''),
    contractValue: String(quotedAmount ?? ''),
    depositPct: String(defaultDepositPct),
    midpointPct: String(defaultMidpointPct),
    finalPct: String(defaultFinalPct),
    taxRate: String(defaultTaxRate),
    startDate: '',
  });

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));
  const pctSum = Number(form.depositPct) + Number(form.midpointPct) + Number(form.finalPct);

  const handleConvert = async () => {
    if (!form.contractValue || !form.userId) {
      toast.error('Contract value and customer are required.');
      return;
    }
    if (Math.abs(pctSum - 100) > 0.1) {
      toast.error(`Invoice percentages must sum to 100% (currently ${pctSum}%).`);
      return;
    }
    setLoading(true);
    try {
      const result = await convertQuoteToProject(quoteId, {
        userId: form.userId,
        title: form.title,
        contractValue: parseFloat(form.contractValue),
        depositPct: parseFloat(form.depositPct),
        midpointPct: parseFloat(form.midpointPct),
        finalPct: parseFloat(form.finalPct),
        taxRate: parseFloat(form.taxRate),
        startDate: form.startDate || undefined,
      });
      toast.success('Quote converted to project! Next: generate the contract PDF.');
      router.push(`/admin/projects/${result.projectId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-card" style={{ borderColor: 'var(--copper)', borderWidth: 2 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--copper-deep)' }}>
        ✅ Convert to Project
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1.25rem' }}>
        Customer approved the estimate. Fill in project details to create the contract.
      </p>

      <div className="field">
        <label>Project Title *</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} />
      </div>

      <div className="field">
        <label>Assign to Customer *</label>
        <select value={form.userId} onChange={e => set('userId', e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name ?? c.email} ({c.email})</option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Contract Value (CAD, excl. tax) *</label>
          <input
            type="number"
            placeholder="e.g. 18500"
            value={form.contractValue}
            onChange={e => set('contractValue', e.target.value)}
          />
          {quotedAmount && (
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
              From estimate: ${quotedAmount.toFixed(2)}
            </p>
          )}
        </div>
        <div className="field">
          <label>Tax Rate %</label>
          <input type="number" value={form.taxRate} onChange={e => set('taxRate', e.target.value)} />
        </div>
      </div>

      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '0.5rem' }}>
        Invoice Staging (must sum to 100%)
      </div>
      <div className="field-row">
        {[['depositPct','Deposit %'],['midpointPct','Midpoint %'],['finalPct','Final %']].map(([key, label]) => (
          <div key={key} className="field">
            <label>{label}</label>
            <input type="number" min={0} max={100} value={form[key as keyof typeof form]} onChange={e => set(key as keyof typeof form, e.target.value)} />
          </div>
        ))}
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', background: Math.abs(pctSum - 100) < 0.1 ? 'rgba(74,124,89,0.1)' : 'rgba(176,72,72,0.1)', fontWeight: 700, color: Math.abs(pctSum - 100) < 0.1 ? 'var(--success)' : 'var(--danger)', fontSize: '0.88rem' }}>
            {pctSum}%
          </div>
        </div>
      </div>

      <div className="field">
        <label>Planned Start Date</label>
        <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
      </div>

      <button onClick={handleConvert} disabled={loading} className="btn btn-copper btn-sm" style={{ width: '100%' }}>
        {loading ? 'Creating project…' : '🏗 Create Project & Contract'}
      </button>
    </div>
  );
}
