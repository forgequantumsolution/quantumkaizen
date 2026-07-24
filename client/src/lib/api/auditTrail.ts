/**
 * System audit trail API client.
 *
 * Distinct from `audit.ts` (the internal-audit *module*). This reads the
 * cross-module change history: who changed what, when, from where, and why.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TrailRow {
  id: string;
  seq: string;
  entity_type: string;
  entity_id: string;
  entity_label: string | null;
  module: string | null;
  action: string;
  field: string | null;
  value_type: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  reason_code: string | null;
  criticality: 'NORMAL' | 'CRITICAL';
  user_name: string;
  user_id: string | null;
  user_role: string | null;
  user_department: string | null;
  user_employee_id: string | null;
  on_behalf_of_id: string | null;
  actor_type: string;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  request_id: string | null;
  source: string | null;
  created_at: string;
  client_tz_offset_min: number | null;
  signature_id: string | null;
  chain_key: string | null;
  prev_hash: string | null;
  hash: string | null;
  sealed: boolean;
  diff: unknown;
}

export interface TrailFilters {
  entity_type?: string;
  entity_id?: string;
  module?: string;
  action?: string;
  criticality?: string;
  user?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface TrailPage {
  data: TrailRow[];
  meta: { total: number; page: number; page_size: number; pages: number };
}

export const useAuditTrailList = (filters: TrailFilters, enabled = true) =>
  useQuery<TrailPage>({
    queryKey: ['audit-trail', 'list', filters],
    queryFn: () => api.get('/audit-trail', { params: filters }).then((r) => r.data),
    enabled,
  });

/** Full change history for one record — the History tab on a detail page. */
export const useEntityHistory = (
  entityType: string,
  entityId: string | undefined,
  enabled = true,
) =>
  useQuery<{ data: TrailRow[] }>({
    queryKey: ['audit-trail', 'history', entityType, entityId ?? ''],
    queryFn: () => api.get(`/audit-trail/${entityType}/${entityId}`).then((r) => r.data),
    enabled: enabled && !!entityId,
  });

export const useTrailFacets = (enabled = true) =>
  useQuery<{ data: { entity_types: string[]; actions: string[]; modules: string[] } }>({
    queryKey: ['audit-trail', 'facets'],
    queryFn: () => api.get('/audit-trail/facets').then((r) => r.data),
    enabled,
  });

export const useChainStatus = (enabled = true) =>
  useQuery<{
    data: {
      intact: boolean;
      checked: number;
      unsealed: number;
      breaks: Array<{ seq: string; chainKey: string; reason: string }>;
    };
  }>({
    queryKey: ['audit-trail', 'chain'],
    queryFn: () => api.get('/audit-trail/chain').then((r) => r.data),
    enabled,
  });

/** Streams the CSV straight to a download without routing it through state. */
export const downloadTrailCsv = async (filters: TrailFilters) => {
  const res = await api.get('/audit-trail/export', { params: filters, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
