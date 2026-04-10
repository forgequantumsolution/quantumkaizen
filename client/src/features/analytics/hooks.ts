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
      const res = await api.get('/analytics/nc-trends');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHeatmap() {
  return useQuery<HeatmapCell[]>({
    queryKey: ['analytics', 'heatmap'],
    queryFn: async () => {
      const res = await api.get('/analytics/heatmap');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useKpiComparison() {
  return useQuery<KpiComparisonRow[]>({
    queryKey: ['analytics', 'kpi-comparison'],
    queryFn: async () => {
      const res = await api.get('/analytics/kpi-comparison');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditVolume() {
  return useQuery<AuditVolumeRow[]>({
    queryKey: ['analytics', 'audit-volume'],
    queryFn: async () => {
      const res = await api.get('/analytics/audit-volume');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
