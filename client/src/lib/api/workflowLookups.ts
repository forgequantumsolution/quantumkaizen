import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StageActionBehavior } from './workflow';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowType {
  id: string;
  name: string;
  codePrefix: string | null;
  isDeleted: boolean;
  supportsFindings: boolean;
  iconConfig: { id: string; iconName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStageStatus {
  id: string;
  name: string;
  behavior: StageActionBehavior;
  isDeleted: boolean;
}

export interface ActionType {
  id: string;
  name: string;
  isDeleted: boolean;
}

export interface ActionCriteria {
  id: string;
  name: string;
  isDeleted: boolean;
}

export interface Priority {
  id: string;
  name: string;
}

export interface Severity {
  id: string;
  name: string;
  level: number;
  color: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const lookupKeys = {
  types: ['workflow-lookups', 'types'] as const,
  stageStatuses: ['workflow-lookups', 'stage-statuses'] as const,
  actionTypes: ['workflow-lookups', 'action-types'] as const,
  actionCriteria: ['workflow-lookups', 'action-criteria'] as const,
  priorities: ['workflow-lookups', 'priorities'] as const,
  severities: ['workflow-lookups', 'severities'] as const,
};

// ─── Workflow Types ───────────────────────────────────────────────────────────

// The sidebar's Modules group is driven by this query. On a fresh page load
// the network round-trip would leave the group empty for a few hundred ms,
// which is jarring. Persist the last successful response to localStorage and
// seed React Query with it as initialData so the sidebar renders immediately
// on refresh; the query still refetches in the background to pick up changes.
const WF_TYPES_CACHE_KEY = 'qk_cache_workflow_types_v1';

const readCachedWorkflowTypes = (): { data: WorkflowType[]; updatedAt: number } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WF_TYPES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WorkflowType[]; updatedAt: number };
    if (!Array.isArray(parsed?.data)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedWorkflowTypes = (data: WorkflowType[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      WF_TYPES_CACHE_KEY,
      JSON.stringify({ data, updatedAt: Date.now() }),
    );
  } catch {
    /* quota or private mode — ignore */
  }
};

export const useWorkflowTypes = () => {
  const cached = readCachedWorkflowTypes();
  return useQuery<WorkflowType[]>({
    queryKey: lookupKeys.types,
    queryFn: async () => {
      const data = (await api.get('/workflow-lookups/types')).data as WorkflowType[];
      writeCachedWorkflowTypes(data);
      return data;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    // Treat the cached snapshot as fresh for 30 s after load so we don't
    // refetch on every component mount during a single session, but still
    // revalidate periodically.
    staleTime: 30_000,
  });
};

export const useCreateWorkflowType = () => {
  const qc = useQueryClient();
  return useMutation<WorkflowType, unknown, { name: string; codePrefix?: string; iconName?: string }>({
    mutationFn: (input) =>
      api.post('/workflow-lookups/types', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.types }),
  });
};

export const useDeleteWorkflowType = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, { id: string; hard?: boolean }>({
    mutationFn: ({ id, hard }) =>
      api
        .delete(`/workflow-lookups/types/${id}`, { params: hard ? { hard: 'true' } : {} })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.types }),
  });
};

// ─── Stage Statuses ───────────────────────────────────────────────────────────

export const useStageStatuses = () =>
  useQuery<WorkflowStageStatus[]>({
    queryKey: lookupKeys.stageStatuses,
    queryFn: () => api.get('/workflow-lookups/stage-statuses').then((r) => r.data),
  });

export const useCreateStageStatus = () => {
  const qc = useQueryClient();
  return useMutation<WorkflowStageStatus, unknown, { name: string; behavior: StageActionBehavior }>({
    mutationFn: (input) =>
      api.post('/workflow-lookups/stage-statuses', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.stageStatuses }),
  });
};

// ─── Action Types ─────────────────────────────────────────────────────────────

export const useActionTypes = () =>
  useQuery<ActionType[]>({
    queryKey: lookupKeys.actionTypes,
    queryFn: () => api.get('/workflow-lookups/action-types').then((r) => r.data),
  });

export const useCreateActionType = () => {
  const qc = useQueryClient();
  return useMutation<ActionType, unknown, { name: string }>({
    mutationFn: (input) =>
      api.post('/workflow-lookups/action-types', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.actionTypes }),
  });
};

// ─── Action Criteria ──────────────────────────────────────────────────────────

export const useActionCriteria = () =>
  useQuery<ActionCriteria[]>({
    queryKey: lookupKeys.actionCriteria,
    queryFn: () => api.get('/workflow-lookups/action-criteria').then((r) => r.data),
  });

export const useCreateActionCriteria = () => {
  const qc = useQueryClient();
  return useMutation<ActionCriteria, unknown, { name: string }>({
    mutationFn: (input) =>
      api.post('/workflow-lookups/action-criteria', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.actionCriteria }),
  });
};

// ─── Priorities ───────────────────────────────────────────────────────────────

export const usePriorities = () =>
  useQuery<Priority[]>({
    queryKey: lookupKeys.priorities,
    queryFn: () => api.get('/workflow-lookups/priorities').then((r) => r.data),
  });

// ─── Severities ───────────────────────────────────────────────────────────────

export const useSeverities = () =>
  useQuery<Severity[]>({
    queryKey: lookupKeys.severities,
    queryFn: () => api.get('/workflow-lookups/severities').then((r) => r.data),
  });

export const useCreateSeverity = () => {
  const qc = useQueryClient();
  return useMutation<Severity, unknown, { name: string; level?: number; color?: string | null }>({
    mutationFn: (input) =>
      api.post('/workflow-lookups/severities', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.severities }),
  });
};

export const useDeleteSeverity = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) =>
      api.delete(`/workflow-lookups/severities/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: lookupKeys.severities }),
  });
};
