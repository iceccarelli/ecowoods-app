'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitLead } from '../shared/api/client';
import { leadSchema, type LeadFormData } from '../shared/types/lead';
import { Icon } from './icons'; // Assuming you extract icons or import from page

interface QuoteFormProps {
  onSuccess?: () => void;
  className?: string;
}

export default function QuoteForm({ onSuccess, className = '' }: QuoteFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      source: 'website',
      service: 'installation',
      timeline: 'flexible',
    },
  });

  const leadMutation = useMutation({
    mutationFn: (data: LeadFormData) => submitLead(data, 'website'),
    onSuccess: (response) => {
      toast.success("Estimate request received!", {
        description: "A senior estimator will contact you within 1 business day.",
        action: {
          label: "Track in App",
          onClick: () => window.open('https://app.ecowoods.ca', '_blank'),
        },
      });
      reset();
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error("Submission failed", {
        description: error.message || "Please try again or call (416) 555-WOOD",
      });
    },
  });

  const onSubmit = (data: LeadFormData) => {
    leadMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`contact-form ${className}`} noValidate>
      <h3 style={{ marginBottom: '0.5rem' }}>Request a free estimate</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '1.75rem' }}>
        Takes 60 seconds. No pressure, no spam, no obligation.
      </p>

      <div className="field-row">
        <div className="field">
          <label htmlFor="f-name">Full Name *</label>
          <input
            id="f-name"
            {...register('name')}
            placeholder="Jane Doe"
            className={errors.name ? 'field-error' : ''}
          />
          {errors.name && <p className="error-message">{errors.name.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-phone">Phone *</label>
          <input
            id="f-phone"
            {...register('phone')}
            placeholder="(416) 555-0123"
            className={errors.phone ? 'field-error' : ''}
          />
          {errors.phone && <p className="error-message">{errors.phone.message}</p>}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="f-email">Email *</label>
          <input
            id="f-email"
            type="email"
            {...register('email')}
            placeholder="jane@example.com"
            className={errors.email ? 'field-error' : ''}
          />
          {errors.email && <p className="error-message">{errors.email.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="f-postal">Postal Code *</label>
          <input
            id="f-postal"
            {...register('postal')}
            placeholder="M5V 3A8"
            maxLength={7}
            className={errors.postal ? 'field-error' : ''}
          />
          {errors.postal && <p className="error-message">{errors.postal.message}</p>}
        </div>
      </div>

      <div className="field">
        <label>Service Needed</label>
        <div className="field-radio-group">
          {[
            { id: 'installation', label: 'New Install' },
            { id: 'refinishing', label: 'Refinishing' },
            { id: 'sanding', label: 'Dust-Free Sanding' },
            { id: 'stairs', label: 'Stairs' },
            { id: 'inlays', label: 'Custom Inlays' },
            { id: 'commercial', label: 'Commercial' },
          ].map((s) => (
            <label
              key={s.id}
              className={`field-radio ${watch('service') === s.id ? 'checked' : ''}`}
            >
              <input
                type="radio"
                value={s.id}
                {...register('service')}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="f-sqft">Approx. Square Footage</label>
          <input
            id="f-sqft"
            type="number"
            {...register('sqft', { valueAsNumber: true })}
            placeholder="e.g. 1200"
          />
        </div>
        <div className="field">
          <label htmlFor="f-timeline">Timeline</label>
          <select id="f-timeline" {...register('timeline')}>
            <option value="asap">As soon as possible</option>
            <option value="1-2_weeks">1–2 weeks</option>
            <option value="1_month">Within 1 month</option>
            <option value="flexible">Just exploring</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="f-message">Project Details (Optional)</label>
        <textarea
          id="f-message"
          {...register('message')}
          placeholder="Tell us about your home, current floors, and what you're hoping to achieve…"
        />
      </div>

      <button
        type="submit"
        className="btn btn-copper btn-lg"
        style={{ width: '100%' }}
        disabled={isSubmitting || leadMutation.isPending}
      >
        {isSubmitting || leadMutation.isPending ? 'Sending…' : 'Request my free estimate'}
        {!isSubmitting && !leadMutation.isPending && <span className="btn-arrow">→</span>}
      </button>

      <p className="form-disclosure">
        By submitting, you agree to be contacted by Ecowoods about your project. We never share your information.
      </p>
    </form>
  );
}
