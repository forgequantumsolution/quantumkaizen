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

// ── Mock data ──────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mockNCTrends: NCTrendRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [8, 6, 9, 7, 10, 8, 6, 9, 7, 8, 5, 6][i],
  2025: [7, 5, 8, 9, 7, 6, 8, 7, 9, 6, 7, 5][i],
  2026: [5, 4, 7, 6, 0, 0, 0, 0, 0, 0, 0, 0][i],  // current year partial
}));

const mockAuditVolume: AuditVolumeRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [2, 1, 3, 2, 3, 2, 1, 3, 2, 3, 2, 2][i],
  2025: [2, 2, 3, 3, 2, 3, 2, 3, 3, 2, 3, 2][i],
  2026: [3, 2, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockKpiComparison: KpiComparisonRow[] = [
  { metric: 'Non-Conformances Opened',   2024: 89,  2025: 84,  2026: 22  },
  { metric: 'CAPAs Initiated',           2024: 34,  2025: 31,  2026: 9   },
  { metric: 'Audits Conducted',          2024: 27,  2025: 30,  2026: 12  },
  { metric: 'Customer Complaints',       2024: 18,  2025: 14,  2026: 4   },
  { metric: 'Avg CAPA Closure Days',     2024: 38,  2025: 32,  2026: 29  },
  { metric: 'NC Closure Rate (%)',       2024: 81,  2025: 87,  2026: 91  },
  { metric: 'On-Time Delivery Rate (%)', 2024: 94,  2025: 96,  2026: 97  },
];

function buildMockHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // Realistic random NC counts — mostly 0s with occasional activity
    const r = Math.random();
    cells.push({ date: iso, count: r < 0.55 ? 0 : r < 0.75 ? 1 : r < 0.87 ? 2 : r < 0.93 ? 3 : r < 0.97 ? 5 : 8 });
  }
  return cells;
}

const mockHeatmap: HeatmapCell[] = buildMockHeatmap();

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useNCTrends() {
  return useQuery<NCTrendRow[]>({
    queryKey: ['analytics', 'nc-trends'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/nc-trends');
        if (Array.isArray(res.data?.data)) return res.data.data;
        return mockNCTrends;
      } catch {
        return mockNCTrends;
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
        return mockHeatmap;
      } catch {
        return mockHeatmap;
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
        return mockKpiComparison;
      } catch {
        return mockKpiComparison;
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
        return mockAuditVolume;
      } catch {
        return mockAuditVolume;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
