/**
 * Risk overview — the module's flagship screen.
 *
 * Everything on this page is a projection of server-computed figures. The heat
 * map cells are counts the API returned; the colours are the tenant's own
 * framework level colours resolved from the framework configuration (matrix
 * cells when the framework uses MATRIX_LOOKUP, otherwise the score band). No
 * number here is derived, estimated or filled in when data is missing — panels
 * with nothing to show say so.
 *
 * The scope bar at the top drives every panel: register, site and stage are
 * passed to the heat map and summary, and register/site/window/closed-inclusion
 * are passed to the three analytics endpoints. One filter set, one consistent
 * page — no panel silently reports a different population than its neighbour.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Select as AntSelect, Segmented, Switch, Tooltip as AntTooltip } from 'antd';
import {
  ShieldAlert,
  AlertTriangle,
  CalendarClock,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  Activity,
  ClipboardCheck,
  RotateCcw,
  TrendingDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  riskKeys,
  useRiskFramework,
  useRiskHeatmap,
  useRiskRegisters,
  useRiskSummary,
  RISK_STATUS_LABELS,
  type RiskStatus,
} from '@/lib/api/risk';
import { useSites } from '@/lib/api/sites';
import {
  ChartCard,
  EmptyChart,
  CategoryParetoChart,
  TrendLineChart,
  DonutChart,
  ScorecardTable,
  PALETTE,
  type ScorecardColumn,
} from '@/components/analytics';
import { Card, KpiCard } from '@/components/ui';
import { useHasPermission } from '@/stores/authStore';
import RiskHeatMap, { resolveCellLevel } from './RiskHeatMap';

// ── Analytics payloads served by /api/risk/analytics/* ──────────────────────
// These endpoints are read-only projections used by this page alone, so their
// shapes are declared here rather than widening the shared API client.

interface CategoryRow {
  category_id: string | null;
  category_code: string | null;
  category_name: string;
  color: string | null;
  risk_count: number;
  avg_residual_score: number | null;
  avg_initial_score: number | null;
  max_residual_score: number | null;
  share: number;
  cumulative_share: number;
}

interface ByCategoryResponse {
  total: number;
  include_closed: boolean;
  categories: CategoryRow[];
}

interface TrendResponse {
  months: string[];
  series: {
    level_code: string;
    level_label: string;
    color: string | null;
    counts: number[];
    total: number;
  }[];
  avg_residual: (number | null)[];
  scored_counts: number[];
  total_snapshots: number;
}

interface OverdueReviewRow {
  id: string;
  due_at: string;
  days_overdue: number;
  risk_id: string;
  risk_number: string;
  title: string;
  status: string;
  residual_score: number | null;
  register: { id: string; register_number: string; name: string } | null;
}

interface OverdueControlRow {
  id: string;
  control_number: string;
  title: string;
  type: string;
  hierarchy: string | null;
  status: string;
  owner_id: string | null;
  due_date: string | null;
  days_overdue: number;
  risk_id: string;
  risk_number: string;
  risk_title: string;
  register: { id: string; register_number: string; name: string } | null;
}

interface OverdueResponse {
  overdue_reviews: OverdueReviewRow[];
  overdue_controls: OverdueControlRow[];
  counts: {
    overdue_reviews: number;
    overdue_controls: number;
    risks_past_review_date: number;
    overdue_controls_by_status: Record<string, number>;
    total: number;
    truncated: boolean;
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

/** Donut colours for the lifecycle statuses — mirrors riskStatusBadge's tones. */
const STATUS_COLOR: Record<string, string> = {
  IDENTIFIED: PALETTE.slate,
  UNDER_ASSESSMENT: PALETTE.blue,
  TREATMENT_PLANNED: PALETTE.indigo,
  TREATMENT_IN_PROGRESS: PALETTE.amber,
  RESIDUAL_ASSESSED: PALETTE.purple,
  ACCEPTED: PALETTE.emerald,
  MONITORED: PALETTE.cyan,
  CLOSED: '#94A3B8',
  REOPENED: '#F97316',
  ESCALATED: PALETTE.bad,
};

const WINDOWS = [
  { value: 6, label: '6 m' },
  { value: 12, label: '12 m' },
  { value: 24, label: '24 m' },
];

export default function RiskDashboardPage() {
  const nav = useNavigate();
  const canReadRegisters = useHasPermission('risk_register.read');

  // ── Scope ────────────────────────────────────────────────────────────────
  const [registerId, setRegisterId] = useState<string | undefined>();
  const [siteId, setSiteId] = useState<string | undefined>();
  const [stage, setStage] = useState<'INITIAL' | 'RESIDUAL'>('RESIDUAL');
  const [months, setMonths] = useState(12);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [attentionTab, setAttentionTab] = useState<'reviews' | 'controls'>('reviews');
  /** Clicking a level in the distribution dims the other cells in the matrix. */
  const [focusLevel, setFocusLevel] = useState<string | undefined>();

  const scopeCount =
    (registerId ? 1 : 0) + (siteId ? 1 : 0) + (includeClosed ? 1 : 0) + (months !== 12 ? 1 : 0);

  const { data: heatmap, isLoading: heatmapLoading, error: heatmapError } = useRiskHeatmap({
    registerId,
    siteId,
    stage,
  });
  const { data: summary } = useRiskSummary({ registerId, siteId });
  const { data: registerPage } = useRiskRegisters(
    canReadRegisters ? { isActive: true, page: 1, pageSize: 200 } : undefined,
  );
  const { data: sitesResp } = useSites({ pageSize: 200 });
  const { data: framework } = useRiskFramework(heatmap?.framework?.id ?? '');

  const { data: byCategory } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'by-category', registerId ?? null, siteId ?? null, includeClosed],
    queryFn: () =>
      api
        .get('/risk/analytics/by-category', {
          // Sent only when true: the endpoint coerces this param with
          // z.coerce.boolean(), and Boolean("false") is true — so an explicit
          // `false` would switch closed risks *on*. Same convention the controls
          // page uses for `overdue`.
          params: { registerId, siteId, ...(includeClosed ? { includeClosed: true } : {}) },
        })
        .then((r) => r.data.data as ByCategoryResponse),
  });

  const { data: trend } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'trend', registerId ?? null, siteId ?? null, months],
    queryFn: () =>
      api
        .get('/risk/analytics/trend', { params: { registerId, siteId, months } })
        .then((r) => r.data.data as TrendResponse),
  });

  const { data: overdue } = useQuery({
    queryKey: [...riskKeys.all, 'analytics', 'overdue', registerId ?? null, siteId ?? null],
    queryFn: () =>
      api
        .get('/risk/analytics/overdue', { params: { registerId, siteId, limit: 10 } })
        .then((r) => r.data.data as OverdueResponse),
  });

  const cellIndex = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of heatmap?.cells ?? []) map.set(`${c.row_rank}:${c.col_rank}`, c.count);
    return map;
  }, [heatmap]);

  const countFor = useMemo(
    () => (r: number, c: number) => cellIndex.get(`${r}:${c}`) ?? 0,
    [cellIndex],
  );

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

  /**
   * Per-level counts per month, from the trend endpoint's `series`. Stacked, this
   * answers the question the average alone cannot: is the population shifting out
   * of the high bands, or just growing?
   */
  const levelMixRows = useMemo(() => {
    if (!trend) return [];
    return trend.months.map((m, i) => {
      const row: Record<string, string | number> = { month: monthLabel(m) };
      for (const s of trend.series) row[s.level_code] = s.counts[i] ?? 0;
      return row;
    });
  }, [trend]);

  const levelMixSeries = useMemo(
    () =>
      (trend?.series ?? []).map((s, i) => ({
        key: s.level_code,
        name: s.level_label,
        color: s.color ?? [PALETTE.emerald, PALETTE.amber, PALETTE.bad, PALETTE.purple, PALETTE.blue][i % 5],
      })),
    [trend],
  );

  const statusSlices = useMemo(() => {
    const by = summary?.by_status ?? {};
    return (Object.entries(by) as [RiskStatus, number][])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => ({
        name: RISK_STATUS_LABELS[code] ?? code.replace(/_/g, ' '),
        value: n,
        color: STATUS_COLOR[code] ?? PALETTE.slate,
      }));
  }, [summary]);

  /**
   * Control effect per category: the gap between the mean initial and mean
   * residual score is what the treatment actually bought. Categories where the
   * gap is zero are carrying untreated risk and belong at the top of the list.
   */
  const effectivenessRows = useMemo(() => {
    return (byCategory?.categories ?? [])
      .filter((c) => c.avg_initial_score != null && c.avg_residual_score != null)
      .map((c) => {
        const initial = c.avg_initial_score as number;
        const residual = c.avg_residual_score as number;
        const delta = Math.round((initial - residual) * 100) / 100;
        return {
          ...c,
          initial,
          residual,
          delta,
          reductionPct: initial > 0 ? Math.round((delta / initial) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => a.reductionPct - b.reductionPct || b.risk_count - a.risk_count);
  }, [byCategory]);

  const effectivenessColumns = useMemo<ScorecardColumn<(typeof effectivenessRows)[number]>[]>(
    () => [
      {
        key: 'name',
        header: 'Category',
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: r.color ?? PALETTE.slate }}
            />
            <span className="truncate">{r.category_name}</span>
          </span>
        ),
      },
      { key: 'n', header: 'Risks', align: 'right', render: (r) => r.risk_count },
      { key: 'initial', header: 'Initial', align: 'right', render: (r) => r.initial.toFixed(1) },
      { key: 'residual', header: 'Residual', align: 'right', render: (r) => r.residual.toFixed(1) },
      {
        key: 'delta',
        header: 'Reduction',
        align: 'right',
        render: (r) => (
          <span
            className={
              r.reductionPct <= 0
                ? 'font-bold text-red-600'
                : r.reductionPct < 25
                  ? 'font-bold text-amber-600'
                  : 'font-bold text-emerald-600'
            }
          >
            {r.reductionPct > 0 ? '−' : ''}
            {Math.abs(r.reductionPct).toFixed(0)}%
          </span>
        ),
      },
    ],
    [],
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
    if (siteId) params.set('siteId', siteId);
    if (level) params.set('levelCode', level.code);
    nav(`/risk/risks${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const registers = registerPage?.data ?? [];
  const sites = sitesResp?.items ?? [];
  const byStatus = summary?.by_status ?? {};
  const scoredPct =
    summary && summary.total > 0
      ? Math.round(((summary.total - summary.unscored) / summary.total) * 100)
      : null;

  const resetScope = () => {
    setRegisterId(undefined);
    setSiteId(undefined);
    setMonths(12);
    setIncludeClosed(false);
  };

  return (
    <div className="space-y-3">
      {/* ── Scope bar ─────────────────────────────────────────────────────────
          One filter set for the whole page, in a card of its own so it reads as
          chrome rather than as another panel. */}
      <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
            Scope
          </span>

          {canReadRegisters && (
            <AntSelect
              allowClear
              showSearch
              size="small"
              optionFilterProp="label"
              placeholder="All registers"
              style={{ width: 230 }}
              value={registerId}
              onChange={(v) => setRegisterId(v ?? undefined)}
              options={registers.map((r) => ({
                value: r.id,
                label: `${r.register_number} — ${r.name}`,
              }))}
            />
          )}

          <AntSelect
            allowClear
            showSearch
            size="small"
            optionFilterProp="label"
            placeholder="All sites"
            style={{ width: 180 }}
            value={siteId}
            onChange={(v) => setSiteId(v ?? undefined)}
            options={sites.map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))}
          />

          <Segmented
            size="small"
            value={stage}
            onChange={(v) => setStage(v as 'INITIAL' | 'RESIDUAL')}
            options={[
              { value: 'RESIDUAL', label: 'Residual' },
              { value: 'INITIAL', label: 'Initial' },
            ]}
          />

          <span className="ml-1 h-5 w-px bg-gray-200" />

          <AntTooltip title="Window for the trend panels">
            <Segmented
              size="small"
              value={months}
              onChange={(v) => setMonths(v as number)}
              options={WINDOWS}
            />
          </AntTooltip>

          <AntTooltip title="Include closed risks in the category panels">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-gray-500">
              <Switch size="small" checked={includeClosed} onChange={setIncludeClosed} />
              Closed
            </label>
          </AntTooltip>

          <div className="ml-auto flex items-center gap-2">
            {scopeCount > 0 && (
              <button
                type="button"
                onClick={resetScope}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <RotateCcw size={12} />
                Reset ({scopeCount})
              </button>
            )}
            {heatmap && (
              <span className="text-[11px] text-gray-400">
                {heatmap.framework.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────────────────
          A responsive grid rather than a scrolling row: tiles wrap instead of
          leaving a half-visible card at the edge, and every tile is the same
          height because none of them carries a footer. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={ShieldAlert}
          label="Total risks"
          value={summary?.total ?? '—'}
          accent="blue"
          onClick={() => nav('/risk/risks')}
        />
        <KpiCard
          icon={CalendarClock}
          label="Overdue reviews"
          value={summary?.overdue_reviews ?? '—'}
          accent={summary && summary.overdue_reviews > 0 ? 'red' : 'emerald'}
          alert={!!summary && summary.overdue_reviews > 0}
          onClick={() => nav('/risk/risks?overdueReview=true')}
        />
        <KpiCard
          icon={ClipboardCheck}
          label="Overdue controls"
          value={overdue?.counts.overdue_controls ?? '—'}
          accent={overdue && overdue.counts.overdue_controls > 0 ? 'red' : 'emerald'}
          alert={!!overdue && overdue.counts.overdue_controls > 0}
          onClick={() => nav('/risk/controls?overdue=true')}
        />
        <KpiCard
          icon={HelpCircle}
          label="Unscored"
          value={summary?.unscored ?? '—'}
          accent={summary && summary.unscored > 0 ? 'amber' : 'slate'}
          onClick={() => nav('/risk/risks')}
        />
        <KpiCard
          icon={TrendingDown}
          label="Scored"
          value={scoredPct == null ? '—' : `${scoredPct}%`}
          accent={scoredPct != null && scoredPct >= 90 ? 'emerald' : 'amber'}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Accepted"
          value={byStatus.ACCEPTED ?? 0}
          accent="emerald"
          onClick={() => nav('/risk/risks?status=ACCEPTED')}
        />
      </div>

      {/* ── Matrix + level distribution ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title={`${stage === 'RESIDUAL' ? 'Residual' : 'Initial'} risk heat map`}
          subtitle={
            heatmap
              ? `${heatmap.total} risk(s) · ${heatmap.unscored} unscored · click a cell to open the matching risks`
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
            <RiskHeatMap
              heatmap={heatmap}
              framework={framework}
              countFor={countFor}
              onCellClick={openCell}
              {...(focusLevel ? { highlightLevelCode: focusLevel } : {})}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Risks by level"
          subtitle="Hover to isolate the band in the matrix"
          accent={PALETTE.bad}
        >
          {!heatmap || Object.keys(heatmap.by_level).length === 0 ? (
            <EmptyChart label="No levels assigned yet" height={280} />
          ) : (
            <div className="space-y-2.5" onMouseLeave={() => setFocusLevel(undefined)}>
              {Object.entries(heatmap.by_level)
                .sort((a, b) => b[1] - a[1])
                .map(([code, count]) => {
                  const def = framework?.levels.find((l) => l.code === code);
                  const pct = heatmap.total > 0 ? (count / heatmap.total) * 100 : 0;
                  return (
                    <button
                      key={code}
                      type="button"
                      onMouseEnter={() => setFocusLevel(code)}
                      onFocus={() => setFocusLevel(code)}
                      onClick={() =>
                        code !== 'UNSCORED' && nav(`/risk/risks?levelCode=${encodeURIComponent(code)}`)
                      }
                      className="w-full rounded-md p-1 text-left transition-colors hover:bg-gray-50"
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="truncate font-medium text-gray-700">
                          {def?.label ?? code.replace(/_/g, ' ')}
                        </span>
                        <span className="shrink-0 tabular-nums text-gray-500">
                          <span className="font-bold text-gray-800">{count}</span> · {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
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

      {/* ── Movement over time + lifecycle mix ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Level mix over time"
          subtitle={`Snapshots per severity band, last ${months} months`}
          accent={PALETTE.amber}
        >
          {levelMixSeries.length === 0 ? (
            <EmptyChart label="No scoring snapshots in this window" height={272} />
          ) : (
            <TrendLineChart
              data={levelMixRows}
              xKey="month"
              series={levelMixSeries}
              stacked
              emptyLabel="No scoring snapshots in this window"
            />
          )}
        </ChartCard>

        <ChartCard title="Lifecycle position" subtitle="Risks by status" accent={PALETTE.cyan}>
          <DonutChart
            data={statusSlices}
            centerLabel="Risks"
            emptyLabel="No risks yet"
            height={272}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          title="Risks by category"
          subtitle={`Ranked with cumulative share (Pareto)${includeClosed ? ' · closed included' : ''}`}
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
          subtitle={`From immutable score snapshots, last ${months} months`}
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

      {/* ── Control effect ───────────────────────────────────────────────────
          Not a restatement of the Pareto: this ranks by how little the treatment
          moved the score, which is the opposite end of the list from "most
          risks". Weakest reduction first. */}
      <ChartCard
        title="Treatment effect by category"
        subtitle="Mean initial vs mean residual score — weakest reduction first"
        accent={PALETTE.rose}
      >
        {effectivenessRows.length === 0 ? (
          <EmptyChart
            label="No category has both an initial and a residual score yet"
            height={200}
          />
        ) : (
          <ScorecardTable
            rows={effectivenessRows}
            columns={effectivenessColumns}
            rowKey={(r) => r.category_id ?? r.category_name}
            height={240}
          />
        )}
      </ChartCard>

      {/* ── Attention queue ──────────────────────────────────────────────────
          Reviews and controls are two different backlogs with two different
          owners, so they get a tab each rather than one merged list. Both counts
          are the server's unbounded totals; the rows are the capped top 10. */}
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <AlertTriangle size={15} className="mr-1.5 text-red-500" />
            {(
              [
                ['reviews', 'Overdue reviews', overdue?.counts.overdue_reviews],
                ['controls', 'Overdue controls', overdue?.counts.overdue_controls],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAttentionTab(key)}
                className={
                  attentionTab === key
                    ? 'inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1.5 text-[13px] font-semibold text-gray-900'
                    : 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }
              >
                {label}
                {!!count && count > 0 && (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-red-600">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              nav(attentionTab === 'reviews' ? '/risk/reviews?overdue=true' : '/risk/controls?overdue=true')
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {attentionTab === 'reviews' ? 'Review queue' : 'Control queue'} <ArrowRight size={13} />
          </button>
        </div>

        {!overdue ? (
          <p className="px-5 py-8 text-center text-xs text-gray-400">Loading…</p>
        ) : attentionTab === 'reviews' ? (
          <OverdueTable
            emptyLabel="No review is past its due date."
            headers={['Risk', 'Title', 'Register', 'Due', 'Days overdue']}
            rows={overdue.overdue_reviews.map((r) => ({
              key: r.id,
              onClick: () => nav(`/risk/risks/${r.risk_id}`),
              cells: [
                <span className="font-mono text-xs text-blue-700">{r.risk_number}</span>,
                <span className="block max-w-[280px] truncate text-xs text-gray-800">{r.title}</span>,
                <span className="text-xs text-gray-500">{r.register?.name ?? '—'}</span>,
                <span className="text-xs text-gray-500">{fmtDate(r.due_at)}</span>,
                <span className="text-xs font-semibold tabular-nums text-red-600">
                  {r.days_overdue}
                </span>,
              ],
            }))}
          />
        ) : (
          <OverdueTable
            emptyLabel="No control is past its due date."
            headers={['Control', 'Title', 'Parent risk', 'Due', 'Days overdue']}
            rows={overdue.overdue_controls.map((c) => ({
              key: c.id,
              onClick: () => nav(`/risk/risks/${c.risk_id}`),
              cells: [
                <span className="font-mono text-xs text-blue-700">{c.control_number}</span>,
                <span className="block max-w-[280px] truncate text-xs text-gray-800">{c.title}</span>,
                <span className="block max-w-[220px] truncate text-xs text-gray-500">
                  {c.risk_number} — {c.risk_title}
                </span>,
                <span className="text-xs text-gray-500">{fmtDate(c.due_date)}</span>,
                <span className="text-xs font-semibold tabular-nums text-red-600">
                  {c.days_overdue}
                </span>,
              ],
            }))}
          />
        )}

        {overdue?.counts.truncated && (
          <p className="border-t border-gray-50 px-5 py-2 text-[11px] text-gray-400">
            <Activity size={11} className="mr-1 inline" />
            Showing the 10 most overdue of {overdue.counts.total}. Open the queue for the full list.
          </p>
        )}
      </Card>
    </div>
  );
}

/** Shared shell for the two attention tables so both tabs render identically. */
function OverdueTable({
  headers,
  rows,
  emptyLabel,
}: {
  headers: string[];
  rows: { key: string; onClick: () => void; cells: ReactNode[] }[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="px-5 py-8 text-center text-xs text-gray-400">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            {headers.map((h) => (
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
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={r.onClick}
              className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-blue-50/60"
            >
              {r.cells.map((c, i) => (
                <td key={i} className="px-5 py-2.5">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
