/**
 * seo-data.ts — single source of truth for programmatic SEO.
 * Cities, services and FAQs used by the sitemap, the /service-areas pages,
 * the JSON-LD builders and llms.txt. Keep business facts here in sync with
 * lib/structured-data.ts (NAP) and the homepage FAQ.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecowoods.ca';

export const BUSINESS = {
  name: 'Ecowoods Hardwood Flooring',
  phone: '+1-416-249-1276',
  phoneDisplay: '(416) 249-1276',
  email: 'services@ecowoods.ca',
  region: 'Toronto & the GTA',
  address: {
    streetAddress: '32 Norfield Crescent',
    addressLocality: 'Toronto',
    addressRegion: 'ON',
    postalCode: 'M9W 1X6',
    addressCountry: 'CA',
    latitude: 43.72085,
    longitude: -79.57542,
  },
} as const;

export type City = { slug: string; name: string };

const AREAS = [
  'Downtown Toronto', 'North York', 'Etobicoke', 'Scarborough', 'East York', 'York',
  'Vaughan', 'Markham', 'Richmond Hill', 'Mississauga', 'Oakville', 'Brampton',
  'Aurora', 'Newmarket', 'Pickering', 'Ajax',
];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const CITIES: City[] = AREAS.map((name) => ({ slug: slugify(name), name }));
export const cityBySlug = (slug: string): City | undefined => CITIES.find((c) => c.slug === slug);

export type Service = { slug: string; name: string; blurb: string };

export const SERVICES: Service[] = [
  { slug: 'hardwood-installation', name: 'Hardwood Flooring Installation', blurb: 'Solid and engineered hardwood laid by salaried craftsmen — straight-lay, herringbone, chevron and custom patterns.' },
  { slug: 'floor-refinishing', name: 'Hardwood Floor Refinishing', blurb: 'Bring tired floors back to life: sand to bare wood, re-stain and re-finish for a factory-fresh surface.' },
  { slug: 'dust-free-sanding', name: 'Dust-Free Floor Sanding', blurb: 'HEPA-sealed containment captures ~99.7% of airborne dust at the source, so most clients stay home during the work.' },
  { slug: 'floor-restoration', name: 'Hardwood Floor Restoration', blurb: 'Rescue and repair heritage and water-damaged floors — board replacement, feathering and colour matching.' },
  { slug: 'custom-inlays', name: 'Custom Inlays & Borders', blurb: 'Bespoke feature strips, medallions and borders routed and fitted by hand for a signature look.' },
  { slug: 'stair-refinishing', name: 'Stair Refinishing', blurb: 'Treads, risers and nosings refinished to match your floors for a seamless, hard-wearing finish.' },
];

export type FaqItem = { q: string; a: string };

// Mirror of the homepage FAQ — kept here so it can be emitted as FAQPage JSON-LD
// on every page. Keep in sync with app/page.tsx faqItems.
export const FAQ_ITEMS: FaqItem[] = [
  { q: 'Is the estimate really fixed? What about "unforeseen conditions"?', a: 'Yes — fixed, in writing, in your contract. Our senior estimator moisture-tests your subfloor and inspects conditions during the free consultation, so there are no "unforeseen conditions" to surprise you later. The number on paper is the number on your invoice.' },
  { q: 'Can we stay in the house during the work?', a: 'Yes. Our dust containment captures roughly 99.7% of airborne particulate at the source using HEPA-sealed systems. Most refinishing clients sleep at home every night of the job, and our water-based finishes are low-odour and walk-on ready in 2–4 hours.' },
  { q: 'What warranty comes with the work?', a: 'Your finishes and materials carry their manufacturer warranties — typically 25–35 years on finish, up to 50 years structural — passed through to you in writing, itemized in your contract. If anything in our workmanship isn\u2019t right, we come back and make it right.' },
  { q: 'How long will my project take?', a: 'A standard 1,000–1,500 sq ft installation takes 5 to 7 working days: moisture testing and acclimation, installation, then sanding, staining and finishing. Refinishing is typically 3–5 days. Your written estimate includes a committed schedule.' },
];

// ── City-specific content ──────────────────────────────────────────────────
// The differentiator that lifts a service-area page above thin/doorway
// suppression. A city with an entry here renders a distinct local section;
// a city WITHOUT one falls back to the generic page (no breakage).
// EVERY field must be REAL — invented detail is worse than none.
export type CityContent = {
  intro: string;                 // 2-3 sentences of genuinely local context
  neighbourhoods: string[];      // real areas you work in
  housingNote: string;           // real housing-stock / subfloor reality for this area
  signatureProject?: string;     // one real job: area (not exact address), species, what you did
  localConsideration?: string;   // a genuine practical factor specific to this area
};

export const CITY_CONTENT: Record<string, CityContent> = {
  "downtown-toronto": {
    intro:
      "Hardwood work downtown means concrete-slab condos, converted industrial lofts, and surviving pre-war stock under heavy density pressure. Most jobs are either carpet-to-hardwood conversions over concrete, which demand precise underlayment and moisture control, or aggressive refinishing of original floors worn down by decades of tenants, pets, and previous over-sanding. Dust containment, elevator logistics, and building-management coordination decide who finishes clean and who gets locked out.",
    neighbourhoods: ["King West", "Entertainment District", "St. Lawrence Market", "Fashion District loft conversions"],
    housingNote:
      "Much of the 1980s-to-early-2000s condo stock still carries original light parquet or thin strip hardwood over concrete that was poorly finished the first time — often uneven, partially damaged, and sitting on slab that needs careful moisture testing and minimal-aggressive sanding to avoid compromising the substrate. The Victorian and Edwardian semis and row houses in the denser pockets frequently retain original 1900s-1920s pine or oak subfloors that need levelling and board replacement before any engineered or solid plank goes down.",
    signatureProject:
      "On a 102-year-old house in the east end, we refinished the original second-floor boards and the full staircase. The floors had rot in spots and scarring where interior walls had been removed; we repaired the damaged sections so the patches disappeared into the surrounding grain, then sanded and refinished the whole floor. The job was staged over weekends to keep the household running.",
    localConsideration:
      "Elevator booking and building rules are the real operational filter. Almost every downtown high-rise requires the service elevator to be booked in advance for material drop-off and debris removal — often narrow weekday windows only — with mandatory certificates of insurance, security deposits, and strict noise and dust cut-offs. Miss the window or fail the paperwork and the schedule collapses. Street parking is effectively unavailable during work hours and loading zones are policed hard, so access has to be planned before the first board arrives.",
  },
};

export const cityContent = (slug: string): CityContent | undefined => CITY_CONTENT[slug];
