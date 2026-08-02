import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardOverview, type DashRange, type DashboardOverview, type PanelKey } from './api';

interface DashboardCtx {
  data: DashboardOverview | undefined;
  isLoading: boolean;
  isSample: boolean; // true when the backend is unreachable (empty offline shell)
  range: DashRange;
  setRange: (r: DashRange) => void;
  has: (panel: PanelKey) => boolean;
}

const Ctx = createContext<DashboardCtx | null>(null);

// UI range segment → API range key.
export const SEG_TO_RANGE: Record<string, DashRange> = { '7D': '7d', '1M': '30d', '3M': '90d', '12M': '1y', '3Y': '3y' };
export const RANGE_TO_SEG: Record<DashRange, string> = { '7d': '7D', '30d': '1M', '90d': '3M', '1y': '12M', '3y': '3Y' };

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DashRange>('30d');
  const siteId = useSiteStore((s) => s.selectedSiteId);
  const query = useDashboardOverview(range, siteId);

  const data = query.data ?? (query.isError ? offlineFallback(range) : undefined);
  const isSample = query.isError || !!data?.panels.snapshot.sample;

  const value = useMemo<DashboardCtx>(() => ({
    data,
    isLoading: query.isLoading && !data,
    isSample,
    range,
    setRange,
    has: (panel: PanelKey) => !!data?.layout.includes(panel),
  }), [data, query.isLoading, isSample, range]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Offline fallback — used only when the backend is unreachable. It renders the
// panel shells for the user's persona with EMPTY figures; it must never invent
// numbers, since an operator cannot tell fabricated QMS data from real data.
// ─────────────────────────────────────────────────────────────────────────────
function offlineFallback(range: DashRange): DashboardOverview {
  const user = useAuthStore.getState().user;
  const role = (user?.role ?? 'Quality Manager');
  const r = role.toLowerCase();
  const persona: DashboardOverview['scope']['persona'] =
    /admin|super|exec|director|head|chief/.test(r) ? 'leadership'
    : /qa|quality|compliance/.test(r) ? 'quality'
    : /lab|analyst|qc/.test(r) ? 'lab' : 'operations';

  const months = range === '1y' ? 12 : range === '3y' ? 12 : range === '7d' ? 7 : 3;
  const now = new Date();
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return `${MON[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
  });
  const trend = labels.map((month) => ({ month, count: 0 }));

  const layout: PanelKey[] = (
    persona === 'leadership' ? ['snapshot', 'scorecard', 'nonconformance', 'capa', 'complaints', 'documents', 'training', 'inspection', 'calibration', 'audit', 'activity']
    : persona === 'quality' ? ['snapshot', 'scorecard', 'nonconformance', 'capa', 'complaints', 'documents', 'training', 'audit', 'activity']
    : persona === 'lab' ? ['snapshot', 'scorecard', 'inspection', 'calibration', 'activity']
    : ['snapshot', 'nonconformance', 'capa', 'documents', 'training', 'activity']
  ) as PanelKey[];

  return {
    scope: {
      role, persona, userName: user?.name ?? 'User', department: user?.department ?? null,
      site: null, organization: null,
      range, canViewAll: persona === 'leadership' || persona === 'quality',
    },
    layout,
    panels: {
      snapshot: { sample: false, cards: [
        { key: 'openNCs', label: 'Open NCs', value: 0, deltaPct: 0, trend: 'flat', tone: 'bad' },
        { key: 'openCAPAs', label: 'Open CAPAs', value: 0, deltaPct: 0, trend: 'flat', tone: 'brand' },
        { key: 'pendingApprovals', label: 'Pending Approvals', value: 0, deltaPct: 0, trend: 'flat', tone: 'info' },
        { key: 'expiringDocs', label: 'Expiring Docs', value: 0, deltaPct: 0, trend: 'flat', tone: 'warn' },
        { key: 'overdueActions', label: 'Overdue Actions', value: 0, deltaPct: 0, trend: 'flat', tone: 'bad' },
      ] },
      nonconformance: {
        sample: false, trend,
        severityTrend: trend.map((t) => ({ month: t.month, Critical: 0, Major: 0, Minor: 0 })),
        byType: [],
        byDepartment: [],
      },
      capa: { sample: false, byStage: [], aging: [], onTimeClosureRate: 0 },
      complaints: { sample: false, trend: labels.map((month) => ({ month, received: 0, resolved: 0, pending: 0 })) },
      documents: { sample: false, pipeline: [] },
      training: { sample: false, byDept: [], overall: 0 },
      audit: { sample: false, findingsByDept: [], severityMix: [] },
      inspection: { sample: false, byResult: [], passRate: 0 },
      calibration: { sample: false, status: [] },
      scorecard: { sample: false, kpis: [] },
      activity: { sample: false, items: [] },
    },
  };
}
