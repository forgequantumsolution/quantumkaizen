import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Open/actionable counts per module for sidebar badges (FQS-QK-UIUX-003 §4). */
export interface NavCounts {
  workflowTypes: Record<string, number>; // open tickets keyed by workflow-type id
  oos: number;                           // open OOS/OOT investigations
  capa: number;                          // open CAPA records
}

export const useNavCounts = () =>
  useQuery<NavCounts>({
    queryKey: ['nav-counts'],
    queryFn: async () => (await api.get('/nav-counts')).data as NavCounts,
    // Badges are ambient — refresh periodically, tolerate staleness, never block.
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
