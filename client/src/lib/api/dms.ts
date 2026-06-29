/**
 * DMS — controlled document API client.
 * Backend: /api/dms/documents (see backend/src/modules/dms).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type DocumentType =
  | 'SOP'
  | 'POLICY'
  | 'PROTOCOL'
  | 'WORK_INSTRUCTION'
  | 'FORM_TEMPLATE'
  | 'MANUAL'
  | 'SPECIFICATION'
  | 'OTHER';

export type DocumentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'EFFECTIVE'
  | 'SUPERSEDED'
  | 'RETIRED';

export type DocContentType = 'EDITOR' | 'FILE';

export interface DocVersion {
  id: string;
  version: number;
  version_label: string;
  content_type: DocContentType;
  change_summary: string | null;
  author_id: string | null;
  author_name: string | null;
  is_locked: boolean;
  created_at: string;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  content?: string | null;
  file_data?: string | null;
}

export interface DocSummary {
  id: string;
  doc_number: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  description: string | null;
  department_id: string | null;
  department_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  current_version_id: string | null;
  effective_date: string | null;
  review_due_date: string | null;
  version_count: number;
  latest_version_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocDetail extends DocSummary {
  working_version: DocVersion | null;
  current_version: DocVersion | null;
  versions: DocVersion[];
}

export interface ListDocsResponse {
  data: DocSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface ListDocsParams {
  page?: number;
  page_size?: number;
  status?: DocumentStatus;
  type?: DocumentType;
  search?: string;
  review_due?: boolean;
}

export type ReceiptStatus = 'PENDING' | 'ACKNOWLEDGED';

export interface Receipt {
  id: string;
  user_id: string;
  user_name: string | null;
  status: ReceiptStatus;
  assigned_by_name: string | null;
  assigned_at: string;
  acknowledged_at: string | null;
}

export interface ReceiptsResponse {
  version_id: string | null;
  total: number;
  acknowledged: number;
  pending: number;
  my_status: ReceiptStatus | null;
  receipts: Receipt[];
}

export interface MyReadsResponse {
  count: number;
  items: {
    receipt_id: string;
    document_id: string;
    doc_number: string;
    title: string;
    type: DocumentType;
    assigned_at: string;
  }[];
}

export interface FilePayload {
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | null;
  file_data?: string | null;
}

export interface CreateDocBody extends FilePayload {
  title: string;
  type: DocumentType;
  description?: string | null;
  department_id?: string | null;
  owner_id?: string | null;
  content_type?: DocContentType;
  content?: string | null;
}

export type UpdateDocBody = Partial<
  Pick<CreateDocBody, 'title' | 'type' | 'description' | 'department_id' | 'owner_id'>
>;

export interface SaveContentBody extends FilePayload {
  content_type?: DocContentType;
  content?: string | null;
  change_summary?: string | null;
}

const keys = {
  all: ['dms', 'documents'] as const,
  list: (p: ListDocsParams) => ['dms', 'documents', 'list', p] as const,
  detail: (id: string) => ['dms', 'documents', id] as const,
  receipts: (id: string) => ['dms', 'documents', id, 'receipts'] as const,
  myReads: ['dms', 'my-reads'] as const,
};

export const useDocuments = (params: ListDocsParams = {}) =>
  useQuery<ListDocsResponse>({
    queryKey: keys.list(params),
    queryFn: () => api.get('/dms/documents', { params }).then((r) => r.data),
  });

export const useDocument = (id: string | undefined) =>
  useQuery<DocDetail>({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => api.get(`/dms/documents/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateDocument = () => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, CreateDocBody>({
    mutationFn: (body) => api.post('/dms/documents', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useUpdateDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, UpdateDocBody>({
    mutationFn: (body) => api.put(`/dms/documents/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useSaveContent = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, SaveContentBody>({
    mutationFn: (body) => api.put(`/dms/documents/${id}/content`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useSubmitDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, void>({
    mutationFn: () => api.post(`/dms/documents/${id}/submit`, {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useApproveDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, { credential: string; review_period_days?: number }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/approve`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useRejectDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, { reason: string }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/reject`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useReviseDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, { change_summary?: string | null }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/revise`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useIssueDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, { review_period_days?: number }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/issue`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useRetireDocument = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, void>({
    mutationFn: () => api.post(`/dms/documents/${id}/retire`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useMarkReviewed = (id: string) => {
  const qc = useQueryClient();
  return useMutation<DocDetail, unknown, { review_period_days?: number }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/review`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const useDocumentReceipts = (id: string | undefined) =>
  useQuery<ReceiptsResponse>({
    queryKey: keys.receipts(id ?? ''),
    queryFn: () => api.get(`/dms/documents/${id}/receipts`).then((r) => r.data),
    enabled: !!id,
  });

export const useAssignReaders = (id: string) => {
  const qc = useQueryClient();
  return useMutation<ReceiptsResponse, unknown, { user_ids: string[] }>({
    mutationFn: (body) => api.post(`/dms/documents/${id}/readers`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.receipts(id) });
      qc.invalidateQueries({ queryKey: keys.myReads });
    },
  });
};

export const useAcknowledgeRead = (id: string) => {
  const qc = useQueryClient();
  return useMutation<ReceiptsResponse, unknown, void>({
    mutationFn: () => api.post(`/dms/documents/${id}/acknowledge`, {}).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.receipts(id) });
      qc.invalidateQueries({ queryKey: keys.myReads });
    },
  });
};

export const useMyPendingReads = () =>
  useQuery<MyReadsResponse>({
    queryKey: keys.myReads,
    queryFn: () => api.get('/dms/my-reads').then((r) => r.data),
  });

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: (id) => api.delete(`/dms/documents/${id}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
};

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  SOP: 'SOP',
  POLICY: 'Policy',
  PROTOCOL: 'Protocol',
  WORK_INSTRUCTION: 'Work Instruction',
  FORM_TEMPLATE: 'Form Template',
  MANUAL: 'Manual',
  SPECIFICATION: 'Specification',
  OTHER: 'Other',
};
