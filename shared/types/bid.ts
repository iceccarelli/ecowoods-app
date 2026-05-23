// shared/types/bid.ts
// Bidding system used by installers in the mobile app

export type BidStatus = 
  | 'pending' 
  | 'accepted' 
  | 'rejected' 
  | 'expired';

export interface Bid {
  id: string;
  job_id: string;
  installer_id: string;
  installer_name: string;
  amount: number;
  estimated_days: number;
  notes?: string;
  status: BidStatus;
  created_at: string;
  responded_at?: string;
}

export interface BidCreateInput {
  job_id: string;
  amount: number;
  estimated_days: number;
  notes?: string;
}
