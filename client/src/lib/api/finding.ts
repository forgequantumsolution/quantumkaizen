/**
 * Generic Findings API client — findings on any findings-enabled module ticket,
 * and raising CAPA / Deviation child tickets from them. Routes mounted at /api.
 * See docs/findings-child-tickets-plan.md.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type FindingSeverity = 'OBSERVATION' | 'MINOR' | 'MAJOR' | 'CRITICAL';
export type FindingStatus = 'OPEN' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';

export interface Finding {
  id: string;
  finding_number: string;
  source_ticket_id: string;
  source_stage_id: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  recommendation: string | null;
  reference: string | null;
  is_generated: boolean;
  source_ticket: {
    id: string;
    unique_id: string;
    title: string;
    department: { id: string; name: string } | null;
  } | null;
  created_by: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface FindingChildren {
  capas: {
    id: string;
    capa_number: string;
    title: string;
    status: string;
    workflow_ticket_id: string | null;
  }[];
  tickets: { id: string; unique_id: string; title: string; module: string | null }[];
}

export interface FindingUpsert {
  source_ticket_id: string;
  source_stage_id?: string | null;
  severity: FindingSeverity;
  status?: FindingStatus;
  title: string;
  description: string;
  recommendation?: string | null;
  reference?: string | null;
}

export interface RaiseChildBody {
  child_type: 'CAPA' | 'DEVIATION';
  title?: string;
  description?: string | null;
  owner_id?: string | null;
  department_id?: string | null;
  due_date?: string | null;
  capa_type?: 'CORRECTIVE' | 'PREVENTIVE' | 'BOTH';
}

export interface ListFindingParams {
  workflow_type_id?: string;
  source_ticket_id?: string;
  status?: FindingStatus;
  severity?: FindingSeverity;
  department_id?: string;
  page?: number;
  page_size?: number;
}

const keys = {
  all: ['findings'] as const,
  forTicket: (ticketId: string) => ['findings', 'ticket', ticketId] as const,
  register: (p: ListFindingParams) => ['findings', 'register', p] as const,
  children: (id: string) => ['findings', 'children', id] as const,
};

// Findings on one ticket (the per-ticket Findings tab).
export const useTicketFindings = (ticketId: string, enabled = true) =>
  useQuery<{ data: Finding[] }>({
    queryKey: keys.forTicket(ticketId),
    queryFn: () => api.get(`/tickets/${ticketId}/findings`).then((r) => r.data),
    enabled: enabled && !!ticketId,
  });

// Module-wide findings register (the ModulePage Findings tab).
export const useFindingsRegister = (params: ListFindingParams, enabled = true) =>
  useQuery<{ data: Finding[]; total: number; page: number; page_size: number }>({
    queryKey: keys.register(params),
    queryFn: () => api.get('/findings', { params }).then((r) => r.data),
    enabled,
  });

export const useFindingChildren = (id: string, enabled = true) =>
  useQuery<{ data: FindingChildren }>({
    queryKey: keys.children(id),
    queryFn: () => api.get(`/findings/${id}/children`).then((r) => r.data),
    enabled: enabled && !!id,
  });

export const useCreateFinding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FindingUpsert) => api.post('/findings', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateFinding = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<FindingUpsert>) =>
      api.put(`/findings/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDeleteFinding = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/findings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useRaiseChild = (findingId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RaiseChildBody) =>
      api.post(`/findings/${findingId}/raise-child`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
      qc.invalidateQueries({ queryKey: ['ticket-children'] });
    },
  });
};

// Direct children of a ticket (for the Child records view).
export interface TicketChild {
  id: string;
  unique_id: string;
  title: string;
  module: string | null;
  stage: string | null;
  source_finding_id: string | null;
  capa_id: string | null;
  capa_number: string | null;
}

export const useTicketChildren = (ticketId: string, enabled = true) =>
  useQuery<{ data: TicketChild[] }>({
    queryKey: ['ticket-children', ticketId],
    queryFn: () => api.get(`/tickets/${ticketId}/children`).then((r) => r.data),
    enabled: enabled && !!ticketId,
  });
