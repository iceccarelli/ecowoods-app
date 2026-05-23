// shared/types/job.ts
// Complete Job model used across Website, Mobile App, and Backend

export type JobStatus = 
  | 'new' 
  | 'quoted' 
  | 'bid_received' 
  | 'scheduled' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Job {
  id: string;
  lead_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  postal: string;
  service: string;
  sqft: number;
  status: JobStatus;
  priority: JobPriority;
  estimated_value: number;
  actual_cost?: number;
  scheduled_date?: string;
  completed_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  assigned_installer_id?: string;
}

export interface JobCreateInput {
  lead_id: string;
  service: string;
  sqft: number;
  notes?: string;
}

export interface JobUpdateInput {
  status?: JobStatus;
  priority?: JobPriority;
  scheduled_date?: string;
  notes?: string;
  assigned_installer_id?: string;
}
