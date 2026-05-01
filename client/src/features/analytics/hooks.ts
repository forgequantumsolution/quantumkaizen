import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface NCTrendRow {
  month: string;
  2024: number;
  2025: number;
  2026: number;
}

export interface HeatmapCell {
  date: string;
  count: number;
}

export interface KpiComparisonRow {
  metric: string;
  2024: number;
  2025: number;
  2026: number;
}

export interface AuditVolumeRow {
  month: string;
  2024: number;
  2025: number;
  2026: number;
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useNCTrends() {
  return useQuery<NCTrendRow[]>({
    queryKey: ['analytics', 'nc-trends'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/nc-trends');
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        return [] as NCTrendRow[];
      } catch {
        return [] as NCTrendRow[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHeatmap() {
  return useQuery<HeatmapCell[]>({
    queryKey: ['analytics', 'heatmap'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/heatmap');
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        return [] as HeatmapCell[];
      } catch {
        return [] as HeatmapCell[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useKpiComparison() {
  return useQuery<KpiComparisonRow[]>({
    queryKey: ['analytics', 'kpi-comparison'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/kpi-comparison');
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        return [] as KpiComparisonRow[];
      } catch {
        return [] as KpiComparisonRow[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditVolume() {
  return useQuery<AuditVolumeRow[]>({
    queryKey: ['analytics', 'audit-volume'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/audit-volume');
        if (Array.isArray(res.data?.data)) return res.data.data;
        if (Array.isArray(res.data)) return res.data;
        return [] as AuditVolumeRow[];
      } catch {
        return [] as AuditVolumeRow[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
