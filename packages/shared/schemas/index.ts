import { z } from 'zod';

export const createJobSchema = z.object({
  woodType: z.string().min(2),
  size: z.string().min(1),
  timeframe: z.string().min(3),
  address: z.string().min(10),
  description: z.string().max(500).optional(),
});

export const createBidSchema = z.object({
  amount: z.number().positive(),
  estimatedDays: z.number().int().positive(),
  notes: z.string().max(300).optional(),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const leadSchema = z
  .object({
    name: z.string().min(2, 'Please enter your full name'),
    email: z.string().email('Please enter a valid email'),
    phone: z.string().min(7, 'Please enter a valid phone number'),
    postal: z.string().min(3, 'Please enter your postal code'),
    city: z.string().optional(),
    company: z.string().optional(),
    service: z.string().optional(),
    timeline: z.string().optional(),
    message: z.string().max(2000).optional(),
    source: z.string().optional(),
    // sqft comes in as a number (valueAsNumber) or NaN when left blank
    sqft: z.preprocess(
      (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
      z.number().positive().optional(),
    ),
  })
  .passthrough();

/**
 * Photo-triage lead — track B of the two-track quote form.
 *
 * The FILES are validated in the route (count/type/size live on the multipart
 * body, not on this object); this schema owns the typed fields. It is a
 * triage, not a quote: the disclaimer the UI shows is part of the product,
 * so `intent` deliberately includes 'not sure'.
 */
export const PHOTO_TRIAGE_INTENTS = ['refinish', 'install', 'stairs', 'not-sure'] as const;

export const photoTriageSchema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().min(7, 'Please enter a valid phone number'),
  area: z.string().min(2, 'Choose your area'),
  intent: z.enum(PHOTO_TRIAGE_INTENTS, {
    errorMap: () => ({ message: 'Tell us what the photos show' }),
  }),
  company: z.string().optional(), // honeypot
  source: z.string().optional(),
  designSummary: z.string().max(300).optional(),
  sqft: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : Number(v)),
    z.number().positive().optional(),
  ),
});

export type PhotoTriageData = z.infer<typeof photoTriageSchema>;

/**
 * Referral — two people, one of whom has not agreed to anything yet.
 *
 * The referred person's details are supplied by SOMEBODY ELSE. That is the
 * whole legal weight of this form: under CASL, a referral is a narrow,
 * single-message exemption and it depends on the referrer being real, being
 * named, and having an actual relationship with the person referred. So
 * `referrerConsent` is required — the referrer confirms they know this person
 * and that we may mention who sent us — and the route records it. No blind
 * address harvesting, and exactly one contact.
 */
export const referralSchema = z.object({
  referrerName: z.string().min(2, 'Please enter your full name'),
  referrerEmail: z.string().email('Please enter a valid email'),
  referrerPhone: z.string().min(7, 'Please enter a valid phone number'),
  friendName: z.string().min(2, "Please enter your friend's name"),
  friendContact: z.string().min(7, 'An email or phone number for your friend'),
  friendArea: z.string().optional(),
  note: z.string().max(1000).optional(),
  company: z.string().optional(), // honeypot
  /** The referrer confirms the relationship. Required — see the note above. */
  referrerConsent: z.literal('on', {
    errorMap: () => ({ message: 'Please confirm you know this person and are happy for us to say who referred them' }),
  }),
});

export type ReferralData = z.infer<typeof referralSchema>;

export type LeadFormData = z.infer<typeof leadSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateBidInput = z.infer<typeof createBidSchema>;


// ─────────────────────────────────────────────────────────────────
// APPOINTMENT SCHEDULING — in-home estimate booking
// One source of truth for client + server validation (defense in depth),
// matching the leadSchema conventions above.
// ─────────────────────────────────────────────────────────────────

/** Service options offered for an in-home estimate (value -> label handled in UI). */
export const APPOINTMENT_SERVICES = [
  'new-install',
  'refinishing',
  'dust-free-sanding',
  'stairs',
  'custom-inlays',
  'commercial',
] as const;

/** Payload the client sends to book a slot. `startsAt` is an ISO 8601 instant. */
export const appointmentSchema = z
  .object({
    startsAt: z
      .string()
      .datetime({ offset: true })
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a valid date and time'),
    name: z.string().min(2, 'Please enter your full name'),
    email: z.string().email('Please enter a valid email'),
    phone: z.string().min(7, 'Please enter a valid phone number'),
    postal: z.string().min(3, 'Please enter your postal code'),
    service: z.enum(APPOINTMENT_SERVICES, {
      errorMap: () => ({ message: 'Choose a service' }),
    }),
    sqft: z.preprocess(
      (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
      z.number().positive().optional(),
    ),
    notes: z.string().max(2000).optional(),
    source: z.string().optional(),
    // Honeypot — bots fill it, humans never see it. Must be empty.
    company: z.string().max(0).optional().or(z.literal('')),
  })
  .passthrough();

/** Query params for GET /api/availability — optional inclusive date range. */
export const availabilityQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});

export type AppointmentService = (typeof APPOINTMENT_SERVICES)[number];
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

// ─────────────────────────────────────────────────────────────────
// PILOT LEAD — FloorForge & other pilot programs
// ─────────────────────────────────────────────────────────────────

export const pilotLeadSchema = z
  .object({
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
    source: z.string().optional(),
    program: z.string().min(1, 'Program is required'),
  })
  .passthrough();

export type PilotLeadFormData = z.infer<typeof pilotLeadSchema>;
