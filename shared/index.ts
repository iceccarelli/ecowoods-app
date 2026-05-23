// shared/index.ts
// PERFECT INTEGRATION BARREL — Single source of truth for Ecowoods platform

// TYPES
export * from './types/lead';
export * from './types/job';
export * from './types/user';
export * from './types/bid';
export * from './types/common';

// API CLIENT
export {
  apiRequest,
  submitLead,
  createJob,
  getJobs,
  submitBid,
  getBidsForJob,
  login,
  register,
  buildODataQuery,
  ApiError,
  type ODataQueryParams
} from './api/client';

// PLATFORM CONSTANTS
export const PLATFORM_VERSION = '2.0.0-perfect-integration';
export const API_VERSION = 'v1';
export const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const LEAD_SOURCES = ['website', 'mobile_app', 'referral', 'other'] as const;
export const SERVICE_TYPES = ['installation', 'refinishing', 'sanding', 'stairs', 'inlays', 'commercial'] as const;
export const TIMELINES = ['asap', '1-2_weeks', '1_month', 'flexible'] as const;

export const createPerfectApiHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Platform': 'ecowoods-web-2.0',
  'X-Client-Version': PLATFORM_VERSION,
  ...(token && { Authorization: `Bearer ${token}` }),
});
