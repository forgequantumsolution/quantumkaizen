import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NamedRef, StageActionBehavior, UserRef } from './workflow';
import { approvalKeys } from './approval';
import { slaKeys } from './sla';
import { stageFormKeys } from './stageForm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TicketCurrentStage {
  id: string;
  name: string;
  canonicalId: string;
  stageType: 'STAGE' | 'FORK' | 'JOIN' | 'DECISION' | 'AUDIT_FORMS';
}

export interface TicketFlowSummary {
  id: string;
  isCompleted: boolean;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  currentStages: TicketCurrentStage[];
}

export interface TicketSummary {
  id: string;
  uniqueId: string;
  title: string;
  isOnHold: boolean;
  isDeleted: boolean;
  dueDate: string | null;
  classification: TicketClassification | null;
  createdAt: string;
  updatedAt: string;
  priority: NamedRef | null;
  severity: SeverityRef | null;
  department: { id: string; name: string; code: string } | null;
  site: { id: string; name: string; code: string } | null;
  createdBy: UserRef | null;
  flows: TicketFlowSummary[];
}

export interface TicketDetail extends TicketSummary {
  description: string | null;
  ticketReason: string | null;
  customFields: Record<string, unknown> | null;
  holdReason: string | null;
  heldAt: string | null;
  heldBy: { id: string; name: string } | null;
  parentTicket: { id: string; uniqueId: string; title: string } | null;
  parentTicketStage: { id: string; name: string; canonicalId: string } | null;
  flows: (TicketFlowSummary & {
    completedAt: string | null;
    statusUpdatedAt: string;
    workflow: { id: string; name: string; version: number };
  })[];
}

export interface AllowedAction {
  id: string;
  name: string;
  behavior: StageActionBehavior;
  isPrimary: boolean;
  canPerform: boolean;
  canPerformReason?: string;
}

export interface StageActionsView {
  stageId: string;
  stageName: string;
  stageCanonicalId: string;
  stageType: TicketCurrentStage['stageType'];
  actions: AllowedAction[];
}

export type TicketClassification =
  | 'PRODUCT'
  | 'PROCESS'
  | 'SYSTEM'
  | 'EQUIPMENT'
  | 'DOCUMENTATION'
  | 'TRAINING'
  | 'OTHER';

export interface SeverityRef {
  id: string;
  name: string;
  level: number;
  color: string | null;
}

export interface RaiseTicketInput {
  workflowId: string;
  title: string;
  description?: string;
  ticketReason?: string;
  priorityId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  severityId?: string | null;
  dueDate?: string | null;
  classification?: TicketClassification | null;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string | null;
  ticketReason?: string | null;
  priorityId?: string | null;
  departmentId?: string | null;
  siteId?: string | null;
  severityId?: string | null;
  dueDate?: string | null;
  classification?: TicketClassification | null;
}

export interface TransitionInput {
  actionId: string;
  remarks?: string;
  returnToStageId?: string;
  reassignToUserId?: string;
  reassignToRoleId?: string;
}

export interface TransitionResult {
  status: 'transitioned' | 'completed' | 'held' | 'returned' | 'reassigned';
  ticketId: string;
  flowId: string;
  enteredStages: { id: string; name: string }[];
  exitedStages: { id: string; name: string }[];
  isCompleted: boolean;
}

export interface ListTicketsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  workflowId?: string;
  workflowTypeId?: string;
  status?: 'open' | 'completed' | 'all';
  mine?: 'true' | 'false';
  includeDeleted?: 'true' | 'false';
}

export interface TrackingRow {
  id: string;
  stageId: string | null;
  stageName: string;
  enteredAt: string;
  exitedAt: string | null;
  durationSec: number | null;
  isActive: boolean;
  isOnHold: boolean;
  holdReason: string | null;
  remarks: string | null;
  performedBy: UserRef | null;
  postAction: {
    id: string;
    workflowAction: { name: string; behavior: StageActionBehavior };
  } | null;
  returnedFromStage: { id: string; name: string } | null;
}

export type TimelineEntry =
  | { kind: 'stage_entered'; at: string; stageName: string; performedBy: { id: string; name: string } | null }
  | {
      kind: 'stage_exited';
      at: string;
      stageName: string;
      actionName: string | null;
      performedBy: { id: string; name: string } | null;
    }
  | { kind: 'comment'; at: string; body: string; author: { id: string; name: string } | null };

export interface TicketComment {
  id: string;
  body: string;
  createdAt: string;
  author: UserRef | null;
}

export interface TicketDoc {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  docType: 'ATTACHMENT' | 'EVIDENCE' | 'REPORT' | 'FORM_SUBMISSION' | 'OTHER';
  stageId: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const ticketKeys = {
  all: ['tickets'] as const,
  list: (filters: ListTicketsQuery) => ['tickets', 'list', filters] as const,
  detail: (id: string) => ['tickets', 'detail', id] as const,
  allowedActions: (id: string) => ['tickets', 'allowed-actions', id] as const,
  track: (id: string) => ['tickets', 'track', id] as const,
  timeline: (id: string) => ['tickets', 'timeline', id] as const,
  comments: (id: string) => ['tickets', 'comments', id] as const,
  docs: (id: string) => ['tickets', 'docs', id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useTickets = (filters: ListTicketsQuery = {}) =>
  useQuery<{ items: TicketSummary[]; total: number; page: number; pageSize: number }>({
    queryKey: ticketKeys.list(filters),
    queryFn: () => api.get('/tickets', { params: filters }).then((r) => r.data),
  });

export const useTicket = (id: string | undefined) =>
  useQuery<TicketDetail>({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useRaiseTicket = () => {
  const qc = useQueryClient();
  return useMutation<
    { ticketId: string; flowId: string; uniqueId: string },
    unknown,
    RaiseTicketInput
  >({
    mutationFn: (input) => api.post('/tickets', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.all }),
  });
};

export const useUpdateTicket = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TicketDetail, unknown, UpdateTicketInput>({
    mutationFn: (body) => api.patch(`/tickets/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.all });
    },
  });
};

export const useDeleteTicket = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/tickets/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.all }),
  });
};

export const useAllowedActions = (id: string | undefined) =>
  useQuery<StageActionsView[]>({
    queryKey: ticketKeys.allowedActions(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}/allowed-actions`).then((r) => r.data),
    enabled: !!id,
  });

export const useTransition = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TransitionResult, unknown, TransitionInput>({
    mutationFn: (body) => api.post(`/tickets/${id}/transition`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.allowedActions(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.track(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.timeline(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.all });
      // Phase 3 — a transition can spawn approvals (intercept) and start/settle
      // SLA timers (stage cross). Without these the awaiting card + SLA panel
      // would lag by up to a full poll window.
      qc.invalidateQueries({ queryKey: approvalKeys.ticketInstances(id) });
      qc.invalidateQueries({ queryKey: slaKeys.ticketSla(id) });
      qc.invalidateQueries({ queryKey: stageFormKeys.ticket(id) });
    },
  });
};

export const useHoldTicket = (id: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, { reason: string }>({
    mutationFn: (body) => api.post(`/tickets/${id}/hold`, body).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.all });
      qc.invalidateQueries({ queryKey: slaKeys.ticketSla(id) });
    },
  });
};

export const useResumeTicket = (id: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: () => api.post(`/tickets/${id}/resume`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.all });
      qc.invalidateQueries({ queryKey: slaKeys.ticketSla(id) });
    },
  });
};

export const useTicketTrack = (id: string | undefined) =>
  useQuery<TrackingRow[]>({
    queryKey: ticketKeys.track(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}/track`).then((r) => r.data),
    enabled: !!id,
  });

export const useTicketTimeline = (id: string | undefined) =>
  useQuery<TimelineEntry[]>({
    queryKey: ticketKeys.timeline(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}/timeline`).then((r) => r.data),
    enabled: !!id,
  });

export const useTicketComments = (id: string | undefined) =>
  useQuery<{ items: TicketComment[]; total: number }>({
    queryKey: ticketKeys.comments(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}/comments`, { params: { pageSize: 100 } }).then((r) => r.data),
    enabled: !!id,
  });

export const useAddComment = (id: string) => {
  const qc = useQueryClient();
  return useMutation<TicketComment, unknown, { body: string }>({
    mutationFn: (input) => api.post(`/tickets/${id}/comments`, input).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.comments(id) });
      qc.invalidateQueries({ queryKey: ticketKeys.timeline(id) });
    },
  });
};

export const useDeleteComment = (id: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (commentId) =>
      api.delete(`/tickets/${id}/comments/${commentId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.comments(id) }),
  });
};

export const useTicketDocs = (id: string | undefined) =>
  useQuery<TicketDoc[]>({
    queryKey: ticketKeys.docs(id ?? ''),
    queryFn: () => api.get(`/tickets/${id}/docs`).then((r) => r.data),
    enabled: !!id,
  });

export const useAttachDoc = (id: string) => {
  const qc = useQueryClient();
  return useMutation<
    TicketDoc,
    unknown,
    { fileUrl: string; fileName: string; mimeType?: string; fileSizeBytes?: number; docType?: TicketDoc['docType']; stageId?: string }
  >({
    mutationFn: (body) => api.post(`/tickets/${id}/docs`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.docs(id) }),
  });
};

export const useDeleteDoc = (id: string) => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (docId) => api.delete(`/tickets/${id}/docs/${docId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.docs(id) }),
  });
};
