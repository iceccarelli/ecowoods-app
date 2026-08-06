/* ---------------------- Business Facts (SINGLE SOURCE OF TRUTH) ----------------------
 *
 * Every customer-visible phone number, address, and year-in-business claim on
 * this site MUST come from here. Nothing gets hardcoded at a call site again.
 *
 * Why: the site, the JSON-LD schema and the outbound email templates had drifted
 * onto three different phone numbers. A lead who converted was emailed a number
 * that did not match the one they called.
 *
 * `pnpm verify:facts` fails the build if a banned literal reappears anywhere.
 */
export const BUSINESS_NAP = {
  legalName: 'Ecowoods Hardwood Flooring Inc.',
  name: 'Ecowoods Inc.',
  shortName: 'Ecowoods',

  /** E.164 — for schema.org, tel: hrefs and click-to-call. */
  phoneE164: '+16472445156',
  /** schema.org / microdata format. */
  phoneSchema: '+1-647-244-5156',
  /** Human-readable, for all customer-facing copy. */
  phoneDisplay: '(647) 244-5156',
  /** Ready-made href. */
  phoneHref: 'tel:+16472445156',

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

  /**
   * ⚠️ OWNER-CONFIRMED VALUE. Francisco states Ecowoods started in 2000.
   * The site previously published 1998 in some places and "27 years" /  (facts-allow)
   * "over 25 years" in others — three different claims, one of them  (facts-allow)
   * arithmetically stale. Change this one number if 1998 is correct;
   * every surface derives from it.
   */
  foundedYear: 2000,
} as const;

/** Whole years in business, derived. Never hardcode a year count in copy. */
export function yearsInBusiness(now: Date = new Date()): number {
  return now.getFullYear() - BUSINESS_NAP.foundedYear;
}

/** One-line address, used in document footers. */
export const BUSINESS_ADDRESS_LINE =
  `${BUSINESS_NAP.address.streetAddress}, ${BUSINESS_NAP.address.addressLocality}, ` +
  `${BUSINESS_NAP.address.addressRegion} ${BUSINESS_NAP.address.postalCode}`;

export const JOB_STATUSES = {
  PENDING: 'pending',
  BIDDING: 'bidding',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
 
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
 
export const ROUTES = {
  HOME: '/',
  JOBS: '/jobs',
  JOB_DETAIL: (id: string) => `/jobs/${id}`,
} as const;
 
/* ---------------------- Social & Review Links (Business Critical - Lead Gen & Social Proof) ---------------------- */
export const SOCIAL_LINKS = [
  { platform: 'Instagram', href: 'https://www.instagram.com/ecowoods.ca', label: 'Instagram' },
  { platform: 'Facebook', href: 'https://www.facebook.com/ecowoodshardwood', label: 'Facebook' },
  { platform: 'Houzz', href: 'https://www.houzz.com/pro/ecowoods', label: 'Houzz' },
  { platform: 'Google', href: 'https://www.google.com/maps?cid=ecowoods', label: 'Google Reviews' },
  { platform: 'LinkedIn', href: 'https://www.linkedin.com/company/ecowoods-hardwood-flooring', label: 'LinkedIn' },
  { platform: 'YouTube', href: 'https://www.youtube.com/@ecowoods', label: 'YouTube' },
  { platform: 'TikTok', href: 'https://www.tiktok.com/@ecowoods.hardwood', label: 'TikTok' },
  { platform: 'Pinterest', href: 'https://www.pinterest.com/ecowoods', label: 'Pinterest' },
  { platform: 'X', href: 'https://x.com/ecowoods', label: 'X' },
  { platform: 'WhatsApp', href: 'https://wa.me/16472445156?text=Hi%20Ecowoods%2C%20I%27d%20like%20a%20free%20estimate%20for%20hardwood%20flooring', label: 'WhatsApp' },
  { platform: 'Website', href: 'https://ecowoods.ca', label: 'Official Website' },
  { platform: 'Telegram', href: 'https://t.me/ecowoods', label: 'Telegram' },
] as const;
 
export type SocialLink = (typeof SOCIAL_LINKS)[number];
 
