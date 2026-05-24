import { z } from 'zod';

export const createJobSchema = z.object({
  woodType: z.string().min(2, "Wood type is required"),
  size: z.string().min(1, "Size is required"),
  timeframe: z.string().min(3, "Timeframe is required"),
  address: z.string().min(10, "Full address required"),
  description: z.string().max(500).optional(),
});

export const createBidSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  estimatedDays: z.number().int().positive("Days must be positive integer"),
  notes: z.string().max(300).optional(),
});

export const messageSchema = z.object({
  content: z.string().min(1).max(1000),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateBidInput = z.infer<typeof createBidSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
