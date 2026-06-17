import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

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

// Medical-device analytics — pulled from per-module medical-device mocks
// so the analytics page tells the same story as the QMS modules.
const mockMedicalDeviceNCTrends: NCTrendRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [3, 2, 4, 3, 5, 3, 2, 4, 3, 4, 2, 3][i],
  2025: [3, 2, 3, 4, 3, 2, 3, 3, 4, 2, 3, 2][i],
  2026: [4, 3, 5, 4, 0, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockMedicalDeviceAuditVolume: AuditVolumeRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1][i],
  2025: [1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1][i],
  2026: [2, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockMedicalDeviceKpiComparison: KpiComparisonRow[] = [
  { metric: 'Non-Conformances Opened',     2024: 47, 2025: 41, 2026: 13 },
  { metric: 'CAPAs Initiated',             2024: 22, 2025: 19, 2026: 6 },
  { metric: 'Audits Conducted',            2024: 18, 2025: 21, 2026: 7 },
  { metric: 'Customer / Vigilance Reports',2024: 14, 2025: 11, 2026: 3 },
  { metric: 'Avg CAPA Closure Days',       2024: 41, 2025: 36, 2026: 32 },
  { metric: 'NC Closure Rate (%)',         2024: 84, 2025: 89, 2026: 92 },
  { metric: 'EU MDR PSUR On-Time (%)',     2024: 88, 2025: 93, 2026: 96 },
];

function buildMockMedicalDeviceHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = Math.random();
    cells.push({ date: iso, count: r < 0.62 ? 0 : r < 0.82 ? 1 : r < 0.91 ? 2 : r < 0.96 ? 3 : 5 });
  }
  return cells;
}

const mockMedicalDeviceHeatmap: HeatmapCell[] = buildMockMedicalDeviceHeatmap();

// Dairy analytics — FSSAI / ISO 22000 themed datasets with seasonal microbio peaks
const mockDairyNCTrends: NCTrendRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [6, 5, 6, 8, 11, 14, 13, 11, 8, 6, 5, 5][i],
  2025: [5, 5, 6, 7, 11, 13, 13, 11, 7, 5, 5, 4][i],
  2026: [4, 4, 6, 7, 11, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockDairyAuditVolume: AuditVolumeRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [1, 1, 2, 2, 2, 1, 1, 2, 2, 2, 1, 1][i],
  2025: [2, 1, 2, 2, 1, 2, 1, 2, 2, 2, 2, 1][i],
  2026: [2, 1, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockDairyKpiComparison: KpiComparisonRow[] = [
  { metric: 'Non-Conformances Opened',     2024: 98, 2025: 94, 2026: 32 },
  { metric: 'CAPAs Initiated',             2024: 36, 2025: 34, 2026: 12 },
  { metric: 'Audits Conducted',            2024: 19, 2025: 22, 2026: 9 },
  { metric: 'Customer / Trade Complaints', 2024: 64, 2025: 58, 2026: 18 },
  { metric: 'Avg CAPA Closure Days',       2024: 32, 2025: 28, 2026: 24 },
  { metric: 'NC Closure Rate (%)',         2024: 84, 2025: 88, 2026: 91 },
  { metric: 'Raw-Milk Pass Rate (%)',      2024: 89, 2025: 91, 2026: 92 },
  { metric: 'Cold-Chain Excursion Rate (%)', 2024: 4.2, 2025: 3.1, 2026: 2.1 },
];

function buildMockDairyHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = Math.random();
    cells.push({ date: iso, count: r < 0.48 ? 0 : r < 0.72 ? 1 : r < 0.86 ? 2 : r < 0.94 ? 3 : 5 });
  }
  return cells;
}

const mockDairyHeatmap: HeatmapCell[] = buildMockDairyHeatmap();

// Biologics analytics — Mubadala Bio "DiabTec" (Abu Dhabi, UAE): biologics
// drug-substance + aseptic cartridge fill-finish (insulin, analogues, GLP-1).
// NC trends driven by aseptic/sterility/CCI/cold-chain; well-controlled GMP site.
const mockBiologicsNCTrends: NCTrendRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [4, 3, 5, 4, 6, 4, 3, 5, 4, 5, 3, 4][i],
  2025: [3, 3, 4, 4, 5, 3, 3, 4, 4, 3, 3, 2][i],
  2026: [3, 2, 4, 3, 0, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockBiologicsAuditVolume: AuditVolumeRow[] = MONTHS.map((month, i) => ({
  month,
  2024: [1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 1][i],   // internal + FDA/EMA inspections
  2025: [2, 1, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1][i],
  2026: [2, 1, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0][i],
}));

const mockBiologicsKpiComparison: KpiComparisonRow[] = [
  { metric: 'Non-Conformances Opened',       2024: 54,  2025: 47,  2026: 12  },
  { metric: 'CAPAs Initiated',               2024: 24,  2025: 20,  2026: 6   },
  { metric: 'Audits Conducted',              2024: 16,  2025: 19,  2026: 8   },
  { metric: 'Deviation Closure Days',        2024: 36,  2025: 30,  2026: 27  },
  { metric: 'Media-Fill Pass Rate (%)',      2024: 99,  2025: 99,  2026: 100 },
  { metric: 'Lot Release On-Time (%)',       2024: 92,  2025: 95,  2026: 97  },
  { metric: 'Right-First-Time Batch (%)',    2024: 91,  2025: 94,  2026: 96  },
  { metric: 'CAPA Effectiveness (%)',        2024: 86,  2025: 90,  2026: 93  },
  { metric: 'EM Excursion Rate (%)',         2024: 2.4, 2025: 1.6, 2026: 1.1 },
];

function buildMockBiologicsHeatmap(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const r = Math.random();
    cells.push({ date: iso, count: r < 0.66 ? 0 : r < 0.85 ? 1 : r < 0.93 ? 2 : r < 0.97 ? 3 : 5 });
  }
  return cells;
}

const mockBiologicsHeatmap: HeatmapCell[] = buildMockBiologicsHeatmap();

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useNCTrends() {
  const industry = useUserIndustry();
  const fallback = pickByIndustry(industry, mockNCTrends, { medical_device: mockMedicalDeviceNCTrends, dairy: mockDairyNCTrends, biologics: mockBiologicsNCTrends });
  return useQuery<NCTrendRow[]>({
    queryKey: ['analytics', 'nc-trends', industry ?? 'default'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/nc-trends');
        if (Array.isArray(res.data?.data)) return res.data.data;
        return fallback;
      } catch {
        return fallback;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useHeatmap() {
  const industry = useUserIndustry();
  const fallback = pickByIndustry(industry, mockHeatmap, { medical_device: mockMedicalDeviceHeatmap, dairy: mockDairyHeatmap, biologics: mockBiologicsHeatmap });
  return useQuery<HeatmapCell[]>({
    queryKey: ['analytics', 'heatmap', industry ?? 'default'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/heatmap');
        if (Array.isArray(res.data?.data)) return res.data.data;
        return fallback;
      } catch {
        return fallback;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useKpiComparison() {
  const industry = useUserIndustry();
  const fallback = pickByIndustry(industry, mockKpiComparison, { medical_device: mockMedicalDeviceKpiComparison, dairy: mockDairyKpiComparison, biologics: mockBiologicsKpiComparison });
  return useQuery<KpiComparisonRow[]>({
    queryKey: ['analytics', 'kpi-comparison', industry ?? 'default'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/kpi-comparison');
        if (Array.isArray(res.data?.data)) return res.data.data;
        return fallback;
      } catch {
        return fallback;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAuditVolume() {
  const industry = useUserIndustry();
  const fallback = pickByIndustry(industry, mockAuditVolume, { medical_device: mockMedicalDeviceAuditVolume, dairy: mockDairyAuditVolume, biologics: mockBiologicsAuditVolume });
  return useQuery<AuditVolumeRow[]>({
    queryKey: ['analytics', 'audit-volume', industry ?? 'default'],
    queryFn: async () => {
      try {
        const res = await api.get('/analytics/audit-volume');
        if (Array.isArray(res.data?.data)) return res.data.data;
        return fallback;
      } catch {
        return fallback;
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
