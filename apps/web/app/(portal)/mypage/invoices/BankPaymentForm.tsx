'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { reportBankPayment } from '@/lib/actions/invoices';

export default function BankPaymentForm({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference.trim()) {
      toast.error('Please enter your e-transfer reference number.');
      return;
    }
    setLoading(true);
    try {
      await reportBankPayment(invoiceId, reference.trim());
      toast.success('Payment reported! Our team will confirm receipt within 1 business day.');
      setReference('');
    } catch {
      toast.error('Something went wrong. Please try again or call us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder={`E-transfer reference for #${invoiceNumber}`}
        style={{ flex: 1, minWidth: 200 }}
      />
      <button
        type="submit"
        className="btn btn-ghost btn-sm"
        disabled={loading}
      >
        {loading ? 'Submitting…' : "I've paid — notify Ecowoods"}
      </button>
    </form>
  );
}
