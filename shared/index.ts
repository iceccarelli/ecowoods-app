// shared/index.ts
// Clean barrel export — explicit re-exports to avoid name conflicts (Job, etc.)

export * from './types/lead';
export * from './types/job';
export * from './types/user';
export * from './types/bid';
export * from './types/common';

// Explicit re-export of API functions
export {
  apiRequest,
  submitLead,
  createJob,
  getJobs,
  submitBid,
  getBidsForJob,
  login,
  register
} from './api/client';
