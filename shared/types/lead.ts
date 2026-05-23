// shared/types/lead.ts
// CLEAN VERSION - Only Lead-related exports (NO Job)

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
  status?: 'new' | 'contacted' | 'quoted' | 'scheduled';
}

export interface LeadResponse {
  success: boolean;
  message: string;
  lead_id?: string;
  lead?: Lead;
}
