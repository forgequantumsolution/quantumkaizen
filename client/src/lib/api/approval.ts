/**
 * Phase 3 — Approval API client.
 *
 * Endpoints (gated by backend `approval.*` permissions):
 *   GET    /workflows/:id/approval-policies      (also supports includeInactive, includeDeleted)
 *   POST   /workflows/:id/approval-policies
 *   GET    /approval-policies/:id
 *   PATCH  /approval-policies/:id
 *   DELETE /approval-policies/:id
 *   GET    /tickets/:id/approvals
 *   GET    /approvals/:instanceId
 *   POST   /approvals/:instanceId/decide
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NamedRef, StageActionBehavior, UserRef } from './workflow';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApprovalMode =
  | 'SINGLE'
  | 'ALL_REQUIRED'
  | 'QUORUM'
  | 'SEQUENTIAL'
  | 'ANY';

export type ApprovalInstanceStatus =
  | 'PENDING'
  | 'SATISFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'INVALIDATED'
  | 'CANCELLED';

export type ApprovalDecision = 'APPROVED' | 'REJECTED';

export interface ApprovalSequenceStep {
  order: number;
  roleId?: string;
  userId?: string;
  label?: string;
}

export interface ApprovalPolicy {
  id: string;
  workflowId: string;
  stageId: string;
  actionId: string;
  mode: ApprovalMode;
  requiredCount: number;
  strictRoleMatch: boolean;
  allowSelfApproval: boolean;
  requireUniqueApprovers: boolean;
  approvalSequence: ApprovalSequenceStep[] | null;
  approvalSlaHours: number | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  approverRoles: NamedRef[];
  approverUsers: UserRef[];
  stage: { id: string; name: string; canonicalId: string };
  action: {
    id: string;
    isPrimary: boolean;
    workflowAction: { id: string; name: string; behavior: StageActionBehavior };
  };
}

export interface ApprovalRecord {
  id: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string;
  sequenceOrder: number;
  approver: UserRef | null;
  approvedAsRole: NamedRef | null;
}

export interface ApprovalInstance {
  id: string;
  ticketId: string;
  policyId: string;
  triggeringActionId: string | null;
  status: ApprovalInstanceStatus;
  startedAt: string;
  completedAt: string | null;
  deadlineAt: string | null;
  currentSequenceOrder: number;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
  createdAt: string;
  updatedAt: string;
  policy: {
    id: string;
    mode: ApprovalMode;
    requiredCount: number;
    approverRoles: NamedRef[];
    approverUsers: UserRef[];
    stage: { id: string; name: string; canonicalId: string };
    action: {
      id: string;
      workflowAction: { id: string; name: string; behavior: StageActionBehavior };
    };
  };
  records: ApprovalRecord[];
}

export interface CreateApprovalPolicyBody {
  stageId: string;
  actionId: string;
  mode: ApprovalMode;
  requiredCount?: number;
  strictRoleMatch?: boolean;
  allowSelfApproval?: boolean;
  requireUniqueApprovers?: boolean;
  approvalSequence?: ApprovalSequenceStep[];
  approvalSlaHours?: number | null;
  isActive?: boolean;
  approverRoleIds?: string[];
  approverUserIds?: string[];
}

export type UpdateApprovalPolicyBody = Partial<
  Omit<CreateApprovalPolicyBody, 'stageId' | 'actionId'>
>;

export interface DecideApprovalBody {
  decision: ApprovalDecision;
  comment?: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const approvalKeys = {
  all: ['approvals'] as const,
  policiesForWorkflow: (workflowId: string, includeInactive = false) =>
    ['approvals', 'policies', 'workflow', workflowId, { includeInactive }] as const,
  policy: (id: string) => ['approvals', 'policy', id] as const,
  ticketInstances: (ticketId: string) =>
    ['approvals', 'ticket', ticketId] as const,
  instance: (instanceId: string) => ['approvals', 'instance', instanceId] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useApprovalPoliciesForWorkflow = (
  workflowId: string | undefined,
  opts: { includeInactive?: boolean; includeDeleted?: boolean } = {},
) =>
  useQuery<ApprovalPolicy[]>({
    queryKey: approvalKeys.policiesForWorkflow(workflowId ?? '', !!opts.includeInactive),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (opts.includeInactive) params.includeInactive = 'true';
      if (opts.includeDeleted) params.includeDeleted = 'true';
      return api
        .get(`/workflows/${workflowId}/approval-policies`, { params })
        .then((r) => r.data);
    },
    enabled: !!workflowId,
  });

export const useApprovalPolicy = (id: string | undefined) =>
  useQuery<ApprovalPolicy>({
    queryKey: approvalKeys.policy(id ?? ''),
    queryFn: () => api.get(`/approval-policies/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateApprovalPolicy = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation<ApprovalPolicy, unknown, CreateApprovalPolicyBody>({
    mutationFn: (body) =>
      api.post(`/workflows/${workflowId}/approval-policies`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.all }),
  });
};

export const useUpdateApprovalPolicy = (id: string) => {
  const qc = useQueryClient();
  return useMutation<ApprovalPolicy, unknown, UpdateApprovalPolicyBody>({
    mutationFn: (body) =>
      api.patch(`/approval-policies/${id}`, body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: approvalKeys.policy(id) });
      qc.invalidateQueries({ queryKey: ['approvals', 'policies', 'workflow', data.workflowId] });
    },
  });
};

export const useDeleteApprovalPolicy = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/approval-policies/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: approvalKeys.all }),
  });
};

export const useTicketApprovals = (ticketId: string | undefined) =>
  useQuery<ApprovalInstance[]>({
    queryKey: approvalKeys.ticketInstances(ticketId ?? ''),
    queryFn: () => api.get(`/tickets/${ticketId}/approvals`).then((r) => r.data),
    enabled: !!ticketId,
  });

export const useApprovalInstance = (instanceId: string | undefined) =>
  useQuery<ApprovalInstance>({
    queryKey: approvalKeys.instance(instanceId ?? ''),
    queryFn: () => api.get(`/approvals/${instanceId}`).then((r) => r.data),
    enabled: !!instanceId,
  });

/**
 * Decide a pending approval instance via the dedicated `/decide` endpoint.
 * Returns the post-decision view of the instance. On REJECTED + unsatisfiable
 * policy, the instance flips to REJECTED and the ticket stays in stage (Q5).
 */
export const useDecideApproval = (instanceId: string, ticketId?: string) => {
  const qc = useQueryClient();
  return useMutation<ApprovalInstance, unknown, DecideApprovalBody>({
    mutationFn: (body) =>
      api.post(`/approvals/${instanceId}/decide`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: approvalKeys.instance(instanceId) });
      if (ticketId) {
        qc.invalidateQueries({ queryKey: approvalKeys.ticketInstances(ticketId) });
        // A rejection terminates the ticket — refresh ticket detail/list/actions
        // so the status flips to "Rejected" and the action bar/forms lock.
        qc.invalidateQueries({ queryKey: ['tickets'] });
      }
    },
  });
};
