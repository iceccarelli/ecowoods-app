'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';
import { submitLead } from '@ecowoods/api-client';
import { BUSINESS_NAP } from '@ecowoods/shared/constants';

/* ──────────────────────────────────────────────────────────────
   FLOORFORGE — Autonomous Floor Refinishing · Early Access
   ────────────────────────────────────────────────────────────── */

/* ─────────────────── Validation Schema ─────────────────── */
const floorforgeInterestSchema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(7, 'Please enter a valid phone number'),
  companyName: z.string().min(2, 'Please enter your company or workshop name'),
  role: z.enum(
    ['contractor', 'flooring-specialist', 'general-builder', 'property-manager', 'other'],
    { errorMap: () => ({ message: 'Please select your role' }) }
  ),
  flooringSqFt: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().positive('Please enter a valid square footage').optional()
  ),
  message: z.string().max(2000, 'Message is too long').optional(),
  source: z.literal('floorforge-waitlist').optional(),
});

type FloorforgeInterestData = z.infer<typeof floorforgeInterestSchema>;

/* ─────────────────── Icon Components ─────────────────── */
const Icon = {
  leaf: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 19c0-9 6-15 14-14-1 8-7 14-14 14Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19c5-5 8-7 14-14" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  robot: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" />
      <path d="M9 15h6" strokeLinecap="round" />
      <path d="M6 3v2M18 3v2M5 18v2h14v-2" strokeLinecap="round" />
    </svg>
  ),
  gauge: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v2M12 21v-2M3 12h2M19 12h2" strokeLinecap="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5v14" strokeLinecap="round" />
    </svg>
  ),
};

/* ─────────────────── Component ─────────────────── */
export default function FloorForgePage() {
  const queryClient = useQueryClient();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [interestModalOpen, setInterestModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FloorforgeInterestData>({
    resolver: zodResolver(floorforgeInterestSchema),
    defaultValues: {
      source: 'floorforge-waitlist',
      role: 'contractor',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FloorforgeInterestData) => {
      const res = await fetch('/api/pilot-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          companyName: data.companyName,
          role: data.role,
          flooringSqFt: data.flooringSqFt,
          message: data.message,
          source: 'floorforge-waitlist',
          program: 'floorforge-waitlist',
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to submit interest');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Thank you for your interest!', {
        description:
          'We will contact you within 2 business days to discuss the FloorForge pilot program and next steps.',
      });
      reset();
      setInterestModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (error: Error) => {
      toast.error('Something went wrong', {
        description: error.message || `Please try again or call ${BUSINESS_NAP.phoneDisplay}`,
      });
    },
  });

  const onSubmit = (data: FloorforgeInterestData) => {
    mutation.mutate(data);
  };

  const faqItems = [
    {
      q: 'What is FloorForge exactly?',
      a: 'FloorForge is an autonomous floor refinishing robot designed to handle the labor-intensive parts of hardwood floor sanding and finishing. We are currently in the software + hardware alignment stage, testing with select contractor partners. This is a pilot program, not a finished consumer product.',
    },
    {
      q: 'When will FloorForge be available?',
      a: 'We do not have a commercial availability date. We are actively working on hardware and software integration. Early pilot programs with contractors will run in 2026 and 2027. If you are interested, join the pilot interest form and we will contact you with updates as the program develops.',
    },
    {
      q: 'What problem does FloorForge solve?',
      a: 'Hardwood floor sanding and finishing is labor-intensive, creates significant dust and odor, and requires highly skilled workers. FloorForge is designed to handle the repetitive machine work — sanding passes, dust capture, finish application — freeing contractors to focus on high-value tasks like species selection, custom inlays, and quality inspection.',
    },
    {
      q: "Is this replacing Ecowoods' own services?",
      a: 'No. Ecowoods will continue to offer full-service hardwood flooring, sanding, and finishing to homeowners in the GTA. FloorForge is designed as a tool for the broader flooring industry — contractors, property managers, and flooring specialists who want to improve consistency and reduce labor strain.',
    },
    {
      q: 'How do I join the pilot?',
      a: 'Fill out the pilot interest form on this page. Include your role (contractor, flooring specialist, etc.) and typical annual flooring square footage. We will review all applications and contact candidates within 2 business days with details on the program, timeline, and next steps.',
    },
  ];

  return (
    <>
      {/* ─────────────────── JSON-LD Schema ─────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'FloorForge',
            description:
              'Autonomous floor refinishing technology in early-access pilot stage. Software + hardware alignment stage. Open to contractor pilots.',
            url: 'https://ecowoods.ca/products/floorforge',
            applicationCategory: 'BusinessApplication',
            offers: {
              '@type': 'Offer',
              priceCurrency: 'CAD',
              price: 'Contact for pilot details',
              availability: 'https://schema.org/PreOrder',
              description: 'Early-access pilot program — apply for interest',
            },
            creator: {
              '@type': 'Organization',
              name: 'Ecowoods',
              url: 'https://ecowoods.ca',
            },
            releaseNotes:
              'Currently in software + hardware alignment stage. Pilot program expected 2026-2027. Not a finished commercial product.',
          }),
        }}
      />

      {/* ─────────────────── FAQ Schema ─────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      <div>
        {/* ─────────────────── HERO ─────────────────── */}
        <section className="section ff-hero">
          <div className="shell">
            <div className="ff-measure">
              <div className="ff-hero-eyebrow">
                <span className="eyebrow">
                  Early Access · Pilot Program
                </span>
              </div>
              <h1>
                Meet FloorForge.
                <br />
                <em>The future of floor refinishing.</em>
              </h1>
              <p className="ff-lede">
                An autonomous floor refinishing robot designed to reduce labor strain, eliminate dust and odor, and
                deliver consistency across every job. FloorForge is currently in the software + hardware alignment stage,
                with contractor pilots opening in 2026.
              </p>
              <button
                type="button"
                className="btn btn-copper btn-lg"
                onClick={() => setInterestModalOpen(true)}
              >
                Join the Pilot Interest List
                <span className="btn-arrow">{Icon.arrow}</span>
              </button>

              <p className="ff-note">
                ⚠️ Honest disclosure: FloorForge is <strong>not a finished product</strong>. We are testing hardware and
                software integration. Early pilot participants will help shape the final design. No delivery date or
                pricing promised.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────────────── THE PROBLEM ─────────────────── */}
        <section className="section section--tint">
          <div className="shell">
            <div className="section-head reveal">
              <span className="eyebrow">The Challenge</span>
              <h2>
                Hardwood floors demand precision.
                <br />
                <span className="serif-italic">And skill. And time. And hands.</span>
              </h2>
            </div>

            <div className="ff-grid">
              {[
                {
                  icon: Icon.robot,
                  title: 'Labor Strain',
                  text: 'Sanding and finishing work is physically demanding. Contractors struggle to find and retain skilled workers.',
                },
                {
                  icon: Icon.gauge,
                  title: 'Consistency Drift',
                  text: 'Even master craftsmen vary slightly across jobs. Dust capture, finish thickness, and cure time depend on human judgment.',
                },
                {
                  icon: Icon.leaf,
                  title: 'Dust & Odor',
                  text: 'Modern dust containment helps, but airborne particulate and finish odor still drive homeowners out of their homes for days.',
                },
                {
                  icon: Icon.check,
                  title: 'Time-to-Revenue',
                  text: 'A 1,500 sq ft job takes 5–7 days. Machine work alone accounts for 2–3 of those days. That is labor-intensive capacity.',
                },
              ].map((item, i) => (
                <div key={i} className="ff-card reveal">
                  <div className="ff-card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── THE SOLUTION ─────────────────── */}
        <section
          className="section photo-bg-section section--card"
          style={{
            backgroundColor: 'var(--walnut-950)',
            color: 'var(--cream-50)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div className="shell" style={{ position: 'relative', zIndex: 2 }}>
            <div className="section-head reveal">
              <span className="eyebrow">
                Early-Stage Hardware + Software
              </span>
              <h2>
                FloorForge handles the machine work.
                <br />
                <span className="serif-italic">You handle the craft.</span>
              </h2>
              <p>
                FloorForge is designed to automate the repetitive, physical parts of floor refinishing: sanding passes,
                HEPA dust capture, finish application, and cure monitoring. What it cannot do — what humans will always do
                — is assess wood grain, choose the right species, hand-sand edges, apply custom inlays, and make aesthetic
                judgments in real time.
              </p>
            </div>

            <div className="ff-grid">
              {[
                {
                  icon: Icon.robot,
                  title: 'Sanding Automation',
                  text: 'Programmable sanding profiles: grit progression, pass count, pressure, speed — logged and reproducible across every job.',
                },
                {
                  icon: Icon.leaf,
                  title: '99.7% Dust Capture',
                  text: 'HEPA-sealed sanding head with real-time airflow monitoring. Homeowners stay home. No evacuation.',
                },
                {
                  icon: Icon.gauge,
                  title: 'Finish Application',
                  text: 'Programmable spray coat thickness, cure time monitoring, and recoat prompts. Consistent finish every time.',
                },
                {
                  icon: Icon.check,
                  title: 'Data Logging',
                  text: 'Every pass, grit, pressure, and finish application is logged. Reproducible work. Auditable quality.',
                },
              ].map((item, i) => (
                <div key={i} className="ff-card ff-card--dark reveal">
                  <div className="ff-card-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── STATUS ─────────────────── */}
        <section className="section">
          <div className="shell">
            <div className="section-head reveal">
              <span className="eyebrow">Development Status</span>
              <h2>Where we are today.</h2>
            </div>

            <div className="ff-status-grid">
              <div className="ff-status-card reveal">
                <h3>✓ Complete</h3>
                <ul>
                  <li>• Sanding head mechanical design</li>
                  <li>• HEPA dust capture system</li>
                  <li>• Finish spray nozzle prototype</li>
                  <li>• Software control interface</li>
                  <li>• Data logging architecture</li>
                </ul>
              </div>

              <div className="ff-status-card reveal">
                <h3>🔄 In Progress</h3>
                <ul>
                  <li>• Hardware + software integration</li>
                  <li>• Real-world job testing (partner shops)</li>
                  <li>• Dust capture performance validation</li>
                  <li>• Finish consistency QA</li>
                  <li>• Safety certification prep</li>
                </ul>
              </div>
            </div>

            <p className="ff-callout">
              <strong>Realistic Timeline:</strong> We expect hardware integration to be complete by mid-2026. Pilot programs
              with select contractors will begin in 2026–2027. Commercial availability depends on real-world testing and
              regulatory alignment. No delivery date or pricing is confirmed.
            </p>
          </div>
        </section>

        {/* ─────────────────── WHO WE'RE LOOKING FOR ─────────────────── */}
        <section className="section section--tint">
          <div className="shell">
            <div className="section-head reveal">
              <span className="eyebrow">Pilot Partners</span>
              <h2>
                We are looking for <span className="serif-italic">contractors and flooring specialists</span> who want
                to help shape the future.
              </h2>
              <p>
                Early pilots are for contractors, flooring specialists, property managers, and general builders who
                handle hardwood flooring regularly and want to test new technology. Pilots are not for consumers. If you
                are a homeowner, you can still use Ecowoods' full-service hardwood flooring, sanding, and finishing
                offerings.
              </p>
            </div>

            <div className="ff-grid ff-grid--narrow">
              {[
                {
                  title: 'Contractors',
                  text: 'Hardwood floor installation and refinishing is part of your offering. You want to improve consistency and reduce labor strain.',
                },
                {
                  title: 'Flooring Specialists',
                  text: 'You focus exclusively on hardwood floors. You manage crews, handle client relationships, and care about quality and timeline.',
                },
                {
                  title: 'Property Managers',
                  text: 'You oversee multi-unit or commercial properties with hardwood floors. You need cost-effective refinishing at scale.',
                },
                {
                  title: 'General Builders',
                  text: 'You handle full home or commercial builds and work with flooring subcontractors. You want faster, more reliable turnaround.',
                },
              ].map((item, i) => (
                <div key={i} className="ff-card reveal">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────── FAQ ─────────────────── */}
        <section className="section">
          <div className="shell">
            <div className="section-head reveal">
              <span className="eyebrow">Questions</span>
              <h2>Everything you want to know.</h2>
            </div>

            <div className="faq-list ff-measure reveal" style={{ marginTop: 'var(--space-xl)' }}>
              {faqItems.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className={`faq-item ${isOpen ? 'open' : ''}`}>
                    <button
                      className="faq-trigger"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-content-${i}`}
                    >
                      <span>{item.q}</span>
                      <span className="faq-icon" aria-hidden="true">
                        {Icon.plus}
                      </span>
                    </button>
                    <div className="faq-content" id={`faq-content-${i}`} role="region">
                      <div className="faq-content-inner">{item.a}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─────────────────── BACK TO ECOWOODS ─────────────────── */}
        <section className="section section--tint">
          <div className="shell">
            <div className="ff-outro ff-measure">
            <h2>
              <em>Not a pilot candidate?</em>
            </h2>
            <p>
              Ecowoods offers full-service hardwood flooring installation, refinishing, and dust-free sanding for
              homeowners across the GTA. We are not going anywhere.
            </p>
            <div className="ff-actions">
              <a href="/#quote" className="btn btn-copper btn-lg">
                Get Your Free Estimate
              </a>
              <a href="/technical-library" className="btn btn-ghost btn-lg">
                Browse Technical Library
              </a>
            </div>
            </div>
          </div>
        </section>

        {/* ─────────────────── CTA ─────────────────── */}
        <section
          className="section photo-bg-section section--card"
          style={{
            backgroundColor: 'var(--walnut-950)',
            color: 'var(--cream-50)',
          }}
        >
          <div className="shell ff-cta">
            <h2>
              Ready to join the <span className="serif-italic">FloorForge pilot?</span>
            </h2>
            <p>
              Share your company info and use case. We will review applications and contact you within 2 business days
              with pilot details and next steps.
            </p>
            <button
              type="button"
              className="btn btn-copper btn-lg"
              onClick={() => setInterestModalOpen(true)}
            >
              Join the Pilot Interest List
              <span className="btn-arrow">{Icon.arrow}</span>
            </button>
          </div>
        </section>
      </div>

      {/* ─────────────────── PILOT INTEREST MODAL ─────────────────── */}
      {interestModalOpen && (
        <div
          className="estimate-modal-overlay"
          onClick={() => setInterestModalOpen(false)}
        >
          <div
            className="estimate-modal"
            role="dialog"
            aria-modal="true"
            aria-label="FloorForge Pilot Interest Form"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="estimate-modal-close"
              aria-label="Close"
              onClick={() => setInterestModalOpen(false)}
            >
              ×
            </button>
            <div className="contact-form">
              <form onSubmit={handleSubmit(onSubmit)} noValidate>
                <h3 style={{ marginBottom: '0.5rem' }}>FloorForge Pilot Interest</h3>
                <p style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', marginBottom: '1.75rem' }}>
                  Tell us about your company and how you currently handle hardwood floor work.
                </p>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="f-name">Full Name *</label>
                    <input
                      id="f-name"
                      {...register('name')}
                      placeholder="Jane Doe"
                      aria-invalid={!!errors.name}
                      className={errors.name ? 'field-error' : ''}
                    />
                    {errors.name && (
                      <p className="error-message" role="alert">
                        {errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="f-company">Company Name *</label>
                    <input
                      id="f-company"
                      {...register('companyName')}
                      placeholder="Acme Flooring"
                      aria-invalid={!!errors.companyName}
                      className={errors.companyName ? 'field-error' : ''}
                    />
                    {errors.companyName && (
                      <p className="error-message" role="alert">
                        {errors.companyName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="f-email">Email *</label>
                    <input
                      id="f-email"
                      type="email"
                      {...register('email')}
                      placeholder="jane@acmeflooring.com"
                      aria-invalid={!!errors.email}
                      className={errors.email ? 'field-error' : ''}
                    />
                    {errors.email && (
                      <p className="error-message" role="alert">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="field">
                    <label htmlFor="f-phone">Phone *</label>
                    <input
                      id="f-phone"
                      {...register('phone')}
                      placeholder="(416) 555-1234"
                      aria-invalid={!!errors.phone}
                      className={errors.phone ? 'field-error' : ''}
                    />
                    {errors.phone && (
                      <p className="error-message" role="alert">
                        {errors.phone.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="field">
                  <label>Your Role *</label>
                  <div className="field-radio-group">
                    {[
                      { value: 'contractor', label: 'Contractor' },
                      { value: 'flooring-specialist', label: 'Flooring Specialist' },
                      { value: 'general-builder', label: 'General Builder' },
                      { value: 'property-manager', label: 'Property Manager' },
                      { value: 'other', label: 'Other' },
                    ].map((r) => (
                      <label
                        key={r.value}
                        className={`field-radio ${watch('role') === r.value ? 'checked' : ''}`}
                      >
                        <input type="radio" value={r.value} {...register('role')} />
                        {r.label}
                      </label>
                    ))}
                  </div>
                  {errors.role && (
                    <p className="error-message" role="alert">
                      {errors.role.message}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="f-sqft">Annual Hardwood Flooring Sq. Ft. (Optional)</label>
                  <input
                    id="f-sqft"
                    type="number"
                    {...register('flooringSqFt', { valueAsNumber: true })}
                    placeholder="e.g. 5000"
                  />
                  {errors.flooringSqFt && (
                    <p className="error-message" role="alert">
                      {errors.flooringSqFt.message}
                    </p>
                  )}
                </div>

                <div className="field">
                  <label htmlFor="f-message">Tell Us About Your Flooring Work (Optional)</label>
                  <textarea
                    id="f-message"
                    {...register('message')}
                    placeholder="What types of jobs do you handle? What are your biggest pain points with current sanding and finishing workflows?"
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-copper btn-lg"
                  style={{ width: '100%' }}
                  disabled={isSubmitting || mutation.isPending}
                >
                  {isSubmitting || mutation.isPending ? 'Submitting…' : 'Join the Pilot Interest List'}
                  {!isSubmitting && !mutation.isPending && <span className="btn-arrow">→</span>}
                </button>

                <p className="form-disclosure">
                  By submitting, you agree to be contacted by Ecowoods about FloorForge pilot opportunities. We never share your information.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
