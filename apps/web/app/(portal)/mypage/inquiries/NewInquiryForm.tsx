'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { submitInquiry } from '@/lib/actions/inquiries';

const schema = z.object({
  subject: z.string().min(3, 'Subject is required').max(200),
  message: z.string().min(10, 'Message must be at least 10 characters').max(3000),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function NewInquiryForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const result = await submitInquiry({
        name: '',  // filled from session on server
        email: '', // filled from session on server
        subject: data.subject,
        message: data.message,
        phone: data.phone,
      });

      if (!result.success) {
        toast.error(result.error ?? 'Failed to send. Please try again.');
        return;
      }

      toast.success('Message sent! Our team will respond within 1 business day.');
      reset();
      router.refresh();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="field">
        <label htmlFor="subject">Subject *</label>
        <input
          id="subject"
          type="text"
          placeholder="e.g. Question about my quote, Change request..."
          className={errors.subject ? 'field-error' : ''}
          {...register('subject')}
        />
        {errors.subject && <p className="error-message">{errors.subject.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          rows={4}
          placeholder="Type your message here…"
          className={errors.message ? 'field-error' : ''}
          {...register('message')}
        />
        {errors.message && <p className="error-message">{errors.message.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="phone">Phone (optional — for faster response)</label>
        <input
          id="phone"
          type="tel"
          placeholder="(416) 555-0123"
          {...register('phone')}
        />
      </div>

      <button
        type="submit"
        className="btn btn-copper btn-sm"
        disabled={submitting}
      >
        {submitting ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
