import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { Job, CreateJobInput, createJobSchema } from '@ecowoods/shared';

export const useJobs = () =>
  useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get<Job[]>('/jobs'),
  });

export const useCreateJob = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobInput) => {
      const validated = createJobSchema.parse(data);
      return api.post<Job>('/jobs', validated);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
};
