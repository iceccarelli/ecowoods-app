// shared/api/client.ts
// Production-grade unified API client for Web + Mobile

import { Lead, LeadResponse } from '../types/lead';
import { Job, JobCreateInput } from '../types/job';
import { Bid, BidCreateInput } from '../types/bid';
import { User, LoginCredentials, RegisterData, AuthUser } from '../types/user';

const API_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.EXPO_PUBLIC_API_URL || 
  'http://localhost:8000';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API Error ${res.status}`);
  }

  return res.json();
}

// ==================== LEAD ====================
export async function submitLead(
  lead: Omit<Lead, 'submitted_at' | 'source' | 'id' | 'status'>,
  source: 'website' | 'mobile_app' = 'website'
): Promise<LeadResponse> {
  return apiRequest<LeadResponse>('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      ...lead,
      source,
      submitted_at: new Date().toISOString(),
    }),
  });
}

// ==================== JOBS ====================
export async function createJob(input: JobCreateInput): Promise<Job> {
  return apiRequest<Job>('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getJobs(params?: { status?: string; page?: number }): Promise<Job[]> {
  const query = params ? new URLSearchParams(params as any).toString() : '';
  return apiRequest<Job[]>(`/api/jobs${query ? `?${query}` : ''}`);
}

// ==================== BIDS ====================
export async function submitBid(input: BidCreateInput): Promise<Bid> {
  return apiRequest<Bid>('/api/bids', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getBidsForJob(jobId: string): Promise<Bid[]> {
  return apiRequest<Bid[]>(`/api/jobs/${jobId}/bids`);
}

// ==================== AUTH ====================
export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function register(data: RegisterData): Promise<AuthUser> {
  return apiRequest<AuthUser>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
