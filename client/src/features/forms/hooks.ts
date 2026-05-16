import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  FieldType,
  FormDetailResponse,
  FormKind,
  FormListItem,
  FormSectionDef,
  FormType,
  SubmissionListItem,
} from './types';

// Backend wraps GETs in { status, data: <payload> }. Unwrap once here.
const unwrap = async <T>(url: string, params?: Record<string, unknown>): Promise<T> => {
  const r = await api.get(url, { params });
  return (r.data?.data ?? r.data) as T;
};

// ─── Forms ────────────────────────────────────────────
export function useForms(params?: {
  search?: string;
  page_number?: number;
  page_size?: number;
  is_completed?: 'true' | 'false';
  form_type_id?: string;
  kind?: FormKind;
}) {
  return useQuery({
    queryKey: ['forms', params],
    queryFn: () =>
      unwrap<{ forms: FormListItem[]; obj_count: number; max_rows: number }>(
        '/forms/form/get/',
        params
      ),
  });
}

export function useFormDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['form', id],
    queryFn: () => unwrap<FormDetailResponse>(`/forms/form/fields/get/${id}/`),
    enabled: !!id,
  });
}

export function useCreateForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      type_id?: string | null;
      kind?: FormKind;
    }) => {
      const r = await api.post('/forms/form/create/', input);
      return r.data?.data as {
        form_id: string;
        id: string;
        version_id: string;
        kind?: FormKind;
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

export function useSaveFormFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      sections: FormSectionDef[];
      title?: string;
      description?: string | null;
      form_type?: string | null;
    }) => {
      const r = await api.post(`/forms/form/fields/create/${input.id}/`, {
        sections: input.sections,
        form_details: {
          title: input.title,
          description: input.description,
          form_type: input.form_type,
        },
      });
      return r.data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['forms'] });
      qc.invalidateQueries({ queryKey: ['form', vars.id] });
    },
  });
}

export function useSaveDraft() {
  return useMutation({
    mutationFn: async (input: {
      id: string;
      sections: FormSectionDef[];
      title?: string;
      description?: string | null;
    }) => {
      const r = await api.post(`/forms/form_draft/save/${input.id}/`, {
        draft_data: { sections: input.sections },
        form_details: {
          title: input.title,
          description: input.description,
        },
      });
      return r.data;
    },
  });
}

export function useDeleteForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/forms/form/delete/${id}/`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forms'] }),
  });
}

// ─── Field types & form types ───────────────────────
export function useFieldTypes() {
  return useQuery({
    queryKey: ['field-types'],
    queryFn: async () => {
      const r = await api.get('/forms/field_types/');
      return (r.data?.data?.field_types ?? []) as FieldType[];
    },
  });
}

export function useFormTypes() {
  return useQuery({
    queryKey: ['form-types'],
    queryFn: async () => {
      const r = await api.get('/forms/form_types/');
      return (r.data?.data?.data ?? []) as FormType[];
    },
  });
}

export function useCreateFieldType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      description?: string;
      data_type?: string;
    }) => {
      const r = await api.post('/forms/field_types/create/', input);
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-types'] }),
  });
}

export function useDeleteFieldType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/forms/field_types/delete/${id}/`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-types'] }),
  });
}

export function useCreateFormType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const r = await api.post('/forms/form_types/create/', input);
      // Backend envelope: { status, message, data: { id, name, version_id } }
      return (r.data?.data ?? r.data) as {
        id: string;
        name: string;
        version_id?: string;
      };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form-types'] }),
  });
}

// ─── Submissions ────────────────────────────────────
export function useSubmissions(params?: { form_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['form-submissions', params],
    queryFn: async () => {
      const r = await api.get('/form-submissions', { params });
      return (r.data?.data ?? r.data) as {
        items: SubmissionListItem[];
        total: number;
      };
    },
  });
}

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      formId: string;
      responses: Record<string, unknown>;
      status?: 'IN_PROGRESS' | 'SUBMITTED';
      meta?: Record<string, unknown>;
    }) => {
      const r = await api.post(`/form-submissions/form/${input.formId}`, {
        responses: input.responses,
        status: input.status ?? 'SUBMITTED',
        meta: input.meta,
      });
      return r.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['form-submissions'] }),
  });
}
