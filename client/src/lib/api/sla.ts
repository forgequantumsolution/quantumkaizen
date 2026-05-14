/**
 * Phase 3 — SLA API client.
 *
 * Endpoints (gated by backend `sla.*` permissions):
 *   GET    /workflows/:id/sla-policies
 *   POST   /sla-policies
 *   GET    /sla-policies/:id
 *   PATCH  /sla-policies/:id
 *   DELETE /sla-policies/:id
 *   POST   /sla-policies/:id/thresholds   (replace-all-by-name)
 *   DELETE /sla-thresholds/:id
 *   GET    /sla/timers?status=&workflowId=&ticketId=&page=&pageSize=
 *   GET    /tickets/:id/sla
 *   POST   /sla/timers/:id/extend
 *   POST   /sla/extensions/:id/decide
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NamedRef, UserRef } from './workflow';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlaTimerStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'EXTENDED'
  | 'COMPLETED'
  | 'BREACHED';

export type SlaEventType =
  | 'STARTED'
  | 'PAUSED'
  | 'RESUMED'
  | 'THRESHOLD_HIT'
  | 'SLA_TRANSITION'
  | 'EXTENDED'
  | 'COMPLETED'
  | 'COMPLETED_LATE'
  | 'BREACHED';

export type ExtensionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SlaThreshold {
  id: string;
  name: string;
  percentage: number;
  targetSlaStageId: string | null;
  targetSlaStage: { id: string; name: string; canonicalId: string } | null;
  notifyRoles: NamedRef[];
  notifyUsers: UserRef[];
}

export interface SlaPolicy {
  id: string;
  parentStageId: string;
  duration: number; // seconds
  calendarId: string | null;
  escalationWorkflowId: string | null;
  pauseOnHold: boolean;
  pauseOnExtensionPending: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  parentStage: {
    id: string;
    name: string;
    canonicalId: string;
    workflow: { id: string; name: string };
  };
  calendar: { id: string; name: string; timezone: string } | null;
  escalationWorkflow: { id: string; name: string } | null;
  responsibleRoles: NamedRef[];
  responsibleUsers: UserRef[];
  thresholds: SlaThreshold[];
}

export interface SlaTimerEvent {
  id: string;
  eventType: SlaEventType;
  thresholdId: string | null;
  thresholdName: string | null;
  thresholdPercentage: number | null;
  extensionAmountSec: number | null;
  newDeadline: string | null;
  triggeredById: string | null;
  triggeredBy: UserRef | null;
  eventData: unknown;
  occurredAt: string;
}

export interface SlaTimer {
  id: string;
  ticketId: string;
  stageId: string;
  policyId: string;
  escalationTicketId: string | null;
  status: SlaTimerStatus;
  startedAt: string;
  deadline: string;
  completedAt: string | null;
  elapsedBeforePauseSec: number;
  lastResumedAt: string | null;
  totalExtensionsSec: number;
  extensionCount: number;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string; canonicalId: string };
  policy: {
    id: string;
    duration: number;
    pauseOnHold: boolean;
    calendar: { id: string; name: string; timezone: string } | null;
  };
  escalationTicket: { id: string; uniqueId: string; title: string } | null;
}

export interface SlaTimerWithEvents extends SlaTimer {
  events: SlaTimerEvent[];
}

export interface SlaExtension {
  id: string;
  timerId: string;
  requestedById: string;
  requestedBy: UserRef | null;
  approverId: string | null;
  approver: UserRef | null;
  status: ExtensionStatus;
  reason: string;
  extensionSec: number;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSlaPolicyBody {
  parentStageId: string;
  duration: number;
  calendarId?: string | null;
  escalationWorkflowId?: string | null;
  pauseOnHold?: boolean;
  pauseOnExtensionPending?: boolean;
  responsibleRoleIds?: string[];
  responsibleUserIds?: string[];
}

export type UpdateSlaPolicyBody = Partial<
  Omit<CreateSlaPolicyBody, 'parentStageId'>
>;

export interface UpsertThresholdsBody {
  thresholds: Array<{
    name: string;
    percentage: number;
    targetSlaStageId?: string | null;
    notifyRoleIds?: string[];
    notifyUserIds?: string[];
  }>;
}

export interface ListTimersQuery {
  status?: SlaTimerStatus;
  workflowId?: string;
  ticketId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListTimersResponse {
  items: SlaTimer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RequestExtensionBody {
  extensionSec: number;
  reason: string;
}

export interface DecideExtensionBody {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const slaKeys = {
  all: ['sla'] as const,
  policiesForWorkflow: (workflowId: string) =>
    ['sla', 'policies', 'workflow', workflowId] as const,
  policy: (id: string) => ['sla', 'policy', id] as const,
  timers: (q: ListTimersQuery) => ['sla', 'timers', q] as const,
  ticketSla: (ticketId: string) => ['sla', 'ticket', ticketId] as const,
};

// ─── Policy hooks ─────────────────────────────────────────────────────────────

export const useSlaPoliciesForWorkflow = (workflowId: string | undefined) =>
  useQuery<SlaPolicy[]>({
    queryKey: slaKeys.policiesForWorkflow(workflowId ?? ''),
    queryFn: () =>
      api.get(`/workflows/${workflowId}/sla-policies`).then((r) => r.data),
    enabled: !!workflowId,
  });

export const useSlaPolicy = (id: string | undefined) =>
  useQuery<SlaPolicy>({
    queryKey: slaKeys.policy(id ?? ''),
    queryFn: () => api.get(`/sla-policies/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateSlaPolicy = () => {
  const qc = useQueryClient();
  return useMutation<SlaPolicy, unknown, CreateSlaPolicyBody>({
    mutationFn: (body) => api.post('/sla-policies', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

export const useUpdateSlaPolicy = (id: string) => {
  const qc = useQueryClient();
  return useMutation<SlaPolicy, unknown, UpdateSlaPolicyBody>({
    mutationFn: (body) => api.patch(`/sla-policies/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

export const useDeleteSlaPolicy = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/sla-policies/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

export const useUpsertThresholds = (policyId: string) => {
  const qc = useQueryClient();
  return useMutation<SlaPolicy, unknown, UpsertThresholdsBody>({
    mutationFn: (body) =>
      api.post(`/sla-policies/${policyId}/thresholds`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

export const useDeleteThreshold = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/sla-thresholds/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

// ─── Timer hooks ──────────────────────────────────────────────────────────────

export const useSlaTimers = (q: ListTimersQuery = {}) =>
  useQuery<ListTimersResponse>({
    queryKey: slaKeys.timers(q),
    queryFn: () => api.get('/sla/timers', { params: q }).then((r) => r.data),
  });

/**
 * Live SLA summary for a ticket. Auto-refetches every 30s while the page is
 * mounted, pauses when document is hidden (FE.Q1 signed-off).
 */
export const useTicketSla = (ticketId: string | undefined) =>
  useQuery<{ timers: SlaTimerWithEvents[] }>({
    queryKey: slaKeys.ticketSla(ticketId ?? ''),
    queryFn: () => api.get(`/tickets/${ticketId}/sla`).then((r) => r.data),
    enabled: !!ticketId,
    refetchInterval: () => (document.hidden ? false : 30_000),
    refetchIntervalInBackground: false,
  });

// ─── Extension hooks ──────────────────────────────────────────────────────────

export const useRequestExtension = (timerId: string) => {
  const qc = useQueryClient();
  return useMutation<SlaExtension, unknown, RequestExtensionBody>({
    mutationFn: (body) =>
      api.post(`/sla/timers/${timerId}/extend`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};

export const useDecideExtension = (extensionId: string) => {
  const qc = useQueryClient();
  return useMutation<SlaExtension, unknown, DecideExtensionBody>({
    mutationFn: (body) =>
      api.post(`/sla/extensions/${extensionId}/decide`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: slaKeys.all }),
  });
};
