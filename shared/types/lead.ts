export interface Lead {
  name: string;
  email: string;
  phone: string;
  postal: string;
  service: 'installation' | 'refinishing' | 'sanding' | 'stairs' | 'inlays' | 'commercial';
  sqft: number;
  timeline: 'asap' | '1-2_weeks' | '1_month' | 'flexible';
  message?: string;
  source: 'website' | 'mobile_app' | 'referral' | 'other';
  submitted_at: string; // ISO string
}

export interface LeadResponse {
  success: boolean;
  message: string;
  lead_id?: string;
}
