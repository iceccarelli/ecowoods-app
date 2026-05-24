export * from './client';
export * from './hooks/useJobs';

import { api } from './client';

export const submitLead = async (data: any, source: string = 'website') => {
  return api.post('/leads', { ...data, source });
};
