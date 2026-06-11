'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateQuoteStatus, convertQuoteToProject } from '@/lib/actions/quotes';
import type { QuoteRequest, User } from '@prisma/client';

type Props = {
  quote: QuoteRequest & { user?: User | null };
  customers: { id: string; name: string | null; email: string }[];
};

export default function QuoteActions({ quote, customers }: Props) {
  const router = useRouter();
  const [statusNotes, setStatusNotes] = useState(quote.adminNotes ?? '');
  const [status, setStatus] = useState(quote.status);
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(false);

  // Convert form state
  const [convertData, setConvertData] = useState({
    title: `${quote.service ?? 'Project'} — ${quote.city ?? ''}${quote.province ? `, ${quote.province}` : ''}`,
    userId: quote.userId ?? customers[0]?.id ?? '',
    contractValue: '',
    depositPct: '30',
    midpointPct: '40',
    finalPct: '30',
    taxRate: '13',
    startDate: '',
  });

  const handleStatusUpdate = async () => {
    setLoading(true);
    try {
      await updateQuoteStatus(quote.id, status, statusNotes);
      toast.success('Quote status updated.');
      router.refresh();
    } catch {
      toast.error('Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (!convertData.contractValue || !convertData.userId) {
      toast.error('Contract value and customer are required.');
      return;
    }
    setConverting(true);
    try {
      const result = await convertQuoteToProject(quote.id, {
        userId: convertData.userId,
        title: convertData.title,
        contractValue: parseFloat(convertData.contractValue),
        depositPct: parseFloat(convertData.depositPct),
        midpointPct: parseFloat(convertData.midpointPct),
        finalPct: parseFloat(convertData.finalPct),
        taxRate: parseFloat(convertData.taxRate),
        startDate: convertData.startDate || undefined,
      });
      toast.success('Quote converted to project!');
      router.push(`/admin/projects/${result.projectId}`);
    } catch {
      toast.error('Failed to convert quote.');
    } finally {
      setConverting(false);
    }
  };

  if (quote.status === 'ACCEPTED') return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Status update */}
      <div className="portal-card">
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Update Status</h2>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as never)}>
            <option value="PENDING">Pending</option>
            <option value="QUOTED">Quoted</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div className="field">
          <label>Admin Notes</label>
          <textarea
            rows={3}
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            placeholder="Internal notes about this lead..."
          />
        </div>
        <button onClick={handleStatusUpdate} disabled={loading} className="btn btn-ghost btn-sm">
          {loading ? 'Saving…' : 'Update Status'}
        </button>
      </div>

      {/* Convert to project */}
      {quote.status !== 'REJECTED' && (
        <div className="portal-card" style={{ borderColor: 'var(--copper)', borderWidth: 2 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--copper-deep)' }}>
            Convert to Project
          </h2>

          <div className="field">
            <label>Project Title *</label>
            <input value={convertData.title} onChange={(e) => setConvertData({ ...convertData, title: e.target.value })} />
          </div>

          <div className="field">
            <label>Assign to Customer *</label>
            <select value={convertData.userId} onChange={(e) => setConvertData({ ...convertData, userId: e.target.value })}>
              <option value="">— Select customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name ?? c.email} ({c.email})</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Contract Value (CAD, excl. tax) *</label>
            <input
              type="number"
              placeholder="e.g. 18500"
              value={convertData.contractValue}
              onChange={(e) => setConvertData({ ...convertData, contractValue: e.target.value })}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Deposit %</label>
              <input type="number" value={convertData.depositPct} onChange={(e) => setConvertData({ ...convertData, depositPct: e.target.value })} />
            </div>
            <div className="field">
              <label>Midpoint %</label>
              <input type="number" value={convertData.midpointPct} onChange={(e) => setConvertData({ ...convertData, midpointPct: e.target.value })} />
            </div>
            <div className="field">
              <label>Final %</label>
              <input type="number" value={convertData.finalPct} onChange={(e) => setConvertData({ ...convertData, finalPct: e.target.value })} />
            </div>
            <div className="field">
              <label>Tax Rate %</label>
              <input type="number" value={convertData.taxRate} onChange={(e) => setConvertData({ ...convertData, taxRate: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Planned Start Date</label>
            <input type="date" value={convertData.startDate} onChange={(e) => setConvertData({ ...convertData, startDate: e.target.value })} />
          </div>

          <button onClick={handleConvert} disabled={converting} className="btn btn-copper btn-sm">
            {converting ? 'Converting…' : '🏗 Convert to Project'}
          </button>
        </div>
      )}
    </div>
  );
}
