export interface User {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'staff' | 'admin';
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type JobStatus = 'pending' | 'bidding' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Job {
  id: string;
  customerId: string;
  woodType: string;
  size: string;
  timeframe: string;
  address: string;
  status: JobStatus;
  description?: string;
  images?: string[];
  createdAt: string;
  updatedAt: string;
  bids?: Bid[];
}

export interface Bid {
  id: string;
  jobId: string;
  staffId: string;
  amount: number;
  estimatedDays: number;
  notes?: string;
  status: BidStatus;
  createdAt: string;
}

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'bid_accepted' | 'job_update' | 'new_message' | 'payment';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: string;
}
