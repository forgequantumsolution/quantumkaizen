import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror backend/src/modules/dashboard/dashboard.service.ts
// ─────────────────────────────────────────────────────────────────────────────
export type DashRange = '7d' | '30d' | '90d' | '1y' | '3y';
export type Persona = 'leadership' | 'quality' | 'lab' | 'operations';
export type PanelKey =
  | 'snapshot' | 'scorecard' | 'nonconformance' | 'capa' | 'complaints'
  | 'documents' | 'training' | 'inspection' | 'calibration' | 'audit' | 'activity';

export interface SnapshotCard {
  key: string; label: string; value: number; deltaPct: number;
  trend: 'up' | 'down' | 'flat'; tone: 'bad' | 'brand' | 'info' | 'warn' | 'good';
}
export interface TrendPoint { month: string; count: number }
export interface SeverityPoint { month: string; Critical: number; Major: number; Minor: number }
export interface NamedCount { count: number }

export interface DashboardOverview {
  scope: {
    role: string; persona: Persona; userName: string;
    department: string | null;
    site: { id: string; code: string; name: string } | null;
    organization: { name: string; industry: string; standards: string[] } | null;
    range: DashRange; canViewAll: boolean;
  };
  layout: PanelKey[];
  panels: {
    snapshot: { sample: boolean; cards: SnapshotCard[] };
    nonconformance: {
      sample: boolean;
      trend: TrendPoint[];
      severityTrend: SeverityPoint[];
      byType: { type: string; count: number }[];
      byDepartment: { dept: string; count: number }[];
    };
    capa: {
      sample: boolean;
      byStage: { stage: string; count: number }[];
      aging: { bucket: string; count: number }[];
      onTimeClosureRate: number;
    };
    complaints: { sample: boolean; trend: { month: string; received: number; resolved: number; pending: number }[] };
    documents: { sample: boolean; pipeline: { status: string; count: number; fill: string }[] };
    training: { sample: boolean; byDept: { dept: string; compliance: number }[]; overall: number };
    audit: {
      sample: boolean;
      findingsByDept: { dept: string; Major: number; Minor: number; OFI: number }[];
      severityMix: { name: string; value: number }[];
    };
    inspection: { sample: boolean; byResult: { result: string; count: number }[]; passRate: number };
    calibration: { sample: boolean; status: { status: string; count: number; fill: string }[] };
    scorecard: { sample: boolean; kpis: { label: string; value: string; sub: string; tone: string }[] };
    activity: { sample: boolean; items: { id: string; action: string; entityType: string; entityId: string; userName: string; createdAt: string }[] };
  };
}

export const RANGE_LABEL: Record<DashRange, string> = {
  '7d': 'Last 7 Days', '30d': 'Last 30 Days', '90d': 'Last 3 Months', '1y': 'Last 12 Months', '3y': 'Last 3 Years',
};

// ─────────────────────────────────────────────────────────────────────────────
// Query hook — falls back to a representative sample when the API is offline
// (mirrors the app-wide demo-deploy pattern where hooks catch → mock).
// ─────────────────────────────────────────────────────────────────────────────
export function useDashboardOverview(range: DashRange, siteId: string | null) {
  return useQuery({
    queryKey: ['dashboard-overview', range, siteId],
    queryFn: async (): Promise<DashboardOverview> => {
      const res = await api.get('/dashboard/overview', {
        params: { range, ...(siteId ? { siteId } : {}) },
      });
      return res.data as DashboardOverview;
    },
    placeholderData: (prev) => prev, // keep last data while switching range
    staleTime: 60_000,
    retry: 1,
  });
}
