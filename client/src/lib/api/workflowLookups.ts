import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StageActionBehavior } from './workflow';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowType {
  id: string;
  name: string;
  codePrefix: string | null;
  isDeleted: boolean;
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

// ─── Query keys ───────────────────────────────────────────────────────────────

export const lookupKeys = {
  types: ['workflow-lookups', 'types'] as const,
  stageStatuses: ['workflow-lookups', 'stage-statuses'] as const,
  actionTypes: ['workflow-lookups', 'action-types'] as const,
  actionCriteria: ['workflow-lookups', 'action-criteria'] as const,
  priorities: ['workflow-lookups', 'priorities'] as const,
};

// ─── Workflow Types ───────────────────────────────────────────────────────────

export const useWorkflowTypes = () =>
  useQuery<WorkflowType[]>({
    queryKey: lookupKeys.types,
    queryFn: () => api.get('/workflow-lookups/types').then((r) => r.data),
  });

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
