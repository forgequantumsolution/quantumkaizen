import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type WorkflowLifecycleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'DRAFT_UPDATE';
export type StageType = 'stage' | 'fork' | 'join' | 'decision' | 'audit_forms';
export type SplitType = 'AND' | 'OR' | 'XOR';
export type JoinType = 'AND' | 'OR';
export type StageActionBehavior = 'FORWARD' | 'REJECT' | 'HOLD' | 'UNHOLD' | 'RETURN' | 'REASSIGN';

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  workflowStatus: WorkflowLifecycleStatus;
  type: NamedRef | null;
  stageCount: number;
  transitionCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: UserRef | null;
}

export interface WorkflowListResponse {
  items: WorkflowSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BuilderActionPayload {
  id?: string;
  stage_status_id: string;
  stage_status_name?: string;
  behavior?: StageActionBehavior;
  type?: 'primary' | 'secondary';
  action_criteria_id?: string | null;
  roles_id?: string[];
  employees_id?: string[];
}

export interface BuilderNode {
  id: string;
  type?: string;
  data: {
    label: string;
    nodeType?: StageType;
    /** Set on persisted stages — the WorkflowStage UUID. Absent for new canvas-only nodes. */
    persistedStageId?: string;
    basic_details?: {
      is_initial_stage?: boolean;
      email_notification?: boolean;
    };
    primary_actions?: BuilderActionPayload[];
    secondary_actions?: BuilderActionPayload[];
    parallelConfig?: {
      branchCount?: number;
      splitType?: SplitType;
      joinType?: JoinType;
      joinStageId?: string | null;
    };
    additional_data?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface BuilderEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  branchInfo?: {
    branchName?: string;
    condition?: string;
    order?: number;
  };
}

export interface WorkflowDetailResponse {
  workflow: {
    id: string;
    name: string;
    status: WorkflowStatus;
    workflowStatus: WorkflowLifecycleStatus;
    type: NamedRef | null;
    createdBy: UserRef | null;
    createdAt: string;
    updatedAt: string;
    isDeleted: boolean;
    deletedAt: string | null;
    settings: {
      maxExecutionsPerDay: number | null;
      timeoutSeconds: number | null;
    };
    executions: {
      total: number;
      successful: number;
      failed: number;
      lastAt: string | null;
    };
  };
  flow_json: { nodes: BuilderNode[]; edges: BuilderEdge[] };
  meta: { warnings: string[] };
}

export interface SaveWorkflowBody {
  flow_json: { nodes: BuilderNode[]; edges: BuilderEdge[] };
  workflow_settings?: {
    maxExecutionsPerDay?: number | null;
    timeoutSeconds?: number | null;
    workflowStatus?: WorkflowLifecycleStatus;
  };
}

export interface SaveWorkflowResponse {
  status: true;
  msg: string;
  workflow: { id: string };
  meta: { warnings: string[] };
}

export interface ValidationFailure {
  status: false;
  msg: string;
  validation_errors: string[];
  error_count: number;
  details?: string;
}

export interface ListWorkflowsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  typeId?: string;
  status?: WorkflowLifecycleStatus;
  includeDeleted?: 'true' | 'false';
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const workflowKeys = {
  all: ['workflows'] as const,
  list: (filters: ListWorkflowsQuery) => ['workflows', 'list', filters] as const,
  detail: (id: string) => ['workflows', 'detail', id] as const,
  draft: (id: string) => ['workflows', 'draft', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useWorkflows = (
  filters: ListWorkflowsQuery = {},
  options?: Omit<UseQueryOptions<WorkflowListResponse>, 'queryKey' | 'queryFn'>
) =>
  useQuery<WorkflowListResponse>({
    queryKey: workflowKeys.list(filters),
    queryFn: () => api.get('/workflows', { params: filters }).then((r) => r.data),
    ...options,
  });

export const useWorkflow = (id: string | undefined) =>
  useQuery<WorkflowDetailResponse>({
    queryKey: workflowKeys.detail(id ?? ''),
    queryFn: () => api.get(`/workflows/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateWorkflow = () => {
  const qc = useQueryClient();
  return useMutation<
    { workflow: { id: string; name: string; status: WorkflowStatus; workflowStatus: WorkflowLifecycleStatus; type: NamedRef | null; createdAt: string } },
    unknown,
    { name: string; typeId?: string | null }
  >({
    mutationFn: (input) => api.post('/workflows', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
};

export const useSaveWorkflow = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SaveWorkflowResponse, unknown, SaveWorkflowBody>({
    mutationFn: (body) => api.put(`/workflows/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workflowKeys.detail(id) });
      qc.invalidateQueries({ queryKey: workflowKeys.all });
    },
  });
};

export const useSoftDeleteWorkflow = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/workflows/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.all }),
  });
};

export const useWorkflowDraft = (id: string | undefined) =>
  useQuery<{ flow_json: unknown }>({
    queryKey: workflowKeys.draft(id ?? ''),
    queryFn: () => api.get(`/workflows/${id}/draft`).then((r) => r.data),
    enabled: !!id,
  });

export const useSaveDraft = (id: string) =>
  useMutation<{ status: boolean; msg: string }, unknown, { flow_json: unknown }>({
    mutationFn: (body) => api.post(`/workflows/${id}/draft`, body).then((r) => r.data),
  });

// Helper to detect validation failures (4xx with validation_errors array)
export const isWorkflowValidationFailure = (
  err: unknown
): err is { response: { data: ValidationFailure } } => {
  const e = err as { response?: { data?: { status?: unknown; validation_errors?: unknown } } };
  return (
    !!e?.response?.data &&
    e.response.data.status === false &&
    Array.isArray(e.response.data.validation_errors)
  );
};
