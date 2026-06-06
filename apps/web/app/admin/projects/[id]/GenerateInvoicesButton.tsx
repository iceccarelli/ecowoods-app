'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { generateStagedInvoices } from '@/lib/actions/invoices';

export default function GenerateInvoicesButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const handleGenerate = async () => {
    if (!confirm('Generate deposit, midpoint, and final invoices based on project staging percentages?')) return;
    setLoading(true);
    try {
      await generateStagedInvoices(projectId);
      toast.success('Staged invoices generated (all in DRAFT status). Review and issue when ready.');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate invoices.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button onClick={handleGenerate} disabled={loading} className="btn btn-ghost btn-sm">
      {loading ? 'Generating…' : '🧾 Generate Staged Invoices'}
    </button>
  );
}
