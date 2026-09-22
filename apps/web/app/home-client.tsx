'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EstimateForm } from './components/EstimateForm';
import {
  BUSINESS_NAP,
  BUSINESS_ADDRESS_LINE,
  yearsInBusiness,
  REVIEW_PROFILES,
  PRIMARY_REVIEW_EVIDENCE,
  HOURS_LINE,
} from '@ecowoods/shared/constants';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { RotatingBackground } from './components/RotatingBackground';
import { TrilogyHero } from './components/TrilogyHero';
import { TRILOGIES } from '@/lib/trilogies';
import { getFilm, videoObjectsFor } from '@/lib/films';
import PricingSection from './components/PricingSection';
import { FloorAssembly } from './components/FloorAssembly';
import { HOME_ROTATION } from './data/rotator-slides';
import HeroRotator from './components/HeroRotator';
import { HERO_VARIANTS } from './data/hero-variants';
import SpecsCoverage from './components/SpecsCoverage';
import StandardDeck from './components/StandardDeck';
import TestimonialDeck from './components/TestimonialDeck';
import ProcessDeck from './components/ProcessDeck';
import ServiceTicker, { type TickerItem } from './components/ServiceTicker';
import { JobCardRail } from './components/JobCard';
import { PROJECTS, interiors, stillById, storyboardFramesFor } from '@/lib/projects';
import { StoryboardHover } from './components/motion';
import { jobCardsBySlug } from '@/content/job-cards';
import { SERVICE_AREAS } from '@/lib/seo-data';
import {
  SCREEN_RECOAT,
  FULL_SAND_FINISH,
  NEW_INSTALL,
  formatBandBare as bandBare,
} from '@/content/constants/pricing';

/**
 * idleImport — defers a dynamic() chunk's fetch/parse/hydrate to browser
 * idle time, client-side only.
 *
 * On the SERVER this resolves the import immediately — `window` does not
 * exist during SSR, so the SSR HTML this produces is byte-identical to what
 * a plain `import()` would have produced. That is the whole safety argument:
 * nothing about WHAT gets server-rendered changes, only WHEN the browser
 * fetches the client chunk that hydrates it. The already-painted HTML (from
 * SSR, before any JS runs) sits there unchanged until that chunk arrives —
 * no flash, no re-render, no risk of a hydration mismatch, because the DOM
 * this hydrates onto was never different from what React expects.
 *
 * `requestIdleCallback` is not in Safari; `setTimeout` is the documented
 * fallback MDN itself recommends, so a Safari visitor gets "after one paint
 * cycle" instead of "after the main thread is actually free," not "never."
 */
function idleImport<T>(loader: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return loader();
  return new Promise((resolve) => {
    const run = () => loader().then(resolve);
    if ('requestIdleCallback' in window) {
      (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
    } else {
      setTimeout(run, 200);
    }
  });
}

// Heavy, below-the-fold, interactive tools with no indexable text: load them in
// their own client chunks (ssr:false) so they never block first paint. The
// fallbacks reserve height so nothing shifts when they hydrate in (CLS = 0).
const BookingPanel = dynamic(() => idleImport(() => import('./components/BookingPanel')), {
  ssr: false,
  loading: () => <div aria-hidden="true" style={{ minHeight: 420 }} />,
});

/**
 * P2.5 — THE LIBRARY IS DEFERRED, NOT DELETED.
 *
 * Three of the heaviest client islands on this page sit below the fold, after
 * the price, the proof and the form: a twelve-floor gallery with a lightbox, a
 * machine catalogue, and an eight-slide figure rotator. Statically imported,
 * every byte of all three was in the initial chunk a phone had to download
 * before the hero could become interactive — paid for by every visitor,
 * including the one who called the number and never scrolled.
 *
 * `ssr: true` is the whole point and is NOT the default people reach for. The
 * markup still renders on the server, so every caption, alt attribute and
 * figure label is in the HTML a crawler and an answer engine read. Only the
 * JavaScript is split into its own chunk and fetched after the critical path.
 * Deferring the content instead of the code would trade a performance win for
 * the indexable corpus this whole site is built on, which is not a trade worth
 * making at any speed.
 */
import { ProofSlider } from './components/ProofSlider';
import { PROOF_PLATES, HOMEPAGE_PLATE } from '@/content/proof-sliders';

const FloorCatalog = dynamic(() => import('./components/FloorCatalog'), { ssr: true });
const MachineCatalog = dynamic(() => import('./components/MachineCatalog'), { ssr: true });
const FigureRotator = dynamic(
  () => import('./components/FigureRotator').then((m) => m.FigureRotator),
  { ssr: true },
);
/* FilmStage joins the same split for the same reason: below the fold, real
   content SSR must keep (a chapter's caption and title are indexable text,
   same as a diagram's alt text), and its own JS — the chapter-switching
   state, the click-to-play handler — has no reason to be in the bundle a
   phone parses before the hero is interactive.

   NOT wrapped in idleImport, unlike BookingPanel above — measured, not
   assumed. Gating all four of FloorCatalog/MachineCatalog/FigureRotator/
   FilmStage behind requestIdleCallback clustered their hydration into one
   burst instead of the natural, spread-out fetch timing plain dynamic()
   chunks already get: a mobile Lighthouse trace showed the shared React
   chunk's script-evaluation time jump from ~1.4s to ~8s once all four
   waited on the same idle callback, which cost more than it saved and left
   LCP unmoved. content-visibility: auto (globals.css EW:P3-PERF) is the
   fix that measured clean — it removes the Style & Layout cost for
   off-screen sections without touching when hydration happens — so these
   three keep their original, already-working ssr:true split, and only
   BookingPanel (ssr:false, a modal nothing else on the page depends on)
   keeps the idle gate. */
const FilmStage = dynamic(() => import('./components/FilmStage').then((m) => m.FilmStage), {
  ssr: true,
});
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
/**
 * Only figures with a published source stand in front of a customer.
 *
 * To add a stat: put the real number here AND record where it came from
 * (job book export, platform screenshot) in the comment. `pnpm verify:facts`
 * keeps retired figures from reappearing.
 */
type TrustStat = { to: number; lbl: string; em?: string; decimals?: number; unit?: string };

const trustStats: TrustStat[] = [
  { to: yearsInBusiness(), em: '+', lbl: 'Years in Toronto' },
];


/**
 * EMPTY ON PURPOSE — do not repopulate with written-for-the-site copy.
 *
 * This array previously held three testimonials attributed to named customers
 * ("Sarah M. · Rosedale", "Andrew B. · Scarborough", "Jennifer L. · Forest
 * Hill") in specific Toronto neighbourhoods. None of them came from a real
 * customer. Publishing invented reviews attributed to real-sounding people is
 * a Competition Act problem in Canada, not merely a tone problem.
 *
 * TO RESTORE — each entry needs, on file:
 *   1. the review text as the customer actually wrote it;
 *   2. the platform + permalink it was published on (Google / HomeStars / Houzz);
 *   3. the customer's consent to reproduce it on ecowoods.ca.
 *
 * The #reviews section below renders the deck when this array has entries, and
 * an honest references-on-request block when it is empty. Nothing else to change.
 */
const featuredReviews: Review[] = [];

/** Only set once a real profile URL is confirmed — see PROFILE_LINKS. */
const homestarsUrl = REVIEW_PROFILES.find((p) => p.label === 'HomeStars')?.href;

const standardPillars: Pillar[] = [
  {
    icon: 'shield',
    title: 'Manufacturer-Backed',
    proof: 'Premium finishes carry 25–35 year manufacturer warranties, structural to 50 — passed straight through to you, in writing.',
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
    proof: 'Your written estimate is the price you pay. HEPA-sealed extraction at the machine, containment at the room.',
  },
];

/**
 * Service ticker — the work this company does, shown exchange-style.
 *
 * A "⚠️ PLACEHOLDER FIGURES — replace before this ships" warning used to stand
 * here, above the comment that already records those figures being removed.
 * The warning outlived the problem: there is nothing left to replace, and a
 * standing warning about a fixed defect trains the next reader to skim past
 * the ones that are still real.
 */
/**
 * Labels only. The previous 34/28/14/10/8/6 "share of project mix" figures were
 * invented and were published live — a prospect could reasonably read them as
 * audited business data. `share` is optional on TickerItem, so omitting it
 * renders the plain label marquee (identical to the GTA service-areas ticker).
 *
 * To restore percentages: supply real shares from the job book and add the
 * source in this comment. Do not estimate them.
 */
const serviceTicker: TickerItem[] = [
  { label: 'Hardwood Installation' },
  { label: 'Refinishing & Restoration' },
  { label: 'Dust-Free Sanding' },
  { label: 'Stairs & Railings' },
  { label: 'Custom Inlays & Borders' },
  { label: 'Commercial Projects' },
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
    line: 'Salaried master craftsmen. No subcontractors — ever. HEPA-sealed containment at every machine.',
  },
  {
    num: '04',
    icon: 'shield',
    title: 'Warranties in Writing',
    line: 'Manufacturer finish and structural warranties — 25 to 50 years — documented in your contract, not just promised.',
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
    a: 'Yes. Containment is HEPA-sealed Festool and Bona Atomic extraction at the machine plus containment at the room. We do not publish a room-capture percentage, because we have not measured one on a job. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.',
  },
  {
    q: 'What warranty comes with the work?',
    a: 'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — and we pass every one through to you in writing, itemized in your contract. If anything in our workmanship isn\'t right, we come back and make it right. No runaround.',
  },
  {
    q: 'How long will my project take?',
    a: 'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining, and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.',
  },
  // Verbatim from FAQ_ITEMS in lib/seo-data.ts. The first draft of these three
  // reworded the same questions, which is precisely the divergence
  // verify-schema exists to catch: two files answering one question differently
  // is two answers a crawler has to choose between.
  {
    q: 'How much does hardwood flooring cost in Toronto?',
    a: `Installed ranges typically run about ${bandBare(NEW_INSTALL)} per sq ft for new hardwood, ${bandBare(FULL_SAND_FINISH)} for full sand and finish, and ${bandBare(SCREEN_RECOAT)} for a screen and recoat — before stairs, transitions, or moisture remediation. Species, pattern, and substrate move the number. The fixed price is written after a free in-home measure, not from a phone quote.`,
  },
  {
    q: 'What is dustless hardwood refinishing, and does it work in an occupied home?',
    a: 'Dustless means HEPA-sealed extraction at the machine and containment at the room — not a marketing label. We publish no room-capture percentage, because we have not measured one on a Toronto job; a filter rating is not a room measurement and the two get quoted as though they were the same number. Most refinishing clients sleep at home every night of the job. Water-based finishes are low-odour and walk-on ready in 2–4 hours.',
  },
  {
    q: 'Solid or engineered hardwood — which should I install?',
    a: 'The substrate decides, not the budget. Plywood over joists can take solid; concrete slabs, radiant heat, and wide humidity swings favour engineered. A generational wear layer only matters where solid is structurally allowed. Walk the solid-vs-engineered guide before you buy material.',
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


/* ---------------------- Trilogy photo set ---------------------- */

/**
 * The homepage hero backdrop: slugs 1–3 only (the "hero" kind trilogies),
 * all three frames each, in slug order — nine frames total, cycling
 * room → approach → fingertip, three times over. See TrilogyHero's own doc
 * comment for why this replaces the old single-image HeroBackdrop safely.
 */
const HOME_HERO_SLUGS = ['salon-dark-oak-chandelier', 'salon-fireplace-continuous-floor', 'geometric-parquet-french-doors'];
const HOME_HERO_FRAMES = HOME_HERO_SLUGS.flatMap((slug) => TRILOGIES.find((t) => t.slug === slug)?.frames ?? []);

/**
 * The below-fold "Work" rail — six real jobs, Frame 1 only (no rotation; the
 * full trilogy lives one click away on each job's own page). Picked for
 * variety across the set's kinds (stairs, inlay, commercial, residential,
 * grand) rather than showing all twenty, which is the "dump the library on
 * the homepage" mistake the brief explicitly rules out.
 */
const WORK_RAIL_SLUGS = [
  'curved-oak-iron-balustrade',
  'floral-medallion-inlay',
  'rickis-storefront',
  'loft-kitchen-light-strip',
  'paneled-oval-room-herringbone',
  'foyer-oak-treads-iron',
];
const WORK_RAIL_TRILOGIES = WORK_RAIL_SLUGS.map((slug) => TRILOGIES.find((t) => t.slug === slug)).filter(
  (t): t is NonNullable<typeof t> => Boolean(t),
);

/**
 * Photographed jobs strip — every entry in PROJECTS, not the twenty
 * trilogies. Deliberately separate rail: a Project (this repo's chapters +
 * honest pairs record) is a different kind of proof than a three-frame
 * trilogy, and mixing them would blur the distinction /projects/[slug]
 * itself exists to keep. A cover-still override is only for cases where the
 * default (the second chapter's first interior) is not the strongest frame —
 * the stone cottage's own exterior reads better as a cover than an interior.
 */
const HOME_PROJECT_COVER_OVERRIDE: Record<string, string> = {
  'stone-cottage-strip-refinish': 'ch2-01',
  'maple-glass-residence': 'ch1-15',
};

/** Series II, chapter 1 — the homepage gets exactly one film, per the brief. */
const THE_BRIEF = getFilm('the-brief')!;

/* ---------------------- Page ---------------------- */
export default function HomePage({ contentPromo }: { contentPromo?: ReactNode }) {
  const root = useReveal();

  /* ---------- FAQ state ---------- */
  /* The legacy estimate MODAL is gone, and with it react-hook-form, zod
     resolver, react-query and the toast stack it shipped to every homepage
     visitor. It was unreachable — nothing ever set `estimateModalOpen` to
     true — and the real, no-JS-safe form (EstimateForm, F-160) has owned the
     conversion since. Dead UI that still hydrates is a payload, not a
     feature. */
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div ref={root as React.MutableRefObject<HTMLDivElement>}>
      {/* FAQPage structured data — built from faqItems (one source of truth) so
          Google shows FAQ rich results and AI agents can quote the answers. */}
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
      {/* VideoObject per chapter of the one film this page mounts. */}
      {videoObjectsFor(THE_BRIEF).map((v) => (
        <script
          key={v.contentUrl}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(v) }}
        />
      ))}
      {/* 1 · HERO — minimalist authority.
          P0.4: NO AUTOPLAY. The background is one static image with
          fetchpriority="high" and a responsive srcset; the copy is the single
          canonical variant — no timers, no decode, and the H1 text is real,
          exposed text in the accessibility tree. */}
      <section className="hero" id="hero">
        <div className="hero-bg" aria-hidden="true" />
        <TrilogyHero frames={HOME_HERO_FRAMES} />
        <div className="shell hero-content">
          <HeroRotator
            variants={[HERO_VARIANTS[0]!]}
            ctaHref="#quote"
            ctaLabel="Get a fixed price in writing"
            ctaArrow={Icon.arrow}
            secondaryHref="#photo-triage"
            secondaryLabel="Send 3 photos today"
          />

          {/* F-205 — THE STAT DOES NOT ROTATE AND DOES NOT ANIMATE.
              It used to render through the CountUp component, which published
              three times in the DOM (hidden sizer + live value + .sr-only
              copy). Concatenated, ecowoods.ca served `26026+ Years in Toronto`
              in its server HTML and `262626+` after the roll finished — the
              one number in the hero, on the site whose whole strategy is being
              quotable by machines. One value, one text node, derived from
              BUSINESS_NAP.foundedYear so it cannot go stale in January. */}
          <div className="hero-stats reveal" data-delay="4">
            {trustStats.map((s) => (
              <div className="hero-stat" key={s.lbl}>
                <div className="val">
                  <span className="hero-stat-num">{`${s.to}${s.unit ?? ''}`}</span>
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

      {/* 1b · WORK RAIL — six real jobs, all three frames. Hover scrubs
             room → approach → fingertip on desktop; leave restores frame
             01. Every card still links to that job's own story — this row
             does not claim to be the whole set, /library is. */}
      <section className="section-tight" aria-label="Recent work">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Recent work</span>
            <h2>
              Six jobs, <span className="serif-italic">not stock.</span>
            </h2>
          </div>
          <div className="work-rail reveal">
            {WORK_RAIL_TRILOGIES.map((t) => (
              <Link key={t.slug} href={`/projects/${t.slug}`} className="work-rail-card">
                <span className="work-rail-media">
                  <StoryboardHover
                    frames={t.frames}
                    sizes="(max-width: 767px) 90vw, (max-width: 1100px) 45vw, 30vw"
                  />
                </span>
                <span className="work-rail-kicker">{t.kicker}</span>
                <span className="work-rail-title">{t.headline}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 1c · JOBS, PHOTOGRAPHED — the Project records (chapters + honest
             before/after pairs), separate from the trilogy work rail above.
             Two cards today; PROJECTS.map means a third registered project
             appears here with no further edit. */}
      <section className="section-tight" aria-label="Jobs, photographed">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">Jobs, photographed</span>
            <h2>
              Full chapters, <span className="serif-italic">not one frame.</span>
            </h2>
          </div>
          <div className="pj-index reveal">
            {PROJECTS.map((p) => {
              const overrideId = HOME_PROJECT_COVER_OVERRIDE[p.slug];
              const cover = (overrideId && stillById(p, overrideId)) || interiors(p, 2)[0] || interiors(p)[0]!;
              const frames = storyboardFramesFor(p, cover);
              return (
                <article key={p.slug} className="pj-card">
                  <Link href={`/projects/${p.slug}`} className="pj-card-link">
                    <div className="pj-plate" style={{ aspectRatio: `${cover.width} / ${cover.height}` }}>
                      <StoryboardHover frames={frames} sizes="(max-width: 767px) 92vw, 46vw" />
                    </div>
                    <h3 className="pj-card-title">{p.title}</h3>
                  </Link>
                  <p className="tlx-note pj-note">
                    {p.location.neighbourhood}, {p.location.city} ·{' '}
                    {p.stills.filter((s) => s.role === 'interior').length} photographs
                  </p>
                </article>
              );
            })}
          </div>
          <p className="tlx-note">
            <Link href="/projects">All photographed jobs →</Link>
          </p>
        </div>
      </section>

      {/* 2 · DUAL CTA — the two ways to start, stated in one breath. */}
      <section className="section-tight home-cta" id="start">
        <div className="shell">
          <div className="home-cta-inner reveal">
            <h2 className="home-cta-h">
              Get a fixed price in writing — <span className="serif-italic">or send 3 photos today.</span>
            </h2>
            <p className="home-cta-sub">
              HEPA-sealed sanding. Salaried crew. The number on the page is the number on the invoice.
            </p>
            <div className="home-cta-actions">
              <a className="btn btn-copper btn-lg" href="#quote">
                Get a fixed price in writing
              </a>
              <a className="btn btn-ghost btn-lg" href="#photo-triage">
                Send 3 photos today
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* MOST SEARCHED (P1.5) — the intent pages, named in the words people
          type, directly under the CTA. These six URLs are the commercial
          canonicals in content/search/topic-map.ts; before this the homepage
          reached them only through the mega-menu and the footer, which is a
          weak internal link from the page that carries the most authority on
          the site. Two of them — /commercial and /realtors — answer questions
          the homepage never acknowledged were being asked. */}
      <section className="section-tight most-searched" aria-label="Most searched">
        <div className="shell">
          <p className="ms-kicker">Most searched</p>
          <ul className="ms-list">
            <li><Link href="/hardwood-floor-refinishing-toronto">Hardwood floor refinishing in Toronto</Link></li>
            <li><Link href="/hardwood-flooring-toronto">Hardwood flooring installation in Toronto</Link></li>
            <li><Link href="/services/dust-free-sanding">Dust-free floor sanding</Link></li>
            <li><Link href="/hardwood-stairs-toronto">Hardwood stairs</Link></li>
            <li><Link href="/hardwood-floor-problems-toronto">Why is my floor cupping, gapping or peeling?</Link></li>
            <li><Link href="/guides/hardwood-flooring-cost-toronto">What hardwood flooring costs in Toronto</Link></li>
            <li><Link href="/commercial">Condo boards &amp; property managers</Link></li>
            <li><Link href="/realtors">Refinishing before a listing</Link></li>
          </ul>
        </div>
      </section>

      {/* 3 · THE NUMBER — the three published bands, before anything asks for
             a click. Every figure derives from content/constants/pricing.ts. */}
      <PricingSection />

      {/* 3a · WHAT THE PRICE IS BUYING (VIS-05).
             Directly after the bands, because the question a person has the
             moment they read a price is what is actually in it. Five layers,
             exploded, in the real photographed grain of whichever species they
             pick — and each one carrying the question to put to whoever is
             quoting them. Nothing here is a claim about a job: it is how
             hardwood floors are built. See components/FloorAssembly.tsx for
             why the moving part contains no text (F-205) and why this is not
             the hero (P0.4). */}
      <FloorAssembly />

      {/* 4a · THE FLOOR ITSELF, BEFORE AND AFTER.
             The JobCardRail below is typographic on purpose — no stock
             photography, no customer names without a consent record. This does
             not weaken that: the frames are generated illustrations of the KIND
             of work, registered as such, and the caption names a job type
             rather than an address. It sits above the cards because a buyer
             asks "what does it look like" before "what did you measure", and
             until now this page answered the second question first. */}
      <section className="section-tight" aria-label="Before and after">
        <div className="shell">
          <ProofSlider plate={PROOF_PLATES[HOMEPAGE_PLATE]} />
        </div>
      </section>

      {/* 4 · FIRST-PARTY PROOF — three finished jobs, in the units they were
             measured in. Every field is copied from a published case study and
             held there by scripts/verify-job-cards.mjs, so the card on the
             busiest page of the site cannot drift from the document that
             proves it. No stock photography, no customer names we have no
             consent record for. */}
      <JobCardRail
        kicker="Finished work"
        heading="Three Toronto jobs, checkable in full"
        intro="Neighbourhood, size, substrate, species, and one reading each. Nobody writes an MVTR figure who did not take it."
        jobs={jobCardsBySlug(
          'midtown-townhouse-three-level-transition',
          'forest-hill-walnut-wide-plank-color-stability',
          'yorkville-loft-basement-conversion-moisture-mitigation',
        )}
        from="homepage"
      />

      {/* 5 · TRUST RAIL — the claims the rest of the site substantiates, one
             line each, every number derived from its source module. */}
      <section className="section-tight trust-rail-section" aria-label="Why homeowners choose Ecowoods">
        <div className="shell">
          <ul className="trust-rail reveal">
            <li>{yearsInBusiness()}+ years in Toronto</li>
            <li>
              <a href={PRIMARY_REVIEW_EVIDENCE.href} target="_blank" rel="noopener noreferrer">
                {PRIMARY_REVIEW_EVIDENCE.count} reviews at {PRIMARY_REVIEW_EVIDENCE.rating.toFixed(1)} on HomeStars
              </a>{' '}
              <span className="trust-rail-asof">(read {PRIMARY_REVIEW_EVIDENCE.asOf})</span>
            </li>
            <li>Salaried craftsmen, never subcontractors</li>
            <li>HEPA-sealed sanding</li>
            <li>Fixed price in writing</li>
            <li>FSC-certified wood · GreenGuard Gold finishes</li>
          </ul>
        </div>
      </section>

      {/* 6 · CONVERSION — moved UP from the bottom of the page (P0.4): the
             form is now reachable without scrolling through the library. */}
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
              <a href={BUSINESS_NAP.phoneHref} className="quote-contact">
                <span className="quote-contact-icon">{Icon.phone}</span>
                <span className="quote-contact-text">
                  <span className="quote-contact-label">Prefer to talk?</span>
                  <span className="quote-contact-num">{BUSINESS_NAP.phoneDisplay}</span>
                  <span className="quote-contact-when">{HOURS_LINE}</span>
                </span>
              </a>
              <p className="quote-showroom" style={{ color: 'rgba(245, 239, 230, 0.65)' }}>
                Shop and warehouse in Etobicoke — we come to you. {BUSINESS_ADDRESS_LINE}.
              </p>

              {/* Two-track lead capture (P0.5). The wrapper id is the anchor the
                  sticky header's “Send photos” CTA scrolls to; the form itself
                  switches to the photo track when that hash is present. */}
              <div id="photo-triage">
                <EstimateForm
                  source="homepage"
                  className="ef--onDark"
                  heading="Request a free estimate"
                  intro="A senior estimator replies within one business day. Book the measure — or send three photos and we triage the job first."
                />
              </div>
            </div>

            {/* Right column: the booking calendar (inline on desktop, sheet on mobile) */}
            <BookingPanel clockIcon={Icon.clock} />
          </div>
        </div>
      </section>

      {/* 5 · RESULTS — curated proof */}
      <section className="section" id="gallery">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">The Collection</span>
            <h2>
              Twelve floors, <span className="serif-italic">endless rooms.</span>
            </h2>
            <p>The species and finishes we install across the GTA — tap any floor to see the grain up close and the room it belongs in.</p>
          </div>

          <FloorCatalog />
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
              Installation, refinishing, sanding, stairs, inlays, and commercial — every service,
              one shop, one accountable name — since {BUSINESS_NAP.foundedYear}.
            </p>
          </div>

          <StandardDeck items={standardPillars} icon={Icon} />

          <ServiceTicker items={serviceTicker} tone="dark" />
        </div>
      </section>

      {/* THE DETAIL — moved up so on-page order matches the nav (Species → Gallery). */}
      {/* SpecsCoverage ("The Detail") intentionally hidden — kept for later.
          Re-enable by uncommenting the next line. */}
      {/* <SpecsCoverage species={speciesList} areas={serviceAreas} /> */}

      {/* THE NUMBER moved again (P0.4): it now sits directly under the hero's
             dual CTA, before the first scroll. See audit/FINDINGS.md F-55 for
             the first move; the argument only got stronger. */}

      {/* 3b · WHAT WE CAN EXPLAIN — the corpus, shown rather than linked.

          The site publishes three technical papers, eleven guides, a 32-term
          glossary and a versioned installation standard, and a visitor who came
          for a price had to click into /resources to discover any of it. Eight
          figures rotating here make the same argument in twenty seconds without
          asking anyone to click first: this company can explain moisture
          differential, the four-machine sequence and what cupping actually is.

          Every slide is in the DOM, so a crawler reads all eight captions and
          the alt text whether or not it runs the timer. */}
      <section className="section" id="explained">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">The Science</span>
            <h2>
              What we can <span className="serif-italic">explain.</span>
            </h2>
            <p>
              Every figure below is published on this site, free to read and free to cite.
            </p>
          </div>

          <FigureRotator slides={HOME_ROTATION} label="What we can explain" />
        </div>
      </section>

      {/* 4 · HOW IT WORKS — 4-step funnel */}
      <section className="section" id="process">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">The Process</span>
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

      {/* THE CRAFT — educational machine & tool gallery */}
      <section className="section section--tint" id="craft">
        <div className="shell">
          <div className="section-head reveal">
            <span className="eyebrow">The Craft</span>
            <h2>
              The machines behind <span className="serif-italic">the finish.</span>
            </h2>
            <p>
              Every Ecowoods floor is built with professional-grade equipment run by our own salaried
              craftsmen. Here is the gear behind a dust-free, fixed-price floor — and exactly what each
              one does. Tap any tool to see it in use.
            </p>
          </div>

          <FilmStage film={THE_BRIEF} defaultChapter={1} />
          <p className="tlx-note">
            <Link href="/services/dust-free-sanding">How dust-free sanding works →</Link>
          </p>

          <MachineCatalog />
        </div>
      </section>

      {/* 5b · SEE IT IN YOUR ROOM — Floor Studio first, the configurator second.

             The order matters and it is the whole argument. "Design your floor"
             asks a visitor to imagine; Floor Studio shows them. A homeowner who
             has watched a real white oak herringbone appear in a photograph of
             their own living room is a different person from one who has moved
             three sliders, and the second CTA is there for the minority who
             arrive already knowing what they want. Both surfaces share one
             catalogue and one pricing function, so neither can contradict the
             other. */}
      <section className="section-tight" id="design">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '640px' }}>
            <span className="eyebrow">Floor Studio</span>
            <h2>
              Don’t imagine your new floor. <span className="serif-italic">See it.</span>
            </h2>
            <p>
              Point your phone at the room and the floor changes while you move — species, finish,
              pattern and board width, with the installed range updating as you go. Or upload a
              photo. Either way it runs on your own device: nothing is uploaded, and every floor
              you see is one we can actually supply and install.
            </p>
            {/* Two doors into one thing, and the live one leads because it is the
                one people have never seen before. Both land on /floor-studio;
                the fragment is what opens the camera (LIVE-01). */}
            <Link href="/floor-studio#live" className="btn btn-copper">
              Point your camera at the room <span aria-hidden>→</span>
            </Link>
            <Link href="/floor-studio" className="btn btn-ghost">
              Or start from a photo
            </Link>
            <p>
              Already know the specification?{' '}
              <Link href="/design">Open the full floor designer</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* 2 · PROOF & AUTHORITY */}
      <section className="section section--tint" id="reviews">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '780px' }}>
            <span className="eyebrow">The Verdict</span>
            <h2>
              What clients say <span className="serif-italic">after move-in day.</span>
            </h2>
            <p>
              Our reviews live on HomeStars, where we cannot edit them. We would rather send you
              there than reprint the flattering ones here.
            </p>
          </div>

          {featuredReviews.length > 0 ? (
            <TestimonialDeck items={featuredReviews} star={Icon.star} />
          ) : (
            /* Shown while featuredReviews is empty — see the note on that array.
               References from real jobs beat a curated quote wall anyway. */
            <div className="reveal" style={{ maxWidth: '620px' }}>
              <p style={{ marginBottom: '1.5rem' }}>
                Ask on your estimate visit and we will put you in touch with recent clients on your
                street or in your neighbourhood — people who have lived on the floor for a season,
                not just admired it on install day.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {homestarsUrl && (
                  <a
                    href={homestarsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-copper"
                  >
                    Read our HomeStars reviews <span aria-hidden>→</span>
                  </a>
                )}
                <a href={BUSINESS_NAP.phoneHref} className="btn btn-ghost">
                  Call {BUSINESS_NAP.phoneDisplay}
                </a>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* Objection-handling FAQ — directly above the conversion moment */}
      <section className="section" id="faq">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Straight Answers</span>
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

      {/* 5c · CONTENT LIBRARY — for the researcher, after the price is on the
             table. Two article cards; never a detour before the ask. */}
      {contentPromo}

      {/* 7 · WHERE WE WORK — every published service-area page, linked. The
             quote form asks for one of these 32; the crawler gets the edges. */}
      <section className="section-tight" id="areas" aria-label="Service areas">
        <div className="shell">
          <div className="section-head reveal" style={{ maxWidth: '720px' }}>
            <span className="eyebrow">Where we work</span>
            <h2>
              Across Toronto <span className="serif-italic">and the GTA.</span>
            </h2>
          </div>
          <p className="areas-links reveal">
            {SERVICE_AREAS.map((c, i) => (
              <span key={c.slug}>
                {i > 0 && ' · '}
                <Link href={`/service-areas/${c.slug}`}>{c.name}</Link>
              </span>
            ))}
          </p>
        </div>
      </section>
    </div>
  );
}
