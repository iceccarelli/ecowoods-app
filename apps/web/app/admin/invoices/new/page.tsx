'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { createInvoice } from '@/lib/actions/invoices';
import type { InvoiceStage } from '@prisma/client';
import { useEffect } from 'react';

// Note: In production, projects list would be fetched from an API route.
// This component uses a simple client-side form.

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProjectId = searchParams.get('projectId') ?? '';

  const [projects, setProjects] = useState<{ id: string; title: string; contractValue: number | null; taxRate: number | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    projectId: preselectedProjectId,
    stage: 'CUSTOM' as InvoiceStage,
    subtotal: '',
    discountPct: '0',
    surchargePct: '0',
    taxRate: '13',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    fetch('/api/admin/projects-list')
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => {});
  }, []);

  const selectedProject = projects.find((p) => p.id === form.projectId);
  const subtotal = parseFloat(form.subtotal) || 0;
  const afterDiscount = subtotal * (1 - parseFloat(form.discountPct) / 100);
  const afterSurcharge = afterDiscount * (1 + parseFloat(form.surchargePct) / 100);
  const total = afterSurcharge * (1 + parseFloat(form.taxRate) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId || !form.subtotal) {
      toast.error('Project and subtotal are required.');
      return;
    }
    setLoading(true);
    try {
      const result = await createInvoice({
        projectId: form.projectId,
        stage: form.stage,
        subtotal: parseFloat(form.subtotal),
        discountPct: parseFloat(form.discountPct),
        surchargePct: parseFloat(form.surchargePct),
        taxRate: parseFloat(form.taxRate),
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
      });
      toast.success('Invoice created as DRAFT. Review and issue from the project page.');
      router.push(form.projectId ? `/admin/projects/${form.projectId}` : '/admin/invoices');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create invoice.');
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof typeof form, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="portal-page">
      <div className="portal-header">
        <div>
          <h1 className="portal-title">Create Invoice</h1>
          <p className="portal-subtitle">Custom invoice — saved as DRAFT until issued</p>
        </div>
        <Link href="/admin/invoices" className="btn btn-ghost btn-sm">← Invoices</Link>
      </div>

      <div className="portal-card" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label>Project *</label>
            <select value={form.projectId} onChange={(e) => {
              const proj = projects.find((p) => p.id === e.target.value);
              set('projectId', e.target.value);
              if (proj?.taxRate) set('taxRate', String(proj.taxRate));
            }}>
              <option value="">— Select project —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Stage *</label>
            <select value={form.stage} onChange={(e) => set('stage', e.target.value as InvoiceStage)}>
              <option value="DEPOSIT">Deposit</option>
              <option value="MIDPOINT">Midpoint</option>
              <option value="FINAL">Final</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Subtotal (CAD, before tax) *</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={form.subtotal}
                onChange={(e) => set('subtotal', e.target.value)}
              />
              {selectedProject?.contractValue && (
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                  Contract value: ${selectedProject.contractValue.toLocaleString()}
                </p>
              )}
            </div>
            <div className="field">
              <label>Tax Rate %</label>
              <input type="number" value={form.taxRate} onChange={(e) => set('taxRate', e.target.value)} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Discount %</label>
              <input type="number" value={form.discountPct} onChange={(e) => set('discountPct', e.target.value)} min="0" max="100" />
            </div>
            <div className="field">
              <label>Surcharge %</label>
              <input type="number" value={form.surchargePct} onChange={(e) => set('surchargePct', e.target.value)} min="0" />
            </div>
          </div>

          {/* Live total preview */}
          {subtotal > 0 && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--cream-100)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {parseFloat(form.discountPct) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                  <span>Discount ({form.discountPct}%)</span><span>−${(subtotal * parseFloat(form.discountPct) / 100).toFixed(2)}</span>
                </div>
              )}
              {parseFloat(form.surchargePct) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                  <span>Surcharge ({form.surchargePct}%)</span><span>+${(afterDiscount * parseFloat(form.surchargePct) / 100).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>HST ({form.taxRate}%)</span><span>${(afterSurcharge * parseFloat(form.taxRate) / 100).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid var(--line)', marginTop: '0.5rem', paddingTop: '0.5rem', fontSize: '1rem' }}>
                <span>Total (CAD)</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Visible to customer on invoice..." />
          </div>

          <div className="field">
            <label>Due Date</label>
            <input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>

          <button type="submit" disabled={loading} className="btn btn-copper btn-lg" style={{ width: '100%' }}>
            {loading ? 'Creating…' : 'Create Invoice (Draft)'}
          </button>
        </form>
      </div>
    </div>
  );
}
