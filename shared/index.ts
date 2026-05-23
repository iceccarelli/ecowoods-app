// shared/index.ts
// PERFECT INTEGRATION BARREL — Single source of truth for Ecowoods platform
// Web (Next.js) + Mobile (React Native) + Backend (FastAPI) + Admin
// All types, API clients, OData query helpers, and error handling in one place
// Enables perfect caching, parallel queries, and consistent data layer across the entire stack

// ==================== TYPES ====================
export * from './types/lead';
export * from './types/job';
export * from './types/user';
export * from './types/bid';
export * from './types/common';

// ==================== API CLIENT (Perfect Sync + OData Ready) ====================
export {
  apiRequest,
  submitLead,
  createJob,
  getJobs,
  submitBid,
  getBidsForJob,
  login,
  register,
  // New enhanced exports for perfect execution
  buildODataQuery,
  apiClient,
  ApiError,
  type ApiResponse,
  type ODataQueryParams
} from './api/client';

// ==================== ENHANCED UTILITIES FOR PERFECT STACK ====================
export const PLATFORM_VERSION = '2.0.0-perfect-integration';
export const API_VERSION = 'v1';
export const DEFAULT_API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Re-export key constants for consistency
export const LEAD_SOURCES = ['website', 'mobile_app', 'referral', 'other'] as const;
export const SERVICE_TYPES = ['installation', 'refinishing', 'sanding', 'stairs', 'inlays', 'commercial'] as const;
export const TIMELINES = ['asap', '1-2_weeks', '1_month', 'flexible'] as const;

// Perfect integration helper
export const createPerfectApiHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'X-Platform': 'ecowoods-web-2.0',
  'X-Client-Version': PLATFORM_VERSION,
  ...(token && { Authorization: `Bearer ${token}` }),
});
