/**
 * LIMS 2.0 — Analytics & Data Review API client.
 * Backend routes are mounted under /api/lims-analytics/*.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ──
export interface StatusCount {
  status: string;
  count: number;
}
export interface AnalystCount {
  analyst: string;
  count: number;
}

export interface LimsDashboardKpis {
  samples_in_testing: number;
  pending_reviews: number;
  open_oos: number;
  oos_rate_30d: number;
  qc_rejects_30d: number;
  stability_due_pulls: number;
  equipment_overdue: number;
  certs_expiring_30d: number;
  coas_issued: number;
}
export interface LimsDashboard {
  samples_by_status: StatusCount[];
  kpis: LimsDashboardKpis;
}

export interface LimsTat {
  released_count: number;
  avg_tat_days: number;
  p90_tat_days: number;
  overdue_in_testing: number;
}

export interface LimsWorkload {
  by_status: StatusCount[];
  by_analyst: AnalystCount[];
  open_worklists: number;
}

export interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  user_name: string | null;
  created_at: string;
}

export interface AuditReviewParams {
  entity_type?: string;
  action?: string;
  user?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}
export interface AuditReviewResponse {
  total: number;
  page: number;
  page_size: number;
  data: AuditEntry[];
}

const keys = {
  all: ['lims-analytics'] as const,
  dashboard: ['lims-analytics', 'dashboard'] as const,
  tat: ['lims-analytics', 'tat'] as const,
  workload: ['lims-analytics', 'workload'] as const,
  auditReview: (p: AuditReviewParams) => ['lims-analytics', 'audit-review', p] as const,
  entityTypes: ['lims-analytics', 'audit-entity-types'] as const,
};

// ── Hooks ──
export const useLimsDashboard = () =>
  useQuery<LimsDashboard>({
    queryKey: keys.dashboard,
    queryFn: () => api.get('/lims-analytics/dashboard').then((r) => r.data),
  });

export const useLimsTat = () =>
  useQuery<LimsTat>({
    queryKey: keys.tat,
    queryFn: () => api.get('/lims-analytics/tat').then((r) => r.data),
  });

export const useLimsWorkload = () =>
  useQuery<LimsWorkload>({
    queryKey: keys.workload,
    queryFn: () => api.get('/lims-analytics/workload').then((r) => r.data),
  });

export const useAuditReview = (params: AuditReviewParams = {}) =>
  useQuery<AuditReviewResponse>({
    queryKey: keys.auditReview(params),
    queryFn: () => api.get('/lims-analytics/audit-review', { params }).then((r) => r.data),
  });

export const useAuditEntityTypes = () =>
  useQuery<{ data: string[] }>({
    queryKey: keys.entityTypes,
    queryFn: () => api.get('/lims-analytics/audit-entity-types').then((r) => r.data),
  });
