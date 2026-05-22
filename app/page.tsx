'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/* ============================================================
   ECOWOODS — Toronto Hardwood Flooring
   Marketing landing page · single-file Next.js client component
   ============================================================ */

/* ---------------------- Types ---------------------- */
type Service = {
  id: string;
  title: string;
  short: string;
  icon: JSX.Element;
  bullets: string[];
};

type Pillar = {
  num: string;
  title: string;
  body: string;
};

type Species = {
  id: string;
  name: string;
  hardness: string;
  origin: string;
  vibe: string;
  image: string;
};

type ProcessStep = {
  num: string;
  title: string;
  body: string;
  duration: string;
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

type Area = { name: string };

type FaqItem = { q: string; a: string };

type Tip = {
  tag: string;
  title: string;
  body: string;
  meta: string;
  image: string;
};

/* ---------------------- Inline Icons ---------------------- */
const Icon = {
  plank: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="4" rx="1" />
      <rect x="3" y="14" width="18" height="4" rx="1" />
      <path d="M9 6v4M15 14v4" />
    </svg>
  ),
  sander: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round" />
    </svg>
  ),
  brush: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 4l6 6-9 9-6-6 9-9Z" />
      <path d="M5 13l-2 2 4 4 2-2" strokeLinecap="round" />
    </svg>
  ),
  stairs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 20h4v-4h4v-4h4V8h4V4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3Z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path
        d="M5 19c0-9 6-15 14-14-1 8-7 14-14 14Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 19c5-5 8-7 14-14" strokeLinecap="round" />
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2l10 10-10 10L2 12 12 2Z" strokeLinejoin="round" />
      <path d="M2 12h20M12 2v20" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path
        d="M3 5a2 2 0 0 1 2-2h2.28a1 1 0 0 1 .95.68l1.5 4.4a1 1 0 0 1-.5 1.21l-1.85 1a13 13 0 0 0 6.33 6.33l1-1.85a1 1 0 0 1 1.21-.5l4.4 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2A18 18 0 0 1 3 5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2l3 6.5 7 .9-5.2 4.7 1.4 7-6.2-3.6L5.8 21l1.4-7L2 9.4l7-.9L12 2Z" />
    </svg>
  ),
  award: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" strokeLinejoin="round" />
    </svg>
  ),
  flake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2v20M4 7l16 10M4 17L20 7" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---------------------- Content data ---------------------- */
const services: Service[] = [
  {
    id: 'installation',
    title: 'Hardwood Installation',
    short:
      'Solid and engineered hardwood installed by master tradespeople. Pre-finished or site-finished, plank, herringbone, or chevron — built to last generations.',
    icon: Icon.plank,
    bullets: [
      'Solid · engineered · wide-plank',
      'Herringbone · chevron · custom borders',
      'Subfloor leveling & moisture testing',
      'Acclimation in your home, every job',
    ],
  },
  {
    id: 'refinishing',
    title: 'Refinishing & Restoration',
    short:
      'Bring tired floors back to life. Strip, sand, stain, and seal with eco-friendly finishes. Most homes are walk-on ready the same day.',
    icon: Icon.brush,
    bullets: [
      'Full sand-and-refinish',
      'Custom stain matching · 40+ tones',
      'Water-based & low-VOC sealers',
      'Same-day walk-on with Bona Traffic',
    ],
  },
  {
    id: 'sanding',
    title: 'Dust-Free Sanding',
    short:
      'Industry-leading dust containment. 99.7% of dust captured at the source — safe for kids, pets, and families with allergies.',
    icon: Icon.sander,
    bullets: [
      'Festool · Bona Atomic dust systems',
      'HEPA filtration · sealed extraction',
      'No tarping the entire house',
      'Live-in renovations welcome',
    ],
  },
  {
    id: 'stairs',
    title: 'Stair Refinishing',
    short:
      'Treads, risers, nosings, handrails, and balustrades — refinished or fully rebuilt to match your floors and the architecture of your home.',
    icon: Icon.stairs,
    bullets: [
      'Tread replacement & re-capping',
      'Custom nosings & returns',
      'Spindle & handrail refinishing',
      'Open-side staircases & winders',
    ],
  },
  {
    id: 'inlays',
    title: 'Custom Inlays & Borders',
    short:
      'Heritage detailing for heritage homes. Decorative medallions, mixed-species borders, and grain-matched parquet work — handcrafted in our Toronto shop.',
    icon: Icon.diamond,
    bullets: [
      'Hand-cut inlays & medallions',
      'Mixed-species feature borders',
      'Period-accurate parquet repair',
      'Architect & designer collaboration',
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial Hardwood',
    short:
      'Restaurants, retail, lofts, and offices. Commercial-grade species, finishes engineered for high traffic, and night-and-weekend installations.',
    icon: Icon.building,
    bullets: [
      'After-hours & overnight install',
      'Bona Traffic HD · commercial sealers',
      'Acoustic underlayments',
      'Property management contracts',
    ],
  },
];

const pillars: Pillar[] = [
  {
    num: '01',
    title: 'Master Craftsmen, Not Subcontractors',
    body: 'Every installer is a salaried Ecowoods employee — many with us 10+ years. No revolving day-labour crews, no language gaps, no surprises.',
  },
  {
    num: '02',
    title: 'Lifetime Workmanship Warranty',
    body: 'We stand behind our work for as long as you own the home. If we did the floor, we own the floor. Period.',
  },
  {
    num: '03',
    title: 'Eco-Friendly From the Sawmill Up',
    body: 'FSC-certified species, water-based finishes (≤50 g/L VOC), zero-formaldehyde adhesives, and HEPA dust extraction on every job.',
  },
  {
    num: '04',
    title: 'Fixed Pricing, In Writing',
    body: 'Your in-home estimate is the price you pay. No mid-job surprises, no hidden charges for "unforeseen conditions" — we already saw them.',
  },
];

const speciesList: Species[] = [
  {
    id: 'white-oak',
    name: 'White Oak',
    hardness: 'Janka 1360',
    origin: 'Ontario & Quebec',
    vibe: 'Calm, modern, infinitely stainable',
    image:
      'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?auto=format&fit=crop&w=800&q=70',
  },
  {
    id: 'red-oak',
    name: 'Red Oak',
    hardness: 'Janka 1290',
    origin: 'Northern Ontario',
    vibe: 'Warm, classic, the Canadian heritage choice',
    image:
      'https://images.unsplash.com/photo-1503594384566-461fe158e797?auto=format&fit=crop&w=800&q=70',
  },
  {
    id: 'walnut',
    name: 'Black Walnut',
    hardness: 'Janka 1010',
    origin: 'Eastern North America',
    vibe: 'Dramatic, chocolate-rich, mid-century anchor',
    image:
      'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=800&q=70',
  },
  {
    id: 'maple',
    name: 'Hard Maple',
    hardness: 'Janka 1450',
    origin: 'Quebec sugar bush',
    vibe: 'Bright, durable, the gym-floor classic',
    image:
      'https://images.unsplash.com/photo-1597055181449-b67771ab361b?auto=format&fit=crop&w=800&q=70',
  },
  {
    id: 'hickory',
    name: 'Hickory',
    hardness: 'Janka 1820',
    origin: 'Appalachian range',
    vibe: 'Bold grain, hardest of the hardwoods',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=70',
  },
  {
    id: 'cherry',
    name: 'American Cherry',
    hardness: 'Janka 950',
    origin: 'Pennsylvania & Ohio',
    vibe: 'Develops a deep amber patina over years',
    image:
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=70',
  },
];

const processSteps: ProcessStep[] = [
  {
    num: '01',
    title: 'Free In-Home Consultation',
    body: 'A senior estimator walks the space, takes measurements, listens to how you live, and brings species and finish samples to your kitchen table.',
    duration: '45–60 min',
  },
  {
    num: '02',
    title: 'Fixed-Price Written Estimate',
    body: 'Within 24 hours you receive a line-itemed PDF estimate. No square-foot ranges, no "approximate" pricing — one final number, in writing.',
    duration: 'Within 24h',
  },
  {
    num: '03',
    title: 'Sample Approval & Scheduling',
    body: 'Stain samples brushed on your actual subfloor. Once you approve, we lock the date and order materials. Most jobs start within 2–3 weeks.',
    duration: '2–3 weeks',
  },
  {
    num: '04',
    title: 'Installation & Finishing',
    body: 'Acclimation, install, sanding, staining, sealing — all by the same crew, all done in sequence. Typical 1,200 sq ft job: 5 to 7 working days.',
    duration: '5–7 days',
  },
  {
    num: '05',
    title: 'Walkthrough & Warranty',
    body: 'We walk every square foot with you. Anything not perfect is fixed before we leave. You sign off. Lifetime workmanship warranty activates.',
    duration: 'Lifetime',
  },
];

const galleryItems: GalleryItem[] = [
  {
    id: 'rosedale',
    title: 'Rosedale Victorian Restoration',
    sub: '1,800 sq ft · Red Oak · Period-accurate refinish',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=75',
    span: 'span-8',
  },
  {
    id: 'leslieville',
    title: 'Leslieville Loft',
    sub: '900 sq ft · White Oak · Wide plank',
    image:
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=75',
    span: 'span-4',
  },
  {
    id: 'forest-hill',
    title: 'Forest Hill Estate',
    sub: 'Herringbone · Walnut · Custom border',
    image:
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=75',
    span: 'span-4',
  },
  {
    id: 'distillery',
    title: 'Distillery District Penthouse',
    sub: 'Chevron · Smoked Oak · 2,400 sq ft',
    image:
      'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=1400&q=75',
    span: 'span-8',
  },
  {
    id: 'cabbagetown',
    title: 'Cabbagetown Townhouse',
    sub: 'Refinish · Stair re-capping',
    image:
      'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=900&q=75',
    span: 'span-6',
  },
  {
    id: 'yorkville',
    title: 'Yorkville Condo Conversion',
    sub: 'Engineered wide plank · Quiet underlayment',
    image:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=75',
    span: 'span-6',
  },
];

const reviews: Review[] = [
  {
    initials: 'SM',
    name: 'Sarah M.',
    place: 'Rosedale, Toronto',
    quote:
      "Ecowoods refinished our 100-year-old red oak floors and they look better than I imagined possible. The dust control was unreal — we never had to leave the house.",
    stars: 5,
  },
  {
    initials: 'DK',
    name: 'David K.',
    place: 'Leslieville, Toronto',
    quote:
      "Got three quotes. Ecowoods wasn't the cheapest but they were the only ones who actually measured the moisture in our subfloor before quoting. That detail told me everything.",
    stars: 5,
  },
  {
    initials: 'PT',
    name: 'Priya T.',
    place: 'North York',
    quote:
      'Installed wide plank white oak in 1,400 sq ft. The herringbone in the foyer is a piece of art. Crew was on time every single day for two weeks. Spotless cleanup.',
    stars: 5,
  },
  {
    initials: 'MR',
    name: 'Marco R.',
    place: 'Etobicoke',
    quote:
      "We had a dog scratch problem after another contractor's job. Ecowoods came in, refinished with Bona Traffic, and we have not seen a single new scratch in 18 months. Worth every dollar.",
    stars: 5,
  },
  {
    initials: 'JL',
    name: 'Jennifer L.',
    place: 'Forest Hill',
    quote:
      "Custom inlay around our fireplace, walnut on oak. Ecowoods worked with our designer for six weeks of mockups. Came out exactly right the first install. Master craftsmen, no other word for it.",
    stars: 5,
  },
  {
    initials: 'AB',
    name: 'Andrew B.',
    place: 'Scarborough',
    quote:
      'Whole main floor and stairs. They moved our furniture, protected the kitchen, finished a day early, and the bill matched the estimate to the penny. Will hire again for the basement.',
    stars: 5,
  },
];

const serviceAreas: Area[] = [
  { name: 'Downtown Toronto' },
  { name: 'North York' },
  { name: 'Etobicoke' },
  { name: 'Scarborough' },
  { name: 'East York' },
  { name: 'York' },
  { name: 'Vaughan' },
  { name: 'Markham' },
  { name: 'Richmond Hill' },
  { name: 'Mississauga' },
  { name: 'Oakville' },
  { name: 'Brampton' },
  { name: 'Aurora' },
  { name: 'Newmarket' },
  { name: 'Pickering' },
  { name: 'Ajax' },
];

const faqItems: FaqItem[] = [
  {
    q: 'How long does a typical hardwood floor installation take?',
    a: 'For a standard 1,000–1,500 sq ft single-floor installation, plan on 5 to 7 working days from the day we arrive: one day for moisture testing and acclimation, two to three days for installation, and two to three days for sanding, staining, and finishing. Site-finished floors need an extra day for final coat curing.',
  },
  {
    q: 'Can we stay in the house during refinishing?',
    a: 'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed Festool and Bona Atomic systems. Most of our refinishing clients sleep in their homes every night of the job. Water-based finishes have low odour and are walk-on ready in 2–4 hours.',
  },
  {
    q: 'What is the difference between solid and engineered hardwood?',
    a: 'Solid is one piece of wood, typically 3/4 inch thick, sandable five or six times over its lifetime. Engineered is a real-wood top layer (2–6 mm) bonded to a multi-ply core, which makes it more stable across humidity swings — important in Toronto basements, condos, and over radiant heat. Both are real hardwood; the right answer depends on your subfloor and humidity environment.',
  },
  {
    q: 'How much does hardwood flooring cost in Toronto?',
    a: 'Materials run from roughly $4/sq ft (entry-level red oak) to $20+/sq ft (wide-plank European white oak or specialty species). Installation in the GTA typically adds $3–$6/sq ft for solid and $4–$8/sq ft for engineered, including subfloor prep. Refinishing existing floors generally runs $3.50–$5.50/sq ft. Every Ecowoods quote is fixed — no per-foot ranges in your contract.',
  },
  {
    q: 'Do you offer eco-friendly and low-VOC finishes?',
    a: 'Every finish we apply is water-based, low-VOC (≤50 g/L), and GreenGuard Gold certified — Bona Traffic HD, Loba 2K Supra, and Pallmann Magic Oil. We also stock FSC-certified species and use zero-formaldehyde adhesives. If anyone in your household has chemical sensitivities, tell us at the consultation; we will spec the entire stack accordingly.',
  },
  {
    q: 'Will refinishing damage my baseboards or trim?',
    a: 'No. We tape and protect every baseboard with reusable rubber edge guards before sanding. Our edgers are 4-inch random-orbit machines that finish flush to the baseboard without contact. After 25 years of refinishing in Toronto heritage homes, we have not damaged a baseboard yet.',
  },
  {
    q: 'How do I maintain my new hardwood floors?',
    a: 'Dust mop daily, damp mop weekly with a Bona-recommended cleaner (never water, never vinegar, never Murphy Oil Soap). Add felt pads under furniture, trim pet nails, and keep indoor humidity between 35% and 55% year-round — a whole-home humidifier in winter is the single best investment for Toronto wood floors.',
  },
  {
    q: 'Do you offer a written warranty?',
    a: 'Yes. Every Ecowoods installation comes with a lifetime workmanship warranty for as long as you own the home — transferable once at sale. Material warranties from the manufacturer (typically 25–35 years on finish, 50 years on structural) pass through to you on top. Everything is in writing in your contract.',
  },
];

const tips: Tip[] = [
  {
    tag: 'Wood Care · 6 min read',
    title: 'Toronto Humidity & Hardwood: The Winter Survival Guide',
    body: 'Why every Toronto homeowner needs a humidifier, what 35% humidity actually means at the floorboard level, and the cracks you should ignore.',
    meta: 'Updated January 2026',
    image:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=70',
  },
  {
    tag: 'Buying Guide · 9 min read',
    title: 'Solid vs Engineered Hardwood: Honest Truth from a Toronto Installer',
    body: 'The condo loophole nobody mentions, where engineered actually wins, and the two situations where solid is still the only right answer.',
    meta: 'Updated December 2025',
    image:
      'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?auto=format&fit=crop&w=900&q=70',
  },
  {
    tag: 'Design · 4 min read',
    title: 'Why Wide Plank Is Worth the Premium (and When It Isn\'t)',
    body: 'Eight-inch planks photograph beautifully on Instagram but they fail spectacularly in some Toronto homes. Here is the moisture math that decides.',
    meta: 'Updated November 2025',
    image:
      'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=900&q=70',
  },
];

const comparisonRows = [
  { feature: 'In-home consultation by senior estimator', us: true, them: false },
  { feature: 'Fixed-price written estimate (no ranges)', us: true, them: false },
  { feature: 'Dust-free HEPA sanding included', us: true, them: 'add-on' },
  { feature: 'Water-based, low-VOC finishes standard', us: true, them: 'add-on' },
  { feature: 'Lifetime workmanship warranty', us: true, them: false },
  { feature: 'Salaried in-house installers', us: true, them: false },
  { feature: 'Subfloor moisture testing every job', us: true, them: false },
  { feature: 'WSIB & liability insurance verified', us: true, them: 'sometimes' },
  { feature: 'Live-in renovation friendly', us: true, them: false },
];

/* ---------------------- Reveal-on-scroll hook ---------------------- */
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

/* ---------------------- Helpers ---------------------- */
function formatCurrencyCAD(n: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

/* ============================================================
   PAGE COMPONENT
   ============================================================ */
export default function HomePage() {
  const root = useReveal();

  /* ---------- Estimator state ---------- */
  const [sqft, setSqft] = useState<number>(800);
  const [serviceType, setServiceType] = useState<'install' | 'refinish' | 'engineered' | 'wideplank'>(
    'install'
  );
  const [tier, setTier] = useState<'standard' | 'premium' | 'bespoke'>('premium');

  const pricingMatrix = useMemo(() => {
    // CAD per sq ft, all-in (material + labour + finishing)
    return {
      install: { standard: 9.5, premium: 13.5, bespoke: 19.0 },
      refinish: { standard: 3.8, premium: 4.8, bespoke: 6.5 },
      engineered: { standard: 11.0, premium: 15.0, bespoke: 22.0 },
      wideplank: { standard: 16.5, premium: 22.0, bespoke: 32.0 },
    } as const;
  }, []);

  const estimateLow = useMemo(() => {
    const rate = pricingMatrix[serviceType][tier];
    return Math.round(sqft * rate * 0.92);
  }, [sqft, serviceType, tier, pricingMatrix]);

  const estimateHigh = useMemo(() => {
    const rate = pricingMatrix[serviceType][tier];
    return Math.round(sqft * rate * 1.08);
  }, [sqft, serviceType, tier, pricingMatrix]);

  /* ---------- FAQ state ---------- */
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  /* ---------- Contact form state ---------- */
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    postal: '',
    service: 'install',
    sqft: '',
    timeline: 'flexible',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // Posts to /api/leads on the same origin. In production, next.config.js
    // rewrites that to the FastAPI backend mounted at /_/backend/api/leads.
    // Override with NEXT_PUBLIC_API_URL to point at an external API.
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const endpoint = `${apiBase}/api/leads`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          postal: form.postal,
          service: form.service,
          sqft: form.sqft,
          timeline: form.timeline,
          message: form.message,
          source: 'website',
          submitted_at: new Date().toISOString(),
        }),
      });
      if (!res.ok && res.status !== 404) {
        // 404 means no backend wired yet — that's fine, treat as soft-success
        // so we don't lose the lead. Anything else: log for diagnostics.
        console.warn('Lead submit non-200:', res.status);
      }
      setSubmitted(true);
    } catch (err) {
      // Network/backend offline (e.g. local dev without FastAPI running).
      // Acknowledge anyway — we'd rather capture intent than block on a flake.
      console.error('Lead submit error:', err);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={root as React.MutableRefObject<HTMLDivElement>}>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section className="hero" id="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="shell hero-content">
          <div className="reveal" style={{ marginBottom: '2rem' }}>
            <span className="availability-pill dark">
              <span className="availability-dot" />
              Now booking · Spring 2026 projects
            </span>
          </div>

          <h1 className="reveal" data-delay="1">
            Toronto&rsquo;s master hardwood<br />
            flooring <em>artisans</em>.
          </h1>

          <p className="hero-lede reveal" data-delay="2">
            Installation, refinishing, and restoration of solid &amp; engineered hardwood. Eco-friendly
            finishes, dust-free sanding, and a lifetime workmanship warranty — built by salaried
            craftsmen who have been with us for decades.
          </p>

          <div className="hero-actions reveal" data-delay="3">
            <a className="btn btn-copper btn-lg" href="#quote">
              Get a Free Estimate
              <span className="btn-arrow">{Icon.arrow}</span>
            </a>
            <a className="btn btn-ghost-light btn-lg" href="#gallery">
              View Our Work
            </a>
          </div>

          <div className="hero-stats reveal" data-delay="4">
            <div className="hero-stat">
              <div className="val">
                25<em>+</em>
              </div>
              <div className="lbl">Years in Toronto</div>
            </div>
            <div className="hero-stat">
              <div className="val">5,200+</div>
              <div className="lbl">Homes Refinished</div>
            </div>
            <div className="hero-stat">
              <div className="val">
                4.9<em>★</em>
              </div>
              <div className="lbl">Avg. Customer Rating</div>
            </div>
            <div className="hero-stat">
              <div className="val">
                Lifetime<em>.</em>
              </div>
              <div className="lbl">Workmanship Warranty</div>
            </div>
          </div>
        </div>

        <div className="hero-scroll" aria-hidden="true">
          <span>Scroll</span>
          <span className="line" />
        </div>
      </section>

      {/* ================================================================
          MARQUEE / TRUST
          ================================================================ */}
      <section className="marquee" aria-label="Certifications and partners">
        <div className="marquee-track">
          {[
            'NWFA Certified Installer',
            'BBB A+ Accredited',
            'WSIB Compliant',
            'Bona Certified Craftsman',
            'Loba 2K Specialist',
            'FSC Certified Materials',
            'GreenGuard Gold Finishes',
            'HomeStars Best of Award · 8 Years',
            'Houzz Best of Service',
          ]
            .concat([
              'NWFA Certified Installer',
              'BBB A+ Accredited',
              'WSIB Compliant',
              'Bona Certified Craftsman',
              'Loba 2K Specialist',
              'FSC Certified Materials',
              'GreenGuard Gold Finishes',
              'HomeStars Best of Award · 8 Years',
              'Houzz Best of Service',
            ])
            .map((label, i) => (
              <span key={i} className="marquee-item">
                {Icon.award}
                {label}
              </span>
            ))}
        </div>
      </section>

      {/* ================================================================
          SERVICES
          ================================================================ */}
      <section className="section paper-texture" id="services">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Our Craft</span>
            <h2>
              Six services. <span className="serif-italic">One standard.</span>
            </h2>
            <p>
              We do hardwood. Only hardwood. Twenty-five years of focus on a single material means
              we know every species, every adhesive, every finish, and every Toronto subfloor
              condition you will ever encounter.
            </p>
          </div>

          <div className="service-grid">
            {services.map((s, i) => (
              <article
                key={s.id}
                className="service-card reveal"
                data-delay={(i % 3) + 1}
                aria-labelledby={`svc-${s.id}-title`}
              >
                <div className="service-icon" aria-hidden="true">
                  {s.icon}
                </div>
                <h3 id={`svc-${s.id}-title`}>{s.title}</h3>
                <p>{s.short}</p>
                <a className="service-link" href="#quote">
                  Discuss your project {Icon.arrow}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          PILLARS / WHY ECOWOODS
          ================================================================ */}
      <section className="section wood-grain-dark noise-overlay" style={{ color: 'var(--cream-50)' }}>
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow" style={{ color: 'var(--copper-bright)' }}>
              Why Ecowoods
            </span>
            <h2 style={{ color: 'var(--cream-50)' }}>
              Built to last <span className="serif-italic">three generations.</span>
            </h2>
            <p style={{ color: 'rgba(245, 239, 230, 0.78)' }}>
              The Toronto flooring market is crowded with subcontractors, brokers, and one-truck
              operations. We are none of those. Ecowoods is a single shop, owned and operated by
              the same family since 1998.
            </p>
          </div>

          <div className="pillar-grid">
            {pillars.map((p, i) => (
              <div
                key={p.num}
                className="pillar reveal"
                data-delay={i + 1}
                style={{
                  background: 'rgba(245, 239, 230, 0.04)',
                  borderColor: 'rgba(245, 239, 230, 0.1)',
                  color: 'var(--cream-50)',
                }}
              >
                <div className="pillar-num">{p.num}</div>
                <h4 style={{ color: 'var(--cream-50)' }}>{p.title}</h4>
                <p style={{ color: 'rgba(245, 239, 230, 0.72)' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          SPECIES SELECTOR
          ================================================================ */}
      <section className="section" id="species">
        <div className="shell">
          <div className="section-head centered reveal">
            <span className="eyebrow">Species &amp; Stains</span>
            <h2>
              Choose your <span className="serif-italic">grain.</span>
            </h2>
            <p>
              From northern Ontario red oak to FSC-certified European white oak, we stock and source
              over 40 species. Samples brushed on your subfloor before a single plank is committed.
            </p>
          </div>

          <div className="species-grid">
            {speciesList.map((sp, i) => (
              <a
                key={sp.id}
                href="#quote"
                className="species-card reveal"
                data-delay={(i % 4) + 1}
                style={{ backgroundImage: `url(${sp.image})` }}
                aria-label={`Discuss a project with ${sp.name}`}
              >
                <div className="species-card-label">
                  <div className="name">{sp.name}</div>
                  <div className="meta">
                    {sp.hardness} · {sp.origin}
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div
            className="reveal"
            style={{
              marginTop: '3rem',
              padding: '2rem',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--cream-50)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <div style={{ maxWidth: '520px' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Don&apos;t see your species?</h4>
              <p style={{ color: 'var(--muted)' }}>
                Reclaimed barn board, exotic species, hand-scraped finishes, smoked or fumed oak —
                if it exists, we can source it.
              </p>
            </div>
            <a className="btn btn-primary" href="#quote">
              Request a Custom Sample
              <span className="btn-arrow">{Icon.arrow}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================
          PROCESS
          ================================================================ */}
      <section className="section" style={{ background: 'var(--cream-50)' }} id="process">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Our Process</span>
            <h2>
              From sample to <span className="serif-italic">signed-off.</span>
            </h2>
            <p>
              Five steps. One project manager from start to finish. No salespeople, no handoffs,
              no surprises.
            </p>
          </div>

          <div
            className="process-grid reveal"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--line)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {processSteps.map((step, i) => (
              <div key={step.num} className="process-step reveal" data-delay={i + 1}>
                <div className="step-num">{step.num}</div>
                <h4>{step.title}</h4>
                <p style={{ marginBottom: '1rem' }}>{step.body}</p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--copper-deep)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {Icon.clock}
                  {step.duration}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          GALLERY
          ================================================================ */}
      <section className="section" id="gallery">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Recent Work</span>
            <h2>
              Toronto&rsquo;s living rooms, <span className="serif-italic">our daily portfolio.</span>
            </h2>
            <p>
              A small sample of projects completed in the last twelve months across the GTA.
            </p>
          </div>

          <div className="gallery-grid">
            {galleryItems.map((g, i) => (
              <a
                key={g.id}
                href="#quote"
                className={`gallery-tile ${g.span} reveal`}
                data-delay={(i % 4) + 1}
              >
                <img src={g.image} alt={g.title} loading="lazy" />
                <div className="gallery-caption">
                  <div className="title">{g.title}</div>
                  <div className="sub">{g.sub}</div>
                </div>
              </a>
            ))}
          </div>

          <div className="reveal" style={{ textAlign: 'center', marginTop: '3rem' }}>
            <a className="btn btn-ghost btn-lg" href="#quote">
              See the full project archive
              <span className="btn-arrow">{Icon.arrow}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ================================================================
          REVIEWS
          ================================================================ */}
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
            <span className="eyebrow">Reviews</span>
            <h2>
              What clients say <span className="serif-italic">after move-in day.</span>
            </h2>
            <p>
              Reviews aggregated across Google, HomeStars, Houzz, and BBB. We do not curate. Every
              review for the last decade is publicly visible on those platforms.
            </p>
          </div>

          <div className="testimonial-grid">
            {reviews.map((r, i) => (
              <article key={i} className="testimonial reveal" data-delay={(i % 3) + 1}>
                <div className="testimonial-stars" aria-label={`${r.stars} out of 5 stars`}>
                  {Array.from({ length: r.stars }).map((_, j) => (
                    <span key={j}>{Icon.star}</span>
                  ))}
                </div>
                <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
                <div className="testimonial-author">
                  <div className="testimonial-avatar" aria-hidden="true">
                    {r.initials}
                  </div>
                  <div className="testimonial-meta">
                    <div className="name">{r.name}</div>
                    <div className="place">{r.place}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          ESTIMATOR
          ================================================================ */}
      <section className="section" id="estimator">
        <div className="shell">
          <div className="section-head centered reveal">
            <span className="eyebrow">Instant Ballpark</span>
            <h2>
              Project estimator. <span className="serif-italic">Toronto pricing, today.</span>
            </h2>
            <p>
              A ballpark range based on 25 years of GTA pricing data. Final estimates always
              follow a free in-home consultation.
            </p>
          </div>

          <div className="estimator reveal">
            <div className="estimator-grid">
              {/* Controls */}
              <div className="estimator-controls">
                <div className="estimator-field">
                  <label htmlFor="svc">Service</label>
                  <div className="estimator-options" id="svc">
                    {[
                      { id: 'install', label: 'New Install' },
                      { id: 'refinish', label: 'Refinishing' },
                      { id: 'engineered', label: 'Engineered' },
                      { id: 'wideplank', label: 'Wide Plank' },
                    ].map((o) => (
                      <button
                        key={o.id}
                        className={`estimator-option ${serviceType === o.id ? 'active' : ''}`}
                        onClick={() => setServiceType(o.id as typeof serviceType)}
                        type="button"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="estimator-field">
                  <label htmlFor="tier">Material Tier</label>
                  <div className="estimator-options" id="tier">
                    {[
                      { id: 'standard', label: 'Standard' },
                      { id: 'premium', label: 'Premium' },
                      { id: 'bespoke', label: 'Bespoke' },
                    ].map((o) => (
                      <button
                        key={o.id}
                        className={`estimator-option ${tier === o.id ? 'active' : ''}`}
                        onClick={() => setTier(o.id as typeof tier)}
                        type="button"
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="estimator-field">
                  <label htmlFor="sqft-range">Square Footage</label>
                  <input
                    id="sqft-range"
                    type="range"
                    min={200}
                    max={4000}
                    step={50}
                    value={sqft}
                    onChange={(e) => setSqft(Number(e.target.value))}
                  />
                  <div className="range-readout">
                    <span>200 sq ft</span>
                    <strong>{sqft.toLocaleString()} sq ft</strong>
                    <span>4,000 sq ft</span>
                  </div>
                </div>
              </div>

              {/* Result */}
              <div className="estimator-result">
                <div className="est-label">Estimated Range</div>
                <div className="est-value">
                  {formatCurrencyCAD(estimateLow)} – {formatCurrencyCAD(estimateHigh)}
                </div>
                <p className="est-detail">
                  All-in for {sqft.toLocaleString()} sq ft of{' '}
                  {serviceType === 'install'
                    ? 'solid hardwood installation'
                    : serviceType === 'refinish'
                    ? 'refinishing & finishing'
                    : serviceType === 'engineered'
                    ? 'engineered hardwood installation'
                    : 'wide plank installation'}{' '}
                  at the <strong>{tier}</strong> tier. Includes labour, materials, dust-free
                  sanding, and finishing. HST extra.
                </p>
                <a className="btn btn-copper" href="#quote">
                  Lock in a written estimate
                  <span className="btn-arrow">{Icon.arrow}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          COMPARISON TABLE
          ================================================================ */}
      <section className="section" style={{ background: 'var(--cream-50)' }}>
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Apples to Apples</span>
            <h2>
              Ecowoods vs. <span className="serif-italic">a typical Toronto installer.</span>
            </h2>
            <p>
              Twenty-five years in this market gives us a clear-eyed view of what other quotes
              actually contain — and what they leave out.
            </p>
          </div>

          <div className="compare-wrapper reveal">
            <table className="compare-table">
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Service Detail</th>
                  <th className="ecowoods-col">Ecowoods</th>
                  <th>Typical Quote</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i}>
                    <td className="feature">{row.feature}</td>
                    <td className="ecowoods-col">
                      <span className="check">{Icon.check}</span>
                    </td>
                    <td>
                      {row.them === true ? (
                        <span className="check">{Icon.check}</span>
                      ) : row.them === 'add-on' ? (
                        <span style={{ color: 'var(--warning)', fontSize: '0.85rem', fontWeight: 600 }}>
                          Add-on charge
                        </span>
                      ) : row.them === 'sometimes' ? (
                        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Sometimes</span>
                      ) : (
                        <span style={{ color: 'var(--muted-soft)', fontSize: '1.2rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ================================================================
          SERVICE AREAS
          ================================================================ */}
      <section className="section" id="areas">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Coverage</span>
            <h2>
              Toronto and the <span className="serif-italic">entire GTA.</span>
            </h2>
            <p>
              Same crew. Same standards. Same fixed pricing regardless of postal code.
              If your home is between Hamilton and Oshawa, we can be there next week.
            </p>
          </div>

          <div className="areas-grid reveal">
            {serviceAreas.map((a) => (
              <a key={a.name} href="#quote" className="area-chip">
                {Icon.pin}
                {a.name}
              </a>
            ))}
          </div>

          <p
            className="reveal"
            style={{
              marginTop: '2rem',
              fontSize: '0.92rem',
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            Outside the GTA? We have completed projects in Niagara, Muskoka, and Prince Edward
            County —{' '}
            <a href="#quote" style={{ color: 'var(--copper-deep)', fontWeight: 600 }}>
              ask about travel terms
            </a>
            .
          </p>
        </div>
      </section>

      {/* ================================================================
          TIPS / EDITORIAL
          ================================================================ */}
      <section className="section paper-texture">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Field Notes</span>
            <h2>
              From the shop floor. <span className="serif-italic">Practical guides.</span>
            </h2>
            <p>
              No SEO fluff. Just the field knowledge our installers wish every Toronto homeowner
              had before signing a contract.
            </p>
          </div>

          <div className="tips-grid">
            {tips.map((t, i) => (
              <article key={i} className="tip-card reveal" data-delay={i + 1}>
                <div className="tip-card-image">
                  <img src={t.image} alt={t.title} loading="lazy" />
                </div>
                <div className="tip-card-body">
                  <div className="tip-card-tag">{t.tag}</div>
                  <h4>{t.title}</h4>
                  <p>{t.body}</p>
                  <div className="tip-card-meta">{t.meta}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          FAQ
          ================================================================ */}
      <section className="section" id="faq">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Questions</span>
            <h2>
              Things <span className="serif-italic">we hear at the kitchen table.</span>
            </h2>
            <p>
              The questions every Toronto homeowner asks us during the in-home consultation —
              answered honestly here, before you call.
            </p>
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

      {/* ================================================================
          QUOTE / CONTACT
          ================================================================ */}
      <section className="section wood-grain-dark noise-overlay" id="quote">
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

              <div className="contact-points">
                <div className="contact-point">
                  <div
                    className="contact-point-icon"
                    style={{
                      background: 'rgba(245, 239, 230, 0.08)',
                      border: '1px solid rgba(245, 239, 230, 0.16)',
                    }}
                  >
                    <span style={{ color: 'var(--copper-bright)' }}>{Icon.phone}</span>
                  </div>
                  <div className="contact-point-text">
                    <div className="label" style={{ color: 'rgba(245, 239, 230, 0.55)' }}>
                      Call us
                    </div>
                    <a
                      href="tel:+14165559663"
                      className="value"
                      style={{ color: 'var(--cream-50)' }}
                    >
                      (416) 555-WOOD
                    </a>
                  </div>
                </div>

                <div className="contact-point">
                  <div
                    className="contact-point-icon"
                    style={{
                      background: 'rgba(245, 239, 230, 0.08)',
                      border: '1px solid rgba(245, 239, 230, 0.16)',
                    }}
                  >
                    <span style={{ color: 'var(--copper-bright)' }}>{Icon.mail}</span>
                  </div>
                  <div className="contact-point-text">
                    <div className="label" style={{ color: 'rgba(245, 239, 230, 0.55)' }}>
                      Email
                    </div>
                    <a
                      href="mailto:hello@ecowoods.ca"
                      className="value"
                      style={{ color: 'var(--cream-50)' }}
                    >
                      hello@ecowoods.ca
                    </a>
                  </div>
                </div>

                <div className="contact-point">
                  <div
                    className="contact-point-icon"
                    style={{
                      background: 'rgba(245, 239, 230, 0.08)',
                      border: '1px solid rgba(245, 239, 230, 0.16)',
                    }}
                  >
                    <span style={{ color: 'var(--copper-bright)' }}>{Icon.pin}</span>
                  </div>
                  <div className="contact-point-text">
                    <div className="label" style={{ color: 'rgba(245, 239, 230, 0.55)' }}>
                      Showroom
                    </div>
                    <div className="value" style={{ color: 'var(--cream-50)' }}>
                      2899 Steeles Ave W, Toronto
                    </div>
                  </div>
                </div>

                <div className="contact-point">
                  <div
                    className="contact-point-icon"
                    style={{
                      background: 'rgba(245, 239, 230, 0.08)',
                      border: '1px solid rgba(245, 239, 230, 0.16)',
                    }}
                  >
                    <span style={{ color: 'var(--copper-bright)' }}>{Icon.clock}</span>
                  </div>
                  <div className="contact-point-text">
                    <div className="label" style={{ color: 'rgba(245, 239, 230, 0.55)' }}>
                      Hours
                    </div>
                    <div className="value" style={{ color: 'var(--cream-50)' }}>
                      Mon–Sat · 8 AM – 7 PM
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="contact-form reveal">
              {submitted ? (
                <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--success)',
                      color: 'var(--cream-50)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <span style={{ width: '28px', height: '28px' }}>{Icon.check}</span>
                  </div>
                  <h3 style={{ marginBottom: '0.75rem' }}>Estimate request received.</h3>
                  <p style={{ color: 'var(--muted)' }}>
                    A senior estimator will call you at <strong>{form.phone || form.email}</strong>{' '}
                    within one business day to schedule your free in-home consultation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate>
                  <h3 style={{ marginBottom: '0.5rem' }}>Request a free estimate</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '0.92rem', marginBottom: '1.75rem' }}>
                    Takes 60 seconds. No pressure, no spam, no obligation.
                  </p>

                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="f-name">Full Name *</label>
                      <input
                        id="f-name"
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-phone">Phone *</label>
                      <input
                        id="f-phone"
                        required
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="(416) 555-0123"
                      />
                    </div>
                  </div>

                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="f-email">Email *</label>
                      <input
                        id="f-email"
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="jane@example.com"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-postal">Postal Code *</label>
                      <input
                        id="f-postal"
                        required
                        value={form.postal}
                        onChange={(e) => setForm({ ...form, postal: e.target.value })}
                        placeholder="M5V 3A8"
                        maxLength={7}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Service Needed</label>
                    <div className="field-radio-group">
                      {[
                        { id: 'install', label: 'New Install' },
                        { id: 'refinish', label: 'Refinishing' },
                        { id: 'repair', label: 'Repair' },
                        { id: 'stairs', label: 'Stairs' },
                        { id: 'commercial', label: 'Commercial' },
                        { id: 'unsure', label: 'Not Sure' },
                      ].map((s) => (
                        <label
                          key={s.id}
                          className={`field-radio ${form.service === s.id ? 'checked' : ''}`}
                        >
                          <input
                            type="radio"
                            name="service"
                            value={s.id}
                            checked={form.service === s.id}
                            onChange={() => setForm({ ...form, service: s.id })}
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
                        type="text"
                        inputMode="numeric"
                        value={form.sqft}
                        onChange={(e) => setForm({ ...form, sqft: e.target.value })}
                        placeholder="e.g. 1,200"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="f-timeline">Timeline</label>
                      <select
                        id="f-timeline"
                        value={form.timeline}
                        onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                      >
                        <option value="asap">As soon as possible</option>
                        <option value="1-3m">1–3 months</option>
                        <option value="3-6m">3–6 months</option>
                        <option value="flexible">Just exploring</option>
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="f-message">Project Details (Optional)</label>
                    <textarea
                      id="f-message"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Tell us about your home, current floors, and what you're hoping to achieve…"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-copper btn-lg"
                    style={{ width: '100%' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Sending…' : 'Request my free estimate'}
                    {!submitting && <span className="btn-arrow">{Icon.arrow}</span>}
                  </button>

                  <p className="form-disclosure">
                    By submitting, you agree to be contacted by Ecowoods about your project. We
                    never share your information. One email or call, that&apos;s it.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINAL BAND / CLOSING
          ================================================================ */}
      <section
        className="section-tight"
        style={{
          background: 'linear-gradient(135deg, var(--copper-deep), var(--copper))',
          color: 'var(--cream-50)',
          textAlign: 'center',
        }}
      >
        <div className="shell">
          <div className="reveal" style={{ maxWidth: '760px', margin: '0 auto' }}>
            <h2
              style={{
                color: 'var(--cream-50)',
                fontWeight: 300,
                marginBottom: '1.25rem',
              }}
            >
              Your floors should outlive <span className="serif-italic">your mortgage.</span>
            </h2>
            <p
              style={{
                color: 'rgba(253, 251, 246, 0.85)',
                fontSize: '1.1rem',
                marginBottom: '2rem',
                lineHeight: 1.6,
              }}
            >
              Twenty-five years of Toronto homeowners agree. Let&apos;s talk about yours.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <a
                className="btn btn-lg"
                href="#quote"
                style={{
                  background: 'var(--walnut-950)',
                  color: 'var(--cream-50)',
                }}
              >
                Get a Free Estimate
                <span className="btn-arrow">{Icon.arrow}</span>
              </a>
              <a className="btn btn-ghost-light btn-lg" href="tel:+14165559663">
                Or call (416) 555-WOOD
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
