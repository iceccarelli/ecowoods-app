'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { sendContractToCustomer } from '@/lib/actions/projects';

interface Props {
  projectId: string;
  contractPdfUrl?: string | null;
}

export default function GenerateContractButton({ projectId, contractPdfUrl: initialUrl }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(initialUrl);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/contracts/${projectId}/pdf`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setPdfUrl(data.url);
      toast.success('Contract PDF generated.');
      window.open(data.url, '_blank');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate contract.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!confirm(`Send the contract PDF to the customer's email?`)) return;
    setSending(true);
    try {
      await sendContractToCustomer(projectId);
      toast.success('Contract sent to customer!');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send contract.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button onClick={handleGenerate} disabled={generating} className="btn btn-ghost btn-sm">
        {generating ? 'Generating…' : pdfUrl ? '🔄 Regenerate Contract PDF' : '📝 Generate Contract PDF'}
      </button>

      {pdfUrl && !pdfUrl.startsWith('data:') && (
        <>
          <a href={`/docs/contract/${projectId}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            🔗 Public Link
          </a>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
            📄 View PDF
          </a>
          <button onClick={handleSend} disabled={sending} className="btn btn-copper btn-sm">
            {sending ? 'Sending…' : '📧 Send to Customer'}
          </button>
        </>
      )}
    </>
  );
}
