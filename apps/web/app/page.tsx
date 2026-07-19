'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { submitLead } from '@ecowoods/api-client';
import { leadSchema, type LeadFormData } from '@ecowoods/shared';
import { RotatingBackground } from './components/RotatingBackground';
import PricingSection from './components/PricingSection';
import BookingPanel from './components/BookingPanel';
import ConfiguratorSection from './components/ConfiguratorSection';
import CountUp from './components/CountUp';
import SpecsCoverage from './components/SpecsCoverage';
import PortfolioGallery from './components/PortfolioGallery';
import StandardDeck from './components/StandardDeck';
import TestimonialDeck from './components/TestimonialDeck';
import ProcessDeck from './components/ProcessDeck';
import ServiceTicker, { type TickerItem } from './components/ServiceTicker';
/* ============================================================
   ECOWOODS — Toronto Hardwood Flooring
   Marketing landing page · single conversion funnel
   MARKET-LEADER EDITION — Tesla authority × AWS trust
   ============================================================ */

/* ---------------------- Types ---------------------- */
type Pillar = {
  title: string;
  proof: string;
  icon: keyof typeof Icon;
};

type FunnelStep = {
  num: string;
  title: string;
  line: string;
  icon: keyof typeof Icon;
};

type GalleryItem = {
  id: string;
  title: string;
  sub: string;
  image: string;
  span: 'span-4' | 'span-6' | 'span-8' | 'span-12';
};

type Review = {
  initials: string;
  name: string;
  place: string;
  quote: string;
  stars: number;
};

type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
};

type FaqItem = { q: string; a: string };

/* ---------------------- Inline Icons ---------------------- */
const Icon = {
  plank: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="4" rx="1" />
      <rect x="3" y="14" width="18" height="4" rx="1" />
      <path d="M9 6v4M15 14v4" />
    </svg>
  ),
  sander: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round" />
    </svg>
  ),
  brush: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 4l6 6-9 9-6-6 9-9Z" />
      <path d="M5 13l-2 2 4 4 2-2" strokeLinecap="round" />
    </svg>
  ),
  stairs: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 20h4v-4h4v-4h4V8h4V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 19c0-9 6-15 14-14-1 8-7 14-14 14Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19c5-5 8-7 14-14" strokeLinecap="round" />
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l10 10-10 10L2 12 12 2Z" strokeLinejoin="round" />
      <path d="M2 12h20M12 2v20" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-4h4v4" />
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
  pin: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .95.68l1.5 4.4a1 1 0 0 1-.5 1.21l-1.85 1a13 13 0 0 0 6.33 6.33l1-1.85a1 1 0 0 1 1.21-.5l4.4 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 2l3 6.5 7 .9-5.2 4.7 1.4 7-6.2-3.6L5.8 21l1.4-7L2 9.4l7-.9L12 2Z" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" strokeLinejoin="round" />
    </svg>
  ),
  flake: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2v20M4 7l16 10M4 17L20 7" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---------------------- Content data ---------------------- */

/**
 * Hero trust bar — the first thing a visitor reads.
 *
 * All four values are NUMERALS on purpose. The fourth used to be the word
 * "Lifetime.", which broke the row two ways: a display-serif word is far wider
 * than a numeral, and its two-word label wrapped while the others didn't, so
 * the bar lost its rhythm exactly where the eye finishes.
 *
 * "0 · Subcontractors" restates the claim the rest of the site already makes
 * ("Salaried master craftsmen. No subcontractors — ever.") — and a zero sitting
 * among big numbers is the most arresting figure on the row. The lifetime
 * warranty is not lost: it keeps its own pillar in #services, where there is
 * room to state it precisely rather than compress it into one word over a photo.
 */
const trustStats = [
  { to: 25, em: '+', lbl: 'Years in Toronto' },
  { to: 5200, em: '+', lbl: 'Homes Transformed' },
  { to: 4.9, decimals: 1, em: '★', lbl: '348 Verified Reviews' },
  /**
   * ⚠️ VERIFY BEFORE THIS STAYS UP. 2.5M is not measured — it is the lowest
   * figure internally consistent with the site's own claims: 5,200 homes x
   * ~500 sq ft/home = 2.6M sq ft, implying ~$4.81/sq ft against $500k/yr x
   * 25 yrs. Rounded DOWN: under-claiming is safe, over-claiming is not.
   * Replace with the real number from the job book.
   */
  { to: 2.5, decimals: 1, unit: 'M', em: '+', lbl: 'Sq Ft Sanded & Finished' },
];


const featuredReviews: Review[] = [
  {
    initials: 'SM',
    name: 'Sarah M.',
    place: 'Rosedale · Full Refinish',
    quote:
      "Ecowoods refinished our 100-year-old red oak floors and they look better than I imagined possible. The dust control was unreal — we never had to leave the house.",
    stars: 5,
  },
  {
    initials: 'AB',
    name: 'Andrew B.',
    place: 'Scarborough · Main Floor + Stairs',
    quote:
      'They moved our furniture, protected the kitchen, finished a day early, and the bill matched the estimate to the penny. Will hire again for the basement.',
    stars: 5,
  },
  {
    initials: 'JL',
    name: 'Jennifer L.',
    place: 'Forest Hill · Custom Inlay',
    quote:
      "Custom inlay around our fireplace, walnut on oak. Came out exactly right the first install. Master craftsmen, no other word for it.",
    stars: 5,
  },
];

const standardPillars: Pillar[] = [
  {
    icon: 'shield',
    title: 'Lifetime Warranty',
    proof: 'Every job, every home — we stand behind our work for as long as you own it.',
  },
  {
    icon: 'diamond',
    title: 'Master Craftsmen — Never Subcontractors',
    proof: 'Salaried Ecowoods employees only, many with us 10+ years. No revolving crews.',
  },
  {
    icon: 'leaf',
    title: 'FSC-Certified Eco Materials + GreenGuard Gold',
    proof: 'Sustainable species, water-based ≤50 g/L VOC finishes, zero-formaldehyde adhesives.',
  },
  {
    icon: 'check',
    title: 'Fixed Pricing in Writing + Zero Dust',
    proof: 'Your written estimate is the price you pay. HEPA containment captures 99.7% of dust.',
  },
];

/**
 * Service ticker — share of recent project mix, shown exchange-style.
 *
 * ⚠️ PLACEHOLDER FIGURES. `share` and `trend` below are invented stand-ins so
 * the component renders. They are published to homeowners as facts about
 * Ecowoods, so REPLACE THEM WITH REAL NUMBERS from the job book before this
 * ships. Shares are shown as a share of project mix and should total ~100.
 */
const serviceTicker: TickerItem[] = [
  { label: 'Hardwood Installation', share: 34, trend: 'up' },
  { label: 'Refinishing & Restoration', share: 28, trend: 'up' },
  { label: 'Dust-Free Sanding', share: 14, trend: 'flat' },
  { label: 'Stairs & Railings', share: 10, trend: 'up' },
  { label: 'Custom Inlays & Borders', share: 8, trend: 'flat' },
  { label: 'Commercial Projects', share: 6, trend: 'up' },
];

const funnelSteps: FunnelStep[] = [
  {
    num: '01',
    icon: 'pin',
    title: 'Free In-Home Consultation',
    line: 'A senior estimator measures, moisture-tests, and brings species and finish samples to your door.',
  },
  {
    num: '02',
    icon: 'check',
    title: 'Written Estimate — Fixed Price',
    line: 'The number on paper is the number on your invoice. Fixed price guarantee at every stage.',
  },
  {
    num: '03',
    icon: 'sander',
    title: 'Flawless Execution — Dust-Free',
    line: 'Salaried master craftsmen. No subcontractors — ever. 99.7% dust capture at the source.',
  },
  {
    num: '04',
    icon: 'shield',
    title: 'Lifetime Protection',
    line: 'A lifetime workmanship warranty, in writing, for as long as you own the home.',
  },
];

const galleryItems: GalleryItem[] = [
  {
    id: 'rosedale',
    title: 'Rosedale Victorian Restoration',
    sub: '1,800 sq ft Red Oak — Lifetime Warranty Delivered',
    image:
      'https://images.unsplash.com/photo-1560449752-3fd4bdbe7df0?auto=format&fit=crop&w=1400&q=80',
    span: 'span-8',
  },
  {
    id: 'leslieville',
    title: 'Leslieville Loft',
    sub: '900 sq ft Wide-Plank White Oak',
    image:
      'https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&w=900&q=80',
    span: 'span-4',
  },
  {
    id: 'forest-hill',
    title: 'Forest Hill Estate',
    sub: 'Walnut Herringbone with Custom Border',
    image:
      'https://images.unsplash.com/photo-1580398814575-816cf5faebad?auto=format&fit=crop&w=900&q=80',
    span: 'span-4',
  },
  {
    id: 'distillery',
    title: 'Distillery District Penthouse',
    sub: '2,400 sq ft Smoked Oak Chevron',
    image:
      'https://images.unsplash.com/photo-1723897917319-3958c7b4aaa1?auto=format&fit=crop&w=1400&q=80',
    span: 'span-8',
  },
  {
    id: 'cabbagetown',
    title: 'Cabbagetown Townhouse',
    sub: 'Heritage Refinish with Stair Re-Capping',
    image:
      'https://images.unsplash.com/photo-1721274501580-6366b96a6050?auto=format&fit=crop&w=900&q=80',
    span: 'span-6',
  },
  {
    id: 'yorkville',
    title: 'Yorkville Condo Conversion',
    sub: 'Engineered Wide Plank over Quiet Underlayment',
    image:
      'https://images.unsplash.com/photo-1560448204-603b3fc33ddc?auto=format&fit=crop&w=900&q=80',
    span: 'span-6',
  },
];

const speciesList: Species[] = [
  { id: 'white-oak', name: 'White Oak', hardness: 'Janka 1360', origin: 'Ontario & Quebec', vibe: 'Calm, modern, infinitely stainable' },
  { id: 'red-oak', name: 'Red Oak', hardness: 'Janka 1290', origin: 'Northern Ontario', vibe: 'Warm, classic, the Canadian heritage choice' },
  { id: 'walnut', name: 'Black Walnut', hardness: 'Janka 1010', origin: 'Eastern North America', vibe: 'Deep, luxurious, statement-making' },
  { id: 'maple', name: 'Hard Maple', hardness: 'Janka 1450', origin: 'Ontario & Quebec', vibe: 'Bright, uniform, contemporary' },
  { id: 'hickory', name: 'Hickory', hardness: 'Janka 1820', origin: 'Eastern North America', vibe: 'Rugged, characterful, family-proof' },
  { id: 'ash', name: 'White Ash', hardness: 'Janka 1320', origin: 'Ontario', vibe: 'Light, Scandinavian, resilient' },
];

const serviceAreas = [
  'Downtown Toronto', 'North York', 'Etobicoke', 'Scarborough', 'East York', 'York',
  'Vaughan', 'Markham', 'Richmond Hill', 'Mississauga', 'Oakville', 'Brampton',
  'Aurora', 'Newmarket', 'Pickering', 'Ajax',
];

const faqItems: FaqItem[] = [
  {
    q: 'Is the estimate really fixed? What about "unforeseen conditions"?',
    a: 'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no "unforeseen conditions" to surprise you later. The number on paper is the number on your invoice.',
  },
  {
    q: 'Can we stay in the house during the work?',
    a: 'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed Festool and Bona Atomic systems. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.',
  },
  {
    q: 'What exactly does the lifetime warranty cover?',
    a: 'Every Ecowoods installation and refinish carries a lifetime workmanship warranty for as long as you own the home — transferable once at sale. Manufacturer material warranties (typically 25–35 years on finish, 50 years structural) pass through on top. Everything is in writing in your contract.',
  },
  {
    q: 'How long will my project take?',
    a: 'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining, and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.',
  },
];

/* ---------------------- Hooks ---------------------- */
function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>('.reveal');
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '-40px 0px -40px 0px', threshold: 0.08 }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, []);
  return ref;
}


/* ---------------------- Page ---------------------- */
export default function HomePage() {
  const root = useReveal();

  /* ---------- FAQ + modal state ---------- */
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);

/* ---------- Contact Form - PERFECT INTEGRATION ---------- */
const queryClient = useQueryClient();

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  reset,
  watch,
} = useForm<LeadFormData>({
  resolver: zodResolver(leadSchema),
  defaultValues: {
    source: 'website',
    service: 'installation',
    timeline: 'flexible',
  },
});

const mutation = useMutation({
  mutationFn: (data: LeadFormData) => submitLead(data),
  onSuccess: () => {
    toast.success("Estimate request received!", {
      description: "A senior estimator will contact you within 1 business day.",
      action: {
        label: "Track in App",
        onClick: () => window.open('https://app.ecowoods.ca', '_blank'),
      },
    });
    reset();
    queryClient.invalidateQueries({ queryKey: ['leads'] });
  },
  onError: (error: Error) => {
    toast.error("Something went wrong", {
      description: error.message || "Please try again or call (416) 249-1276",
    });
  },
});

const onSubmit = (data: LeadFormData) => {
  mutation.mutate(data);
};

  return (
    <div ref={root as React.MutableRefObject<HTMLDivElement>}>
      {/* 1 · HERO — minimalist authority */}
      <section className="hero" id="hero">
        <div className="hero-bg" aria-hidden="true" />
        <RotatingBackground />
        <div className="shell hero-content">
          <h1 className="reveal" data-delay="1">
            Mastercrafted Hardwood Flooring.<br />
            <em>Guaranteed for Life.</em>
          </h1>

          <p className="hero-lede reveal" data-delay="2">
            Fixed price in writing. Zero dust. Salaried master artisans using FSC-certified
            sustainable materials. Toronto homes transformed with certainty — not hope.
          </p>

          <div className="hero-actions reveal" data-delay="3">
            <a className="btn btn-copper btn-lg" href="#quote">
              Get Your Free Written Estimate
              <span className="btn-arrow">{Icon.arrow}</span>
            </a>
          </div>

          <div className="hero-stats reveal" data-delay="4">
            {trustStats.map((s) => (
              <div className="hero-stat" key={s.lbl}>
                <div className="val">
                  <CountUp to={s.to} decimals={s.decimals} unit={s.unit} />
                  {s.em && <em>{s.em}</em>}
                </div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-scroll" aria-hidden="true">
          <span>Scroll</span>
          <span className="line" />
        </div>
      </section>

      {/* 3 · THE ECOWOODS STANDARD */}
      <section
        className="section photo-bg-section section--card"
        id="services"
        style={{ color: 'var(--cream-50)', position: 'relative', overflow: 'hidden', backgroundColor: 'var(--walnut-950)' }}
      >
        <RotatingBackground theme="craft" interval={9000} />
        <div className="shell" style={{ position: 'relative', zIndex: 2 }}>
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow" style={{ color: 'var(--copper-bright)' }}>
              The Ecowoods Standard
            </span>
            <h2 style={{ color: 'var(--cream-50)' }}>
              One shop. One material. <span className="serif-italic">One standard.</span>
            </h2>
            <p style={{ color: 'rgba(245, 239, 230, 0.78)' }}>
              Installation, refinishing, sanding, stairs, inlays, and commercial — every service
              delivered by the same family-owned shop since 1998.
            </p>
          </div>

          <StandardDeck items={standardPillars} icon={Icon} />

          <ServiceTicker items={serviceTicker} tone="dark" />
        </div>
      </section>

      {/* 5 · RESULTS — curated proof */}
      <section className="section paper-texture" id="gallery">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Results</span>
            <h2>
              Toronto&rsquo;s living rooms, <span className="serif-italic">our portfolio.</span>
            </h2>
            <p>A curated sample of projects completed across the GTA in the last twelve months.</p>
          </div>

          <PortfolioGallery items={galleryItems} />
        </div>
      </section>

      {/* 4 · HOW IT WORKS — 4-step funnel */}
      <section className="section" id="process">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">How It Works</span>
            <h2>
              Four steps to <span className="serif-italic">certainty.</span>
            </h2>
            <p>
              Fixed price guarantee at every stage. No subcontractors — ever.
            </p>
          </div>

          <ProcessDeck items={funnelSteps} icon={Icon} />
        </div>
      </section>

      {/* 5b · DESIGN YOUR FLOOR — sits between "look what we did" and "here are the
             specs". The gallery creates the want; the configurator lets them act on
             it while it is still warm, and hands the whole configuration to RenoGuide. */}
      <ConfiguratorSection />
      <SpecsCoverage species={speciesList} areas={serviceAreas} />

      {/* 2 · PROOF & AUTHORITY */}
      <section className="section paper-texture" id="reviews">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '780px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '2px', color: 'var(--copper)' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} style={{ width: '20px', height: '20px', fill: 'currentColor' }}>
                    {Icon.star}
                  </span>
                ))}
              </div>
              <span style={{ fontWeight: 600 }}>
                4.9 <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 348 verified reviews</span>
              </span>
            </div>
            <span className="eyebrow">Proof</span>
            <h2>
              What clients say <span className="serif-italic">after move-in day.</span>
            </h2>
            <p>
              Reviews aggregated across Google, HomeStars, Houzz, and BBB. We do not curate — every
              review from the last decade is publicly visible on those platforms.
            </p>
          </div>

          <TestimonialDeck items={featuredReviews} star={Icon.star} />

        </div>
      </section>

      {/* Objection-handling FAQ — directly above the conversion moment */}
      <section className="section" id="faq">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Before You Book</span>
            <h2>
              The four questions <span className="serif-italic">everyone asks.</span>
            </h2>
          </div>

          <div className="faq-list reveal">
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

      {/* 5c · PRICING — transparent range before the ask */}

      <PricingSection />


      {/* 6 · CONVERSION — preserved Free In-Home Estimate section (untouched) */}
      <section className="section wood-grain-dark noise-overlay section--card" id="quote">
        <div className="shell">
          <div className="contact-grid">
            <div className="contact-info reveal" style={{ color: 'var(--cream-50)' }}>
              <span className="eyebrow" style={{ color: 'var(--copper-bright)' }}>
                Free In-Home Estimate
              </span>
              <h2 style={{ color: 'var(--cream-50)', marginTop: '1rem' }}>
                Tell us about<br />
                your <span className="serif-italic">project.</span>
              </h2>
              <p style={{ color: 'rgba(245, 239, 230, 0.75)' }}>
                A senior estimator will be in touch within one business day to schedule a free,
                no-obligation in-home consultation. We bring species samples, finish samples, and a
                portfolio of completed Toronto projects.
              </p>
              {/*
                The footer already publishes email, showroom address and full
                hours ~300px below this. Repeating them here made the reader
                process the same four facts twice and buried the actual action.
                This section keeps ONE fast path — phone, plus when to use it —
                and lets the footer own the reference block.
              */}
              <a href="tel:+14162491276" className="quote-contact">
                <span className="quote-contact-icon">{Icon.phone}</span>
                <span className="quote-contact-text">
                  <span className="quote-contact-label">Prefer to talk?</span>
                  <span className="quote-contact-num">(416) 249-1276</span>
                  <span className="quote-contact-when">Mon–Sat 8 AM – 7 PM · Sun 10 AM – 4 PM</span>
                </span>
              </a>

              <button type="button" className="estimate-cta-card" onClick={() => setEstimateModalOpen(true)}>
                <span className="estimate-cta-icon">{Icon.mail}</span>
                <span className="estimate-cta-text">
                  <span className="estimate-cta-title">Request a free estimate</span>
                  <span className="estimate-cta-sub">Takes 60 seconds — no pressure, no obligation.</span>
                </span>
                <span className="estimate-cta-arrow">{Icon.arrow}</span>
              </button>
            </div>

            {/* Right column: the booking calendar (inline on desktop, sheet on mobile) */}
            <BookingPanel clockIcon={Icon.clock} />
          </div>
        </div>
      </section>

      {estimateModalOpen && (
        <div className="estimate-modal-overlay" onClick={() => setEstimateModalOpen(false)}>
          <div className="estimate-modal" role="dialog" aria-modal="true" aria-label="Request a free estimate" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="estimate-modal-close" aria-label="Close" onClick={() => setEstimateModalOpen(false)}>×</button>
            <div className="contact-form">
              <form 
                onSubmit={handleSubmit(onSubmit)} 
                noValidate
              >
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
                      placeholder="(416) 249-1276"
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
                      { value: 'installation', label: 'New Install' },
                      { value: 'refinishing', label: 'Refinishing' },
                      { value: 'sanding', label: 'Dust-Free Sanding' },
                      { value: 'stairs', label: 'Stairs' },
                      { value: 'inlays', label: 'Custom Inlays' },
                      { value: 'commercial', label: 'Commercial' },
                    ].map((s) => (
                      <label
                        key={s.value}
                        className={`field-radio ${watch('service') === s.value ? 'checked' : ''}`}
                      >
                        <input type="radio" value={s.value} {...register('service')} />
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
                  disabled={isSubmitting || mutation.isPending}
                >
                  {isSubmitting || mutation.isPending ? 'Sending…' : 'Request my free estimate'}
                  {!isSubmitting && !mutation.isPending && <span className="btn-arrow">→</span>}
                </button>

                <p className="form-disclosure">
                  By submitting, you agree to be contacted by Ecowoods about your project. We never share your information.
                </p>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
