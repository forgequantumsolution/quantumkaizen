/**
 * Phase 3.5 — Stage form bindings API client.
 *
 * Endpoints (see docs/WORKFLOW_PHASE_3_5_PLAN.md §4):
 *   GET    /workflows/:id/stage-form-bindings   ?stageId=&includeInactive=
 *   POST   /workflows/:id/stage-form-bindings
 *   GET    /stage-form-bindings/:id
 *   PATCH  /stage-form-bindings/:id
 *   DELETE /stage-form-bindings/:id
 *   GET    /tickets/:id/stage-forms
 *   POST   /tickets/:id/forms/:formId/submissions
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserRef } from './workflow';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FormStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type FormSubmissionStatus = 'IN_PROGRESS' | 'SUBMITTED';

export interface StageFormBinding {
  id: string;
  workflowId: string;
  stageId: string;
  formId: string;
  isRequired: boolean;
  position: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string; canonicalId: string };
  form: {
    id: string;
    title: string;
    version: number;
    versionId: string;
    status: FormStatus;
  };
}

export interface TicketStageFormBinding extends StageFormBinding {
  latestSubmission: {
    id: string;
    formId: string;
    stageId: string | null;
    bindingId: string | null;
    status: FormSubmissionStatus;
    submittedAt: string | null;
    submittedBy: UserRef | null;
  } | null;
}

export interface TicketStageFormsResponse {
  bindings: TicketStageFormBinding[];
}

export interface SubmittedFormHistoryItem {
  id: string;
  formId: string;
  formTitle: string;
  stageId: string | null;
  stageName: string | null;
  status: FormSubmissionStatus;
  submittedAt: string | null;
  submittedBy: UserRef | null;
}

export interface TicketFormHistoryResponse {
  submissions: SubmittedFormHistoryItem[];
}

export interface CreateStageFormBindingBody {
  stageId: string;
  formId: string;
  isRequired?: boolean;
  position?: number;
}

export type UpdateStageFormBindingBody = Partial<{
  isRequired: boolean;
  position: number;
  isActive: boolean;
}>;

export interface CreateWorkflowSubmissionBody {
  bindingId: string;
  status?: FormSubmissionStatus;
  responses: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface WorkflowSubmissionResponse {
  id: string;
  formId: string;
  versionId: string;
  status: FormSubmissionStatus;
  ticketId: string | null;
  stageId: string | null;
  flowId: string | null;
  bindingId: string | null;
  submittedAt: string | null;
  submittedBy: UserRef | null;
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const stageFormKeys = {
  all: ['stage-forms'] as const,
  bindingsForWorkflow: (workflowId: string, stageId?: string) =>
    ['stage-forms', 'workflow', workflowId, { stageId: stageId ?? null }] as const,
  binding: (id: string) => ['stage-forms', 'binding', id] as const,
  ticket: (ticketId: string) => ['stage-forms', 'ticket', ticketId] as const,
  ticketHistory: (ticketId: string) =>
    ['stage-forms', 'ticket', ticketId, 'history'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export const useStageFormBindings = (
  workflowId: string | undefined,
  opts: { stageId?: string; includeInactive?: boolean } = {},
) =>
  useQuery<StageFormBinding[]>({
    queryKey: stageFormKeys.bindingsForWorkflow(workflowId ?? '', opts.stageId),
    queryFn: () => {
      const params: Record<string, string> = {};
      if (opts.stageId) params.stageId = opts.stageId;
      if (opts.includeInactive) params.includeInactive = 'true';
      return api
        .get(`/workflows/${workflowId}/stage-form-bindings`, { params })
        .then((r) => r.data);
    },
    enabled: !!workflowId,
  });

export const useStageFormBinding = (id: string | undefined) =>
  useQuery<StageFormBinding>({
    queryKey: stageFormKeys.binding(id ?? ''),
    queryFn: () => api.get(`/stage-form-bindings/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateStageFormBinding = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation<StageFormBinding, unknown, CreateStageFormBindingBody>({
    mutationFn: (body) =>
      api
        .post(`/workflows/${workflowId}/stage-form-bindings`, body)
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: stageFormKeys.all }),
  });
};

export const useUpdateStageFormBinding = (id: string) => {
  const qc = useQueryClient();
  return useMutation<StageFormBinding, unknown, UpdateStageFormBindingBody>({
    mutationFn: (body) =>
      api.patch(`/stage-form-bindings/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: stageFormKeys.all }),
  });
};

export const useDeleteStageFormBinding = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) =>
      api.delete(`/stage-form-bindings/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: stageFormKeys.all }),
  });
};

/**
 * Lists every binding for the ticket's CURRENT stage(s), each with its
 * latest submission (so the FE can render "submitted" vs "pending" pills).
 * Refetches on focus so a freshly-filled form surfaces without a manual
 * reload.
 */
export const useTicketStageForms = (ticketId: string | undefined) =>
  useQuery<TicketStageFormsResponse>({
    queryKey: stageFormKeys.ticket(ticketId ?? ''),
    queryFn: () => api.get(`/tickets/${ticketId}/stage-forms`).then((r) => r.data),
    enabled: !!ticketId,
  });

/**
 * Read-only history of every submitted form/checklist across all stages the
 * ticket has passed through. Powers the "Submitted Forms" view that keeps
 * filled forms visible after a stage is left or the ticket completes.
 */
export const useTicketFormHistory = (ticketId: string | undefined) =>
  useQuery<TicketFormHistoryResponse>({
    queryKey: stageFormKeys.ticketHistory(ticketId ?? ''),
    queryFn: () =>
      api.get(`/tickets/${ticketId}/form-submissions`).then((r) => r.data),
    enabled: !!ticketId,
  });

export const useCreateWorkflowSubmission = (ticketId: string, formId: string) => {
  const qc = useQueryClient();
  return useMutation<
    WorkflowSubmissionResponse,
    unknown,
    CreateWorkflowSubmissionBody
  >({
    mutationFn: (body) =>
      api
        .post(`/tickets/${ticketId}/forms/${formId}/submissions`, body)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: stageFormKeys.ticket(ticketId) });
    },
  });
};
