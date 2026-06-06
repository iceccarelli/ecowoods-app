'use client';

/**
 * Stripe Checkout button.
 * Calls /api/invoices/[id]/checkout to create a Stripe Checkout session,
 * then redirects the browser to the Stripe-hosted payment page.
 *
 * Stripe 체크아웃 버튼: 서버에서 세션 생성 후 Stripe 호스팅 페이지로 리디렉션
 */

import { useState } from 'react';
import { toast } from 'sonner';

function formatCAD(amount: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export default function StripeCheckoutButton({
  invoiceId,
  amount,
  invoiceNumber,
}: {
  invoiceId: string;
  amount: number;
  invoiceNumber: string;
}) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/checkout`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="btn btn-copper btn-lg"
      style={{ width: '100%' }}
    >
      {loading ? 'Redirecting to Stripe…' : `Pay ${formatCAD(amount)} — Card / Apple Pay / Google Pay`}
    </button>
  );
}
