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

/** A site reference. `site: null` on a workflow means GLOBAL (all sites). */
export interface SiteRef {
  id: string;
  code: string;
  name: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  status: WorkflowStatus;
  workflowStatus: WorkflowLifecycleStatus;
  version: number;
  type: NamedRef | null;
  site: SiteRef | null;
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
    /** Phase 3.5+ embedded policy intents — round-tripped through draft/publish. */
    formBindings?: Array<{
      formId: string;
      isRequired: boolean;
      position: number;
    }>;
    sla?: {
      duration: number;
      calendarId?: string | null;
      escalationWorkflowId?: string | null;
      pauseOnHold: boolean;
      pauseOnExtensionPending: boolean;
      thresholds: Array<{
        name: string;
        percentage: number;
        targetStageCanonicalId?: string | null;
      }>;
    } | null;
    approvalPolicies?: Array<{
      actionType: 'primary' | 'secondary';
      actionIndex: number;
      mode: 'SINGLE' | 'ALL_REQUIRED' | 'QUORUM' | 'SEQUENTIAL' | 'ANY';
      requiredCount: number;
      strictRoleMatch: boolean;
      allowSelfApproval: boolean;
      requireUniqueApprovers: boolean;
      approverRoleIds: string[];
      approverUserIds: string[];
      approvalSlaHours?: number | null;
      isActive: boolean;
      approvalSequence?: unknown;
    }>;
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
    site: SiteRef | null;
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
  // `id` is always the **latest** version's id after a save. If a new version
  // was created (i.e. the saved workflow already had stages), `previousVersionId`
  // is the id the caller PUT against — the FE uses this to detect a version bump
  // and navigate to the new builder URL. `meta.versionBumped` mirrors that.
  workflow: { id: string; previousVersionId?: string };
  meta: { warnings: string[]; versionBumped?: boolean };
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

/** One entry in the lightweight workflow picker directory. */
export interface WorkflowDirectoryEntry {
  id: string;
  name: string;
  version: number;
  workflowStatus: WorkflowLifecycleStatus;
  type: NamedRef | null;
  site: SiteRef | null;
}

/**
 * Picker list of ACTIVE workflows, readable by any authenticated user — unlike
 * `useWorkflows` (needs `workflow.read`, which operational roles like auditors
 * lack, so its picker 403s → empty). Use for "choose a workflow to follow/raise".
 */
export const useWorkflowDirectory = (typeId?: string) =>
  useQuery<{ items: WorkflowDirectoryEntry[] }>({
    queryKey: ['workflows', 'directory', typeId ?? null],
    queryFn: () =>
      api.get('/workflows/directory', { params: typeId ? { typeId } : {} }).then((r) => r.data),
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
    { workflow: { id: string; name: string; status: WorkflowStatus; workflowStatus: WorkflowLifecycleStatus; type: NamedRef | null; site: SiteRef | null; createdAt: string } },
    unknown,
    // `siteId` is only honoured for `site.view_all` (Super Admin): null/absent =
    // GLOBAL, or a specific site to pin to. Scoped users' server forces own-site.
    { name: string; typeId?: string | null; siteId?: string | null }
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

/**
 * Status-only update. Activates / deactivates a workflow WITHOUT going
 * through the full save endpoint — `save()` wipes and rebuilds the stage
 * graph, which cascades and removes attached approval/SLA/form policies.
 */
export const useSetWorkflowStatus = (id: string) => {
  const qc = useQueryClient();
  return useMutation<
    { id: string; workflowStatus: WorkflowLifecycleStatus },
    unknown,
    WorkflowLifecycleStatus
  >({
    mutationFn: (workflowStatus) =>
      api.patch(`/workflows/${id}/status`, { workflowStatus }).then((r) => r.data),
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

export const useSaveDraft = (id: string) => {
  const qc = useQueryClient();
  return useMutation<{ status: boolean; msg: string }, unknown, { flow_json: unknown }>({
    mutationFn: (body) => api.post(`/workflows/${id}/draft`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.draft(id) }),
  });
};

export const useDeleteDraft = (id: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => api.delete(`/workflows/${id}/draft`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: workflowKeys.draft(id) }),
  });
};

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
