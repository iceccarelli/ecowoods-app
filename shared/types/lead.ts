// shared/types/lead.ts
// CLEAN + MASSIVELY ENHANCED VERSION — Single Source of Truth for Perfect Integration
// Used by: Next.js Website, React Native Mobile App, FastAPI Backend, Admin Dashboard
// Fully aligned with OData query capabilities and TanStack Query caching strategy
// DO NOT MODIFY WITHOUT UPDATING BACKEND PYDANTIC MODELS + MOBILE TYPES

import { z } from 'zod';

// ==================== ENUMS (Strict & Exhaustive) ====================
export type ServiceType = 
  | 'installation' 
  | 'refinishing' 
  | 'sanding' 
  | 'stairs' 
  | 'inlays' 
  | 'commercial';

export type Timeline = 
  | 'asap' 
  | '1-2_weeks' 
  | '1_month' 
  | 'flexible';

export type LeadSource = 
  | 'website' 
  | 'mobile_app' 
  | 'referral' 
  | 'other';

export type LeadStatus = 
  | 'new' 
  | 'contacted' 
  | 'quoted' 
  | 'scheduled' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

// ==================== CORE INTERFACES ====================
export interface Lead {
  id?: string;
  name: string;
  email: string;
  phone: string;
  postal: string;
  service: ServiceType;
  sqft: number;
  timeline: Timeline;
  message?: string;
  source: LeadSource;
  submitted_at: string; // ISO 8601
  status?: LeadStatus;
  // Enhanced fields for perfect sync & OData
  address?: string;
  preferred_contact_method?: 'phone' | 'email' | 'text';
  budget_range?: 'under_5k' | '5k_10k' | '10k_20k' | '20k_plus';
  existing_floor_type?: string;
  has_pets?: boolean;
  urgency_score?: number; // 1-10 for internal prioritization
  tags?: string[];
  assigned_to?: string; // staff user id
  quoted_amount?: number;
  scheduled_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadResponse {
  success: boolean;
  message: string;
  lead_id?: string;
  lead?: Lead;
  // Enhanced for perfect error handling + caching
  errors?: Record<string, string[]>;
  trace_id?: string;
}

// ==================== ZOD SCHEMA (Perfect Validation for Forms + API) ====================
export const leadSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().regex(/^[\d\s\-\+\(\)]{10,20}$/, "Please enter a valid phone number"),
  postal: z.string().regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Please enter a valid Canadian postal code (e.g. M5V 2T6)"),
  service: z.enum(['installation', 'refinishing', 'sanding', 'stairs', 'inlays', 'commercial']),
  sqft: z.number().min(50, "Minimum 50 sq ft").max(15000, "Maximum 15,000 sq ft for single project"),
  timeline: z.enum(['asap', '1-2_weeks', '1_month', 'flexible']),
  message: z.string().max(2000, "Message too long").optional(),
  source: z.enum(['website', 'mobile_app', 'referral', 'other']).default('website'),
  address: z.string().max(200).optional(),
  preferred_contact_method: z.enum(['phone', 'email', 'text']).optional(),
  budget_range: z.enum(['under_5k', '5k_10k', '10k_20k', '20k_plus']).optional(),
  has_pets: z.boolean().optional(),
  urgency_score: z.number().min(1).max(10).optional(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

// ==================== ODATA COMPATIBLE FILTERS (Perfect Data Layer Alignment) ====================
export interface LeadODataFilters {
  service?: ServiceType;
  status?: LeadStatus;
  source?: LeadSource;
  sqft_min?: number;
  sqft_max?: number;
  timeline?: Timeline;
  submitted_after?: string;
  submitted_before?: string;
  has_pets?: boolean;
  search?: string; // full-text on name/email/message
}

// ==================== ADDITIONAL TYPES FOR PERFECT SYNC ====================
export interface LeadStatusHistory {
  status: LeadStatus;
  changed_at: string;
  changed_by?: string;
  note?: string;
}

export interface LeadWithHistory extends Lead {
  history?: LeadStatusHistory[];
}

// ==================== CONSTANTS FOR UI & MOBILE ====================
export const SERVICE_LABELS: Record<ServiceType, string> = {
  installation: 'Hardwood Installation',
  refinishing: 'Refinishing & Restoration',
  sanding: 'Dust-Free Sanding',
  stairs: 'Stair Refinishing',
  inlays: 'Custom Inlays & Borders',
  commercial: 'Commercial Projects',
};

export const TIMELINE_LABELS: Record<Timeline, string> = {
  asap: 'As soon as possible',
  '1-2_weeks': 'Within 1-2 weeks',
  '1_month': 'Within 1 month',
  flexible: 'Flexible / Planning ahead',
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-emerald-500',
  contacted: 'bg-amber-500',
  quoted: 'bg-blue-500',
  scheduled: 'bg-purple-500',
  in_progress: 'bg-orange-500',
  completed: 'bg-green-600',
  cancelled: 'bg-red-500',
};

// ==================== HELPER FUNCTIONS ====================
export const formatLeadForDisplay = (lead: Lead): string => {
  return `${lead.name} • ${SERVICE_LABELS[lead.service]} • ${lead.sqft} sq ft • ${TIMELINE_LABELS[lead.timeline]}`;
};

export const isLeadUrgent = (lead: Lead): boolean => {
  return lead.timeline === 'asap' || (lead.urgency_score ?? 0) >= 8;
};
