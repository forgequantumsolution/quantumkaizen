import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSiteStore } from '@/stores/siteStore';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardOverview, type DashRange, type DashboardOverview, type PanelKey } from './api';

interface DashboardCtx {
  data: DashboardOverview | undefined;
  isLoading: boolean;
  isSample: boolean; // true when showing the offline/empty fallback
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
// Offline fallback — used only when the backend is unreachable (demo deploy).
// The backend already substitutes sample data when the DB is empty.
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
  const trend = labels.map((month, i) => ({ month, count: 4 + ((i * 3 + 5) % 8) }));
  const total = trend.reduce((s, t) => s + t.count, 0);

  const layout: PanelKey[] = (
    persona === 'leadership' ? ['snapshot', 'scorecard', 'nonconformance', 'capa', 'complaints', 'documents', 'training', 'inspection', 'calibration', 'audit', 'activity']
    : persona === 'quality' ? ['snapshot', 'scorecard', 'nonconformance', 'capa', 'complaints', 'documents', 'training', 'audit', 'activity']
    : persona === 'lab' ? ['snapshot', 'scorecard', 'inspection', 'calibration', 'activity']
    : ['snapshot', 'nonconformance', 'capa', 'documents', 'training', 'activity']
  ) as PanelKey[];

  return {
    scope: {
      role, persona, userName: user?.name ?? 'User', department: user?.department ?? null,
      site: null, organization: { name: 'Quantum Kairoz', industry: 'Pharma & Life Sciences', standards: ['ISO 9001', 'GMP'] },
      range, canViewAll: persona === 'leadership' || persona === 'quality',
    },
    layout,
    panels: {
      snapshot: { sample: true, cards: [
        { key: 'openNCs', label: 'Open NCs', value: 11, deltaPct: 8, trend: 'up', tone: 'bad' },
        { key: 'openCAPAs', label: 'Open CAPAs', value: 6, deltaPct: -12, trend: 'down', tone: 'brand' },
        { key: 'pendingApprovals', label: 'Pending Approvals', value: 4, deltaPct: 0, trend: 'flat', tone: 'info' },
        { key: 'expiringDocs', label: 'Expiring Docs', value: 2, deltaPct: 0, trend: 'flat', tone: 'warn' },
        { key: 'overdueActions', label: 'Overdue Actions', value: 3, deltaPct: 5, trend: 'up', tone: 'bad' },
      ] },
      nonconformance: {
        sample: true, trend,
        severityTrend: trend.map((t) => ({ month: t.month, Critical: Math.round(t.count * 0.15), Major: Math.round(t.count * 0.45), Minor: Math.max(0, t.count - Math.round(t.count * 0.15) - Math.round(t.count * 0.45)) })),
        byType: [
          { type: 'Deviation', count: Math.round(total * 0.3) }, { type: 'Product NC', count: Math.round(total * 0.24) },
          { type: 'Process NC', count: Math.round(total * 0.26) }, { type: 'OOS', count: Math.round(total * 0.12) }, { type: 'Complaint', count: Math.round(total * 0.08) },
        ],
        byDepartment: [
          { dept: 'Production', count: Math.round(total * 0.32) }, { dept: 'QC Lab', count: Math.round(total * 0.24) },
          { dept: 'Warehouse', count: Math.round(total * 0.18) }, { dept: 'QA', count: Math.round(total * 0.14) }, { dept: 'Engineering', count: Math.round(total * 0.12) },
        ],
      },
      capa: {
        sample: true,
        byStage: [
          { stage: 'Open', count: 4 }, { stage: 'Investigation', count: 3 }, { stage: 'Plan', count: 5 },
          { stage: 'Implementation', count: 9 }, { stage: 'Verification', count: 4 }, { stage: 'Closed', count: 24 },
        ],
        aging: [{ bucket: '0-15d', count: 6 }, { bucket: '16-30d', count: 4 }, { bucket: '31-60d', count: 3 }, { bucket: '60d+', count: 2 }],
        onTimeClosureRate: 87,
      },
      complaints: { sample: true, trend: labels.map((month, i) => ({ month, received: 5 + (i % 4), resolved: 4 + ((i + 1) % 4), pending: (i % 3) })) },
      documents: { sample: true, pipeline: [
        { status: 'Draft', count: 9, fill: '#94a3b8' }, { status: 'Under Review', count: 6, fill: '#f59e0b' },
        { status: 'Approved', count: 4, fill: '#0ea5e9' }, { status: 'Effective', count: 52, fill: '#10b981' }, { status: 'Superseded', count: 8, fill: '#e2e8f0' },
      ] },
      training: { sample: true, byDept: [
        { dept: 'QA', compliance: 98 }, { dept: 'Regulatory', compliance: 95 }, { dept: 'QC', compliance: 96 },
        { dept: 'Production', compliance: 93 }, { dept: 'Engineering', compliance: 90 }, { dept: 'Warehouse', compliance: 85 },
      ], overall: 93 },
      audit: { sample: true, findingsByDept: [
        { dept: 'QC Lab', Major: 4, Minor: 7, OFI: 3 }, { dept: 'Production', Major: 3, Minor: 6, OFI: 4 },
        { dept: 'QA', Major: 2, Minor: 4, OFI: 5 }, { dept: 'Warehouse', Major: 1, Minor: 3, OFI: 2 }, { dept: 'Engineering', Major: 1, Minor: 2, OFI: 3 },
      ], severityMix: [{ name: 'Critical', value: 3 }, { name: 'Major', value: 11 }, { name: 'Minor', value: 24 }, { name: 'Observation', value: 15 }] },
      inspection: { sample: true, byResult: [{ result: 'Pass', count: 142 }, { result: 'Fail', count: 11 }, { result: 'Conditional', count: 18 }, { result: 'Pending', count: 7 }], passRate: 87.5 },
      calibration: { sample: true, status: [
        { status: 'Current', count: 12, fill: '#22C55E' }, { status: 'Due Soon', count: 3, fill: '#F59E0B' },
        { status: 'Overdue', count: 2, fill: '#EF4444' }, { status: 'Out of Service', count: 1, fill: '#94a3b8' },
      ] },
      scorecard: { sample: true, kpis: [
        { label: 'CAPA Closure Rate', value: '87%', sub: 'Within target', tone: 'good' },
        { label: 'NC Closure Rate', value: '82%', sub: 'This period', tone: 'good' },
        { label: 'First-Pass Inspection', value: '94.2%', sub: 'vs 95% target', tone: 'warn' },
        { label: 'On-Time CAPA', value: '85%', sub: 'Closed by due date', tone: 'good' },
      ] },
      activity: { sample: true, items: [
        { id: 's0', action: 'CREATE', entityType: 'NON_CONFORMANCE', entityId: 'NC-2025-0312', userName: 'Priya Sharma', createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
        { id: 's1', action: 'APPROVE', entityType: 'DOCUMENT', entityId: 'SOP-QC-088', userName: 'Rajesh Kumar', createdAt: new Date(Date.now() - 9 * 3600_000).toISOString() },
        { id: 's2', action: 'CLOSE', entityType: 'CAPA', entityId: 'CAPA-2025-0201', userName: 'Anita Desai', createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
        { id: 's3', action: 'PUBLISH', entityType: 'DOCUMENT', entityId: 'BMR-2025-112', userName: 'Sunita Rao', createdAt: new Date(Date.now() - 50 * 3600_000).toISOString() },
      ] },
    },
  };
}
