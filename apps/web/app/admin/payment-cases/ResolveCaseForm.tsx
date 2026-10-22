'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { resolvePaymentCase } from '@/lib/actions/payment-cases';
import type { PaymentCaseResolution } from '@prisma/client';

const OPTIONS: Array<{ value: PaymentCaseResolution; label: string }> = [
  { value: 'REFUNDED_MANUALLY', label: 'Refund issued manually in Stripe' },
  { value: 'INVOICE_REISSUED', label: 'Invoice re-issued' },
  { value: 'APPLIED_AS_CREDIT', label: 'Applied as credit to the customer' },
  { value: 'CREDITS_ADJUSTED_SEPARATELY', label: 'Renovation Credits handled separately' },
  { value: 'DISPUTE_RESPONDED', label: 'Dispute evidence submitted in Stripe' },
  { value: 'NO_ACTION_REQUIRED', label: 'No action required' },
  { value: 'OTHER', label: 'Other (explain in the note)' },
];

/** Records a decision only. It does not refund, reissue or change any balance. */
export default function ResolveCaseForm({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [resolution, setResolution] = useState<PaymentCaseResolution>('REFUNDED_MANUALLY');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await resolvePaymentCase(caseId, resolution, note);
      toast.success('Decision recorded.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the decision.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
      <select aria-label="Decision" value={resolution} onChange={(e) => setResolution(e.target.value as PaymentCaseResolution)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <textarea aria-label="Resolution note (required)" required minLength={5} rows={2} maxLength={2000} placeholder="Required: what was done, and where (e.g. Stripe refund id)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="button" onClick={submit} disabled={loading || note.trim().length < 5} className="btn btn-copper btn-sm">
        {loading ? 'Recording…' : 'Record decision'}
      </button>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>Recording a decision does not move money or credits.</p>
    </div>
  );
}
