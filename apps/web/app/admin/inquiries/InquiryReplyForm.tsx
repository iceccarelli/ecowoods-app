'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { replyToInquiry, closeInquiry } from '@/lib/actions/inquiries';
import { generateInquiryReply } from '@/lib/ai';

export default function InquiryReplyForm({
  inquiryId,
  customerName,
  subject,
}: {
  inquiryId: string;
  customerName: string;
  subject: string;
}) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handleReply = async () => {
    if (!reply.trim()) {
      toast.error('Please enter a reply.');
      return;
    }
    setLoading(true);
    try {
      await replyToInquiry(inquiryId, reply.trim());
      toast.success('Reply sent to customer.');
      setReply('');
      router.refresh();
    } catch {
      toast.error('Failed to send reply.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!confirm('Mark this inquiry as resolved?')) return;
    setLoading(true);
    try {
      await closeInquiry(inquiryId);
      toast.success('Inquiry marked as resolved.');
      router.refresh();
    } catch {
      toast.error('Failed to close inquiry.');
    } finally {
      setLoading(false);
    }
  };

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const draft = await generateInquiryReply({ subject, customerName });
      setReply(draft);
      toast.success('AI draft generated. Review before sending!');
    } catch {
      toast.error('AI draft unavailable. Write your reply manually.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Your Reply</label>
        <button onClick={handleAiDraft} disabled={aiLoading} className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
          {aiLoading ? '✨ Drafting…' : '✨ AI Draft'}
        </button>
      </div>
      <textarea
        rows={5}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder={`Reply to ${customerName}…`}
        style={{ width: '100%', marginBottom: '0.75rem' }}
      />
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button onClick={handleReply} disabled={loading || !reply.trim()} className="btn btn-copper btn-sm">
          {loading ? 'Sending…' : '📤 Send Reply'}
        </button>
        <button onClick={handleClose} disabled={loading} className="btn btn-ghost btn-sm">
          ✅ Mark Resolved
        </button>
      </div>
    </div>
  );
}
