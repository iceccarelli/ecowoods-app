// shared/index.ts
// Barrel export for the entire shared layer — perfect for both Web and Mobile

export * from './types/lead';
export * from './types/job';
export * from './types/user';
export * from './types/bid';
export * from './types/common';

export { apiRequest, submitLead } from './api/client';
