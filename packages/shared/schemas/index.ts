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
