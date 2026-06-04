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
