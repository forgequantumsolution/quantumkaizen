import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvailabilityWindow {
  id: string;
  from: string;
  to: string;
  reason: string | null;
  delegateToId: string | null;
  delegateTo: { id: string; name: string } | null;
}

export interface CreateAvailabilityInput {
  from: string;
  to: string;
  reason?: string | null;
  delegateToId?: string | null;
}

export interface CreateAvailabilityResult {
  window: AvailabilityWindow;
  /** Open tickets moved off the user because the window covers now. */
  reassigned: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

const key = (userId: string) => ['user-availability', userId] as const;

export const useAvailability = (userId: string | undefined) =>
  useQuery<AvailabilityWindow[]>({
    queryKey: key(userId ?? ''),
    queryFn: () => api.get(`/users/${userId}/availability`).then((r) => r.data),
    enabled: !!userId,
  });

export const useCreateAvailability = (userId: string) => {
  const qc = useQueryClient();
  return useMutation<CreateAvailabilityResult, unknown, CreateAvailabilityInput>({
    mutationFn: (body) => api.post(`/users/${userId}/availability`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(userId) });
      qc.invalidateQueries({ queryKey: ['user-directory'] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
};

export const useDeleteAvailability = (userId: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (windowId) =>
      api.delete(`/users/${userId}/availability/${windowId}`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key(userId) });
      qc.invalidateQueries({ queryKey: ['user-directory'] });
    },
  });
};
