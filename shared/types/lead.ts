// shared/types/lead.ts
// Used by BOTH the website (Next.js) and the React Native mobile app

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
  name: string;
  email: string;
  phone: string;
  postal: string;
  service: ServiceType;
  sqft: number;
  timeline: Timeline;
  message?: string;
  source: LeadSource;
  submitted_at: string; // ISO 8601 string
}

export interface LeadResponse {
  success: boolean;
  message: string;
  lead_id?: string;
}

// Future-proof: Add more shared types here later (Job, Bid, User, etc.)
export interface Job {
  id: string;
  lead_id: string;
  status: 'new' | 'quoted' | 'scheduled' | 'in_progress' | 'completed';
  // ... more fields as needed
}
