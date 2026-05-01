import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { Document, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

const flattenDoc = (d: Record<string, unknown>) => flattenUsers(d, ['owner', 'createdBy', 'updatedBy']);

// ── Hooks ────────────────────────────────────────────────────────────────────

interface DocumentFilters {
  status?: string;
  level?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useDocuments(filters: DocumentFilters = {}) {
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ['documents', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/dms/documents', { params: filters });
        return unwrapList<Document>(data, flattenDoc as any);
      } catch {
        return {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 0,
        };
      }
    },
    staleTime: 30_000,
  });
}

export function useDocument(id: string) {
  return useQuery<Document | null>({
    queryKey: ['documents', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/dms/documents/${id}`);
        const item = unwrapItem<Document>(data, flattenDoc as any);
        return item ?? null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/dms/documents', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document created successfully');
    },
    onError: () => {
      toast.error('Failed to create document');
    },
  });
}

// ── Template Types ──────────────────────────────────────────────────────────

export interface TemplateVersion {
  version: string;
  date: string;
  changes: string;
  author: string;
}

export interface DocumentTemplate {
  id: string;
  templateId: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  documentLevel: string;
  author: string;
  downloads: number;
  documentsCreated: number;
  activeUsers: number;
  sections: string[];
  fields: string[];
  guidelines: string[];
  tags: string[];
  applicableDepartments?: string[];
  versions: TemplateVersion[];
  createdAt: string;
  updatedAt: string;
}

// ── Template Hooks ──────────────────────────────────────────────────────────

interface TemplateFilters {
  search?: string;
  category?: string;
}

export function useTemplates(filters: TemplateFilters = {}) {
  return useQuery<DocumentTemplate[]>({
    queryKey: ['dms', 'templates', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/dms/templates', { params: filters });
        return Array.isArray(data) ? (data as DocumentTemplate[]) : [];
      } catch {
        return [] as DocumentTemplate[];
      }
    },
    staleTime: 30_000,
  });
}

export function useTemplate(id: string) {
  return useQuery<DocumentTemplate | null>({
    queryKey: ['dms', 'templates', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/dms/templates/${id}`);
        return (data?.id ? data : null) as DocumentTemplate | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  category: string;
  documentLevel: string;
  industry: string;
  applicableDepartments: string[];
  tags?: string[];
}

export function useCreateTemplate() {
  const [isLoading, setIsLoading] = React.useState(false);

  const mutateAsync = async (payload: CreateTemplatePayload): Promise<DocumentTemplate> => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/dms/templates', payload);
      return data as DocumentTemplate;
    } finally {
      setIsLoading(false);
    }
  };

  return { mutateAsync, isLoading };
}
