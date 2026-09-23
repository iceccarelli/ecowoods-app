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

/**
 * Every field EstimateForm (measure track) and api-client's submitLead post,
 * named explicitly. Unknown keys are STRIPPED (zod's default) — this used to be
 * `.passthrough()`, which let a caller attach any key it liked and have it
 * logged, spread into the CRM webhook body and echoed by the route. A field the
 * form does not send is not a lead field.
 */
export const leadSchema = z.object({
  name: z.string().min(2, 'Please enter your full name').max(120),
  email: z.string().email('Please enter a valid email').max(254),
  phone: z.string().min(7, 'Please enter a valid phone number').max(40),
  postal: z.string().min(3, 'Please enter your postal code').max(20),
  city: z.string().max(80).optional(),
  /** Honeypot. The route rejects a non-empty value before validation runs. */
  company: z.string().max(200).optional(),
  service: z.string().max(80).optional(),
  timeline: z.string().max(80).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(120).optional(),
  /**
   * Floor Studio state, as the readable share code
   * (`c=white-oak.satin.herringbone.5&a=900&…`). Structured, not prose: the
   * estimating desk pastes it back into /floor-studio and sees exactly the
   * floor the visitor was looking at when they asked for the measure. Parsed
   * and validated by lib/floor-studio/studio-config.decodeStudioDesign; a code
   * naming a floor we do not lay resolves to nothing rather than to a guess.
   * It carries a configuration and an area. It never carries a photograph, a
   * price, or anything personal.
   */
  design: z.string().max(400).optional(),
  /**
   * MEAS-01 — the design's id, as its own field.
   *
   * `design` above cannot serve as one. It is deterministic: two strangers who
   * pick the same floor and the same area produce a byte-identical string, so
   * joining leads on it would merge unrelated people, and merge them harder
   * the better a floor sells. This is minted, random, and names a design
   * rather than a person.
   *
   * Shape is checked here as well as at the call site: 12 characters from
   * Crockford base32 (no i, l, o or u). Anything else is not something we
   * minted, and a `designId` that we did not mint joins to nothing, so it is
   * rejected rather than stored. Optional, because a lead from a phone call or
   * a service page has no design and is still a lead.
   */
  designId: z
    .string()
    .regex(/^[0-9abcdefghjkmnpqrstvwxyz]{12}$/, 'not a design id')
    .optional(),
  /** The "email me if I leave this unfinished" checkbox — 'on' when ticked. */
  recoverConsent: z.union([z.string().max(10), z.boolean()]).optional(),
  // sqft comes in as a number (valueAsNumber) or NaN when left blank
  sqft: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().positive().max(1_000_000).optional(),
  ),
});

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
    /**
     * ASSISTANT-07 — same field, same rule as `leadSchema.designId` above:
     * minted by `ensureDesignId()`, 12 Crockford base32 characters, and
     * rejected rather than stored if it is not something we minted. Optional
     * — a booking from a phone call or the estimate form has no design.
     */
    designId: z
      .string()
      .regex(/^[0-9abcdefghjkmnpqrstvwxyz]{12}$/, 'not a design id')
      .optional(),
    /** The Floor Studio share code, as structured data — see `QuoteRequest.designCode`'s own comment in schema.prisma. */
    designCode: z.string().max(400).optional(),
    // Honeypot — bots fill it, humans never see it. Must be empty.
    company: z.string().max(0).optional().or(z.literal('')),
  })
  .passthrough();

/** Query params for GET /api/availability — optional inclusive date range. */
export const availabilityQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
});

/** The widest window GET /api/availability will read from the database. */
export const AVAILABILITY_MAX_DAYS = 60;

const addDays = (key: string, days: number): string => {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/**
 * Resolve a validated availability query to the inclusive `YYYY-MM-DD` window
 * the route may query. Pure; keys compare lexically because the format is
 * fixed-width.
 *
 *   · `from` defaults to today and is never earlier than today — the past has
 *     no bookable slots, and "from 1900" was an unbounded table read.
 *   · `to` defaults to `from + defaultDays` and is CLAMPED to
 *     `from + AVAILABILITY_MAX_DAYS`; a far-future `to` no longer widens the
 *     query, it is silently shortened (the engine's own booking horizon is
 *     narrower still).
 *   · `to` before `from` is a client error: returns null.
 */
export function availabilityWindow(
  q: AvailabilityQuery,
  todayKey: string,
  defaultDays = 42,
): { from: string; to: string } | null {
  const from = q.from && q.from > todayKey ? q.from : todayKey;
  const hardEnd = addDays(from, Math.min(defaultDays, AVAILABILITY_MAX_DAYS));
  const cap = addDays(from, AVAILABILITY_MAX_DAYS);
  if (q.to && q.to < from) return null;
  const to = q.to ? (q.to > cap ? cap : q.to) : hardEnd;
  return { from, to };
}

export type AppointmentService = (typeof APPOINTMENT_SERVICES)[number];
export type AppointmentFormData = z.infer<typeof appointmentSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

// ─────────────────────────────────────────────────────────────────
// CHAT — the body ChatWidget posts to /api/chat
// ─────────────────────────────────────────────────────────────────

export const CHAT_MAX_MESSAGES = 30;
export const CHAT_MAX_CONTENT_CHARS = 4000;
/** Hard ceiling on the raw request body, checked before JSON.parse. */
export const CHAT_MAX_BODY_BYTES = 32 * 1024;

/**
 * Exactly the shape the widget sends and the `ai` SDK's ModelMessage accepts:
 * `{ role: 'user' | 'assistant', content: string }`, or content as an array of
 * `{ type: 'text', text }` parts. The `system` and `tool` roles are refused —
 * the system prompt is this server's, and a client-supplied tool result is a
 * forged tool result. Unknown keys (providerOptions, ids, …) are stripped.
 */
const chatTextPart = z.object({ type: z.literal('text'), text: z.string().max(CHAT_MAX_CONTENT_CHARS) });

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string().max(CHAT_MAX_CONTENT_CHARS), z.array(chatTextPart).min(1).max(8)]),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(CHAT_MAX_MESSAGES)
    // The conversation must end with the homeowner's turn — that is the only
    // thing the model is asked to answer.
    .refine((m) => m.length > 0 && m[m.length - 1]!.role === 'user', 'The last message must be from the user'),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ─────────────────────────────────────────────────────────────────
// PILOT LEAD — FloorForge & other pilot programs
// ─────────────────────────────────────────────────────────────────

/**
 * Exactly what products/floorforge posts. Unknown keys are stripped (was
 * `.passthrough()`), for the same reason as leadSchema: the parsed object is
 * logged and forwarded to a CRM webhook, and only named fields may travel.
 */
export const pilotLeadSchema = z.object({
  name: z.string().min(2, 'Please enter your full name').max(120),
  email: z.string().email('Please enter a valid email').max(254),
  phone: z.string().min(7, 'Please enter a valid phone number').max(40),
  companyName: z.string().min(2, 'Please enter your company or workshop name').max(160),
  role: z.enum(
    ['contractor', 'flooring-specialist', 'general-builder', 'property-manager', 'other'],
    { errorMap: () => ({ message: 'Please select your role' }) }
  ),
  flooringSqFt: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().positive('Please enter a valid square footage').max(100_000_000).optional()
  ),
  message: z.string().max(2000, 'Message is too long').optional(),
  source: z.string().max(120).optional(),
  program: z.string().min(1, 'Program is required').max(120),
});

export type PilotLeadFormData = z.infer<typeof pilotLeadSchema>;

// ─────────────────────────────────────────────────────────────────
// FRAMEWORK SCORING — the anonymous benchmark contribution
// ─────────────────────────────────────────────────────────────────

/**
 * What /framework/assess posts when — and only when — a person ticks the
 * contribution box.
 *
 * NOTE WHAT IS ABSENT, AND THAT IT IS ABSENT BY CONSTRUCTION. There is no
 * name, no email, no phone, no free text and no id of any kind. The receiving
 * table has no column for one either, and scripts/verify-floor-graph.mjs fails
 * the build if a field name here or there starts to look like an identifier.
 *
 * `answers` is one character per criterion in PILLARS order — y | u | n | - —
 * and the ROUTE, not this schema, checks the length against the live framework
 * version, because the criterion count is a fact about lib/framework.ts and
 * this package must not import it.
 *
 * `region` is a GTA municipality name or nothing. A postal code would be more
 * useful and would also make the row re-identifiable against a quote, which is
 * exactly the trade this dataset refuses to make.
 */
export const frameworkScoringSchema = z.object({
  frameworkVersion: z.string().min(1).max(16),
  answers: z.string().min(1).max(200).regex(/^[yun-]+$/, 'Unexpected answer encoding'),
  region: z.string().max(60).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'The contribution is opt-in.' }),
  }),
});

export type FrameworkScoringData = z.infer<typeof frameworkScoringSchema>;
