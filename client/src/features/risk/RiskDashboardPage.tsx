/**
 * Risk overview — the module's flagship screen.
 *
 * Everything on this page is a projection of server-computed figures. The heat
 * map cells are counts the API returned; the colours are the tenant's own
 * framework level colours resolved from the framework configuration (matrix
 * cells when the framework uses MATRIX_LOOKUP, otherwise the score band). No
 * number here is derived, estimated or filled in when data is missing — panels
 * with nothing to show say so.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Select as AntSelect } from 'antd';
import {
  ShieldAlert,
  AlertTriangle,
  CalendarClock,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  riskKeys,
  useRiskFramework,
  useRiskHeatmap,
  useRiskRegisters,
  useRiskSummary,
  type RiskFramework,
  type RiskHeatmap,
} from '@/lib/api/risk';
import {
  ChartCard,
  StatTile,
  EmptyChart,
  CategoryParetoChart,
  TrendLineChart,
  PALETTE,
} from '@/components/analytics';
import { Card } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';

// ── Analytics payloads served by /api/risk/analytics/* ──────────────────────
// These endpoints are read-only projections used by this page alone, so their
// shapes are declared here rather than widening the shared API client.

interface ByCategoryResponse {
  total: number;
  categories: {
    category_id: string | null;
    category_name: string;
    color: string | null;
    risk_count: number;
    avg_residual_score: number | null;
    cumulative_share: number;
  }[];
}

interface TrendResponse {
  months: string[];
  series: { level_code: string; level_label: string; color: string | null; counts: number[] }[];
  avg_residual: (number | null)[];
  scored_counts: number[];
  total_snapshots: number;
}

interface OverdueResponse {
  overdue_reviews: {
    id: string;
    due_at: string;
    days_overdue: number;
    risk_id: string;
    risk_number: string;
    title: string;
    status: string;
    residual_score: number | null;
    register: { id: string; register_number: string; name: string } | null;
  }[];
  counts: {
    overdue_reviews: number;
    overdue_controls: number;
    risks_past_review_date: number;
    total: number;
  };
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07" → "Jul 26". */
const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_SHORT[idx] ?? m} ${(y ?? '').slice(2)}`;
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * The framework level a (rowRank, colRank) cell resolves to. Mirrors the
 * server's resolution order so the dashboard cannot show a colour the scoring
 * engine would disagree with: an explicit matrix cell wins, otherwise the score
 * the formula produces is matched against the level bands.
 */
function resolveCellLevel(
  framework: RiskFramework | undefined,
  rowKey: string,
  rowRank: number,
  colKey: string,
  colRank: number,
) {
  if (!framework) return null;
  const cell = framework.matrix_cells?.find(
    (c) =>
      c.row_factor_key === rowKey &&
      c.row_rank === rowRank &&
      c.col_factor_key === colKey &&
      c.col_rank === colRank,
  );
  if (cell) return framework.levels.find((l) => l.id === cell.level_id) ?? null;
  if (framework.formula === 'MATRIX_LOOKUP') return null;

  const score = framework.formula === 'SUM' ? rowRank + colRank : rowRank * colRank;
  return (
    framework.levels.find(
      (l) =>
        l.min_score != null &&
        score >= l.min_score &&
        (l.max_score == null || score <= l.max_score),
    ) ?? null
  );
}

export default function RiskDashboardPage() {
  const nav = useNavigate();
  const canReadRegisters = useHasPermission('risk_register.read');
  const [registerId, setRegisterId] = useState<string | undefined>(undefined);
  const [stage, setStage] = useState<'INITIAL' | 'RESIDUAL'>('RESIDUAL');

  const heatmapParams = { registerId, stage };
  const { data: heatmap, isLoading: heatmapLoading, error: heatmapError } =
    useRiskHeatmap(heatmapParams);
  const { data: summary } = useRiskSummary({ registerId });
  const { data: registerPage } = useRiskRegisters(
    canReadRegisters ? { isActive: true, page: 1, pageSize: 200 } : undefined,
  );
  const { data: framework } = useRiskFramework(heatmap?.framework?.id ?? '');

  const { data: byCategory } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'by-category', registerId ?? null],
    queryFn: () =>
      api
        .get('/risk/analytics/by-category', { params: { registerId } })
        .then((r) => r.data.data as ByCategoryResponse),
  });

  const { data: trend } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'trend', registerId ?? null],
    queryFn: () =>
      api
        .get('/risk/analytics/trend', { params: { registerId, months: 12 } })
        .then((r) => r.data.data as TrendResponse),
  });

  const { data: overdue } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'overdue', registerId ?? null],
    queryFn: () =>
      api
        .get('/risk/analytics/overdue', { params: { registerId, limit: 10 } })
        .then((r) => r.data.data as OverdueResponse),
  });

  const cellIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of heatmap?.cells ?? []) map.set(`${c.row_rank}:${c.col_rank}`, c.count);
    return map;
  }, [heatmap]);

  const paretoData = useMemo(
    () =>
      (byCategory?.categories ?? []).map((c) => ({
        name: c.category_name,
        value: c.risk_count,
        ...(c.color ? { color: c.color } : {}),
      })),
    [byCategory],
  );

  const trendRows = useMemo(
    () =>
      (trend?.months ?? []).map((m, i) => ({
        month: monthLabel(m),
        avg: trend?.avg_residual?.[i] ?? 0,
        scored: trend?.scored_counts?.[i] ?? 0,
      })),
    [trend],
  );

  const openCell = (rowRank: number, colRank: number) => {
    if (!heatmap) return;
    const level = resolveCellLevel(
      framework,
      heatmap.axes.row.key,
      rowRank,
      heatmap.axes.col.key,
      colRank,
    );
    const params = new URLSearchParams();
    if (registerId) params.set('registerId', registerId);
    if (level) params.set('levelCode', level.code);
    nav(`/risk/risks${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const registers = registerPage?.data ?? [];
  const byStatus = summary?.by_status ?? {};
  const openRisks =
    summary != null ? summary.total - (byStatus.CLOSED ?? 0) : 0;

  return (
    <div className="space-y-4">
      {/* Scope controls */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Risk overview</h2>
          <p className="text-xs text-gray-500">
            Live position across {registerId ? 'the selected register' : 'every risk register'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canReadRegisters && (
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="All registers"
              style={{ width: 240 }}
              value={registerId}
              onChange={(v) => setRegisterId(v ?? undefined)}
              options={registers.map((r) => ({
                value: r.id,
                label: `${r.register_number} — ${r.name}`,
              }))}
            />
          )}
          <AntSelect
            style={{ width: 150 }}
            value={stage}
            onChange={(v) => setStage(v)}
            options={[
              { value: 'RESIDUAL', label: 'Residual risk' },
              { value: 'INITIAL', label: 'Initial risk' },
            ]}
          />
        </div>
      </div>

      {/* KPI tiles — server-computed counts only. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<ShieldAlert size={16} />}
          label="Total risks"
          value={summary?.total ?? '—'}
          hint={summary ? `${openRisks} open` : 'Loading…'}
          tone="blue"
          onClick={() => nav('/risk/risks')}
        />
        <StatTile
          icon={<CalendarClock size={16} />}
          label="Overdue reviews"
          value={summary?.overdue_reviews ?? '—'}
          hint={overdue ? `${overdue.counts.overdue_controls} overdue controls` : undefined}
          tone={summary && summary.overdue_reviews > 0 ? 'red' : 'emerald'}
          onClick={() => nav('/risk/risks?overdueReview=true')}
        />
        <StatTile
          icon={<HelpCircle size={16} />}
          label="Unscored"
          value={summary?.unscored ?? '—'}
          hint="No initial score recorded"
          tone={summary && summary.unscored > 0 ? 'amber' : 'slate'}
          onClick={() => nav('/risk/risks')}
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          label="Accepted"
          value={byStatus.ACCEPTED ?? 0}
          hint={`${byStatus.MONITORED ?? 0} monitored`}
          tone="emerald"
          onClick={() => nav('/risk/risks?status=ACCEPTED')}
        />
      </div>

      {/* Heat map + level distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard
          className="xl:col-span-2"
          title={`${stage === 'RESIDUAL' ? 'Residual' : 'Initial'} risk heat map`}
          subtitle={
            heatmap
              ? `${heatmap.framework.name} · ${heatmap.total} risk(s), ${heatmap.unscored} unscored · click a cell to open the matching risks`
              : 'Loading framework…'
          }
          accent={PALETTE.brand}
        >
          {heatmapError ? (
            <EmptyChart label="No risk framework is configured yet" height={280} />
          ) : heatmapLoading ? (
            <EmptyChart label="Loading heat map…" height={280} />
          ) : !heatmap || heatmap.total === 0 ? (
            <EmptyChart label="No risks scored against this framework yet" height={280} />
          ) : (
            <HeatMapGrid
              heatmap={heatmap}
              framework={framework}
              countFor={(r, c) => cellIndex.get(`${r}:${c}`) ?? 0}
              onCellClick={openCell}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Risks by level"
          subtitle="Current level distribution"
          accent={PALETTE.bad}
        >
          {!heatmap || Object.keys(heatmap.by_level).length === 0 ? (
            <EmptyChart label="No levels assigned yet" height={280} />
          ) : (
            <div className="space-y-2">
              {Object.entries(heatmap.by_level)
                .sort((a, b) => b[1] - a[1])
                .map(([code, count]) => {
                  const def = framework?.levels.find((l) => l.code === code);
                  const pct = heatmap.total > 0 ? (count / heatmap.total) * 100 : 0;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        code !== 'UNSCORED' && nav(`/risk/risks?levelCode=${encodeURIComponent(code)}`)
                      }
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-medium text-gray-700">
                          {def?.label ?? code.replace(/_/g, ' ')}
                        </span>
                        <span className="tabular-nums text-gray-500">
                          {count} · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(2, pct)}%`,
                            backgroundColor: def?.color ?? PALETTE.slate,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Pareto + trend */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard
          title="Risks by category"
          subtitle="Ranked with cumulative share (Pareto)"
          accent={PALETTE.blue}
        >
          <CategoryParetoChart
            data={paretoData}
            valueLabel="Risks"
            emptyLabel="No categorised risks yet"
          />
        </ChartCard>

        <ChartCard
          title="Residual score movement"
          subtitle="From immutable score snapshots, last 12 months"
          accent={PALETTE.purple}
        >
          <TrendLineChart
            data={trendRows}
            xKey="month"
            series={[
              { key: 'avg', name: 'Avg residual score', color: PALETTE.purple, area: false },
              { key: 'scored', name: 'Risks rescored', color: PALETTE.blue },
            ]}
            emptyLabel="No residual scoring recorded yet"
          />
        </ChartCard>
      </div>

      {/* Overdue reviews */}
      <Card noPadding>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900">Overdue periodic reviews</h3>
            {overdue && overdue.counts.overdue_reviews > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-50 text-red-600 text-[10px] font-semibold px-2 py-0.5">
                {overdue.counts.overdue_reviews}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => nav('/risk/reviews?overdue=true')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Review queue <ArrowRight size={13} />
          </button>
        </div>

        {!overdue ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">Loading…</p>
        ) : overdue.overdue_reviews.length === 0 ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">
            No review is past its due date.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Risk', 'Title', 'Register', 'Due', 'Days overdue'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdue.overdue_reviews.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => nav(`/risk/risks/${r.risk_id}`)}
                  className="border-b border-gray-50 last:border-0 cursor-pointer hover:bg-blue-50/60"
                >
                  <td className="px-5 py-2.5 text-xs font-mono text-blue-700">{r.risk_number}</td>
                  <td className="px-5 py-2.5 text-xs text-gray-800 max-w-[280px] truncate">
                    {r.title}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{r.register?.name ?? '—'}</td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{fmtDate(r.due_at)}</td>
                  <td className="px-5 py-2.5 text-xs font-semibold text-red-600 tabular-nums">
                    {r.days_overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/**
 * The interactive matrix. Rows run highest-rank-first so the grid reads like the
 * printed matrices in ICH Q9 / ISO 14971 annexes, where the worst outcome sits
 * at the top-left.
 */
function HeatMapGrid({
  heatmap,
  framework,
  countFor,
  onCellClick,
}: {
  heatmap: RiskHeatmap;
  framework: RiskFramework | undefined;
  countFor: (rowRank: number, colRank: number) => number;
  onCellClick: (rowRank: number, colRank: number) => void;
}) {
  const rows = [...heatmap.axes.row.levels].sort((a, b) => b.rank - a.rank);
  const cols = [...heatmap.axes.col.levels].sort((a, b) => a.rank - b.rank);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th className="text-[10px] font-medium text-gray-400 text-right pr-2 align-bottom whitespace-nowrap">
              {heatmap.axes.row.label} \ {heatmap.axes.col.label}
            </th>
            {cols.map((c) => (
              <th
                key={c.rank}
                className="text-[10px] font-medium text-gray-500 px-1 pb-1 text-center"
                style={{ minWidth: 74, maxWidth: 110 }}
              >
                <span className="block truncate" title={`${c.rank} — ${c.label}`}>
                  {c.rank}. {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank}>
              <td
                className="text-[10px] font-medium text-gray-500 text-right pr-2 whitespace-nowrap max-w-[150px] truncate"
                title={`${r.rank} — ${r.label}`}
              >
                {r.rank}. {r.label}
              </td>
              {cols.map((c) => {
                const count = countFor(r.rank, c.rank);
                const level = resolveCellLevel(
                  framework,
                  heatmap.axes.row.key,
                  r.rank,
                  heatmap.axes.col.key,
                  c.rank,
                );
                const bg = level?.color ?? '#E2E8F0';
                return (
                  <td key={c.rank} className="p-0">
                    <button
                      type="button"
                      onClick={() => onCellClick(r.rank, c.rank)}
                      title={`${r.label} × ${c.label}${level ? ` · ${level.label}` : ''} — ${count} risk(s)`}
                      className="w-full h-11 rounded-md flex items-center justify-center transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        backgroundColor: count > 0 ? bg : `${bg}33`,
                        color: count > 0 ? '#fff' : '#94A3B8',
                      }}
                    >
                      <span className="text-[13px] font-bold tabular-nums">
                        {count > 0 ? count : ''}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {framework && framework.levels.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap mt-3 pl-1">
          {framework.levels.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-[10px] text-gray-500">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
