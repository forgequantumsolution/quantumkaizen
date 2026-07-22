/**
 * Risk Management analytics — trend, overdue and category (Pareto) views.
 *
 * Every figure here is aggregated in Postgres (groupBy / count / aggregate, or a
 * date_trunc roll-up for the monthly trend). Nothing pulls a result set into
 * memory to reduce it in JS: a mature register holds tens of thousands of score
 * snapshots and the dashboard must not be the thing that pages them all in.
 */
import { Prisma, RiskControlStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ByCategoryQuery, OverdueQuery, TrendQuery } from './risk-analytics.schema';

// ── Trend ───────────────────────────────────────────────────────────────────

/** `YYYY-MM` for a date, in the same (server) zone Postgres date_trunc uses. */
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The last `count` month keys, oldest first, ending with the month of `now`. */
const monthWindow = (count: number, now: Date) => {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return months;
};

type TrendRow = { month: string; level_code: string; count: number; avg_score: number };

/**
 * Residual-score movement over time, built from the immutable score snapshots
 * rather than the risks' current columns — the whole point of the trend is to
 * show where a risk *was*, which the mutable columns can no longer answer.
 *
 * Only RESIDUAL and REVIEW snapshots are counted: those are the two stages that
 * write the residual columns (see risk.service.scoreRisk).
 */
export const getTrend = async (q: TrendQuery, now = new Date()) => {
  const months = monthWindow(q.months, now);
  const from = new Date(now.getFullYear(), now.getMonth() - (q.months - 1), 1);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`s."createdAt" >= ${from}`,
    Prisma.sql`s."stage" IN ('RESIDUAL', 'REVIEW')`,
  ];
  if (q.registerId) conditions.push(Prisma.sql`r."registerId" = ${q.registerId}`);
  if (q.siteId) conditions.push(Prisma.sql`r."siteId" = ${q.siteId}`);

  const rows = await prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT to_char(date_trunc('month', s."createdAt"), 'YYYY-MM') AS month,
           s."levelCode"                                          AS level_code,
           COUNT(*)::int                                          AS count,
           AVG(s."score")::float8                                 AS avg_score
      FROM "RiskScoreSnapshot" s
      JOIN "Risk" r ON r."id" = s."riskId"
     WHERE ${Prisma.join(conditions, ' AND ')}
     GROUP BY 1, 2
     ORDER BY 1, 2
  `);

  // Level display metadata is on the framework; the snapshot only denormalises
  // the code. One lookup covers every code the window produced.
  const codes = [...new Set(rows.map((r) => r.level_code))];
  const defs = codes.length
    ? await prisma.riskLevelDef.findMany({
        where: { code: { in: codes } },
        select: { code: true, label: true, color: true, order: true },
        orderBy: { order: 'asc' },
      })
    : [];
  const meta = new Map(defs.map((d) => [d.code, d]));

  const byCode = new Map<string, Map<string, number>>();
  // Weighted monthly average, reconstructed from the per-level group counts —
  // exact, and it saves a second pass over the snapshot table.
  const monthTotals = new Map<string, { n: number; sum: number }>();
  for (const row of rows) {
    const series = byCode.get(row.level_code) ?? new Map<string, number>();
    series.set(row.month, (series.get(row.month) ?? 0) + row.count);
    byCode.set(row.level_code, series);

    const total = monthTotals.get(row.month) ?? { n: 0, sum: 0 };
    total.n += row.count;
    total.sum += row.avg_score * row.count;
    monthTotals.set(row.month, total);
  }

  const series = codes
    .sort((a, b) => (meta.get(a)?.order ?? 0) - (meta.get(b)?.order ?? 0) || a.localeCompare(b))
    .map((code) => ({
      level_code: code,
      level_label: meta.get(code)?.label ?? code,
      color: meta.get(code)?.color ?? null,
      counts: months.map((m) => byCode.get(code)?.get(m) ?? 0),
      total: months.reduce((acc, m) => acc + (byCode.get(code)?.get(m) ?? 0), 0),
    }));

  return {
    months,
    series,
    avg_residual: months.map((m) => {
      const t = monthTotals.get(m);
      return t && t.n > 0 ? Math.round((t.sum / t.n) * 100) / 100 : null;
    }),
    scored_counts: months.map((m) => monthTotals.get(m)?.n ?? 0),
    total_snapshots: rows.reduce((acc, r) => acc + r.count, 0),
  };
};

// ── Overdue ─────────────────────────────────────────────────────────────────

/** A control still owing work: past due and neither verified nor cancelled. */
const OPEN_CONTROL_STATUSES: RiskControlStatus[] = [
  RiskControlStatus.PLANNED,
  RiskControlStatus.IN_PROGRESS,
  RiskControlStatus.IMPLEMENTED,
  RiskControlStatus.INEFFECTIVE,
];

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));

/**
 * Everything past due in one payload — the "what needs attention today" panel.
 * Rows are capped by `limit`; the counts are always the true unbounded totals,
 * so a truncated list never understates the backlog.
 */
export const getOverdue = async (q: OverdueQuery, now = new Date()) => {
  const riskWhere: Prisma.RiskWhereInput = {};
  if (q.registerId) riskWhere.registerId = q.registerId;
  if (q.siteId) riskWhere.siteId = q.siteId;

  const reviewWhere: Prisma.RiskReviewWhereInput = {
    reviewedAt: null,
    dueAt: { lt: now },
    risk: { ...riskWhere, status: { not: 'CLOSED' } },
  };
  const controlWhere: Prisma.RiskControlWhereInput = {
    dueDate: { lt: now },
    status: { in: OPEN_CONTROL_STATUSES },
    ...(q.registerId || q.siteId ? { risk: riskWhere } : {}),
  };

  const [reviews, reviewCount, controls, controlCount, risksPastReview, controlsByStatus] =
    await Promise.all([
      prisma.riskReview.findMany({
        where: reviewWhere,
        orderBy: { dueAt: 'asc' },
        take: q.limit,
        select: {
          id: true,
          dueAt: true,
          overdueAt: true,
          risk: {
            select: {
              id: true,
              riskNumber: true,
              title: true,
              status: true,
              ownerId: true,
              siteId: true,
              residualScore: true,
              register: { select: { id: true, registerNumber: true, name: true } },
            },
          },
        },
      }),
      prisma.riskReview.count({ where: reviewWhere }),
      prisma.riskControl.findMany({
        where: controlWhere,
        orderBy: { dueDate: 'asc' },
        take: q.limit,
        select: {
          id: true,
          controlNumber: true,
          title: true,
          type: true,
          hierarchy: true,
          status: true,
          ownerId: true,
          dueDate: true,
          capaId: true,
          actionItemId: true,
          risk: {
            select: {
              id: true,
              riskNumber: true,
              title: true,
              register: { select: { id: true, registerNumber: true, name: true } },
            },
          },
        },
      }),
      prisma.riskControl.count({ where: controlWhere }),
      prisma.risk.count({
        where: { ...riskWhere, nextReviewAt: { lt: now }, status: { not: 'CLOSED' } },
      }),
      prisma.riskControl.groupBy({
        by: ['status'],
        where: controlWhere,
        _count: { _all: true },
      }),
    ]);

  return {
    overdue_reviews: reviews.map((r) => ({
      id: r.id,
      due_at: r.dueAt,
      overdue_at: r.overdueAt,
      days_overdue: daysBetween(r.dueAt, now),
      risk_id: r.risk.id,
      risk_number: r.risk.riskNumber,
      title: r.risk.title,
      status: r.risk.status,
      owner_id: r.risk.ownerId,
      site_id: r.risk.siteId,
      residual_score: r.risk.residualScore,
      register: r.risk.register,
    })),
    overdue_controls: controls.map((c) => ({
      id: c.id,
      control_number: c.controlNumber,
      title: c.title,
      type: c.type,
      hierarchy: c.hierarchy,
      status: c.status,
      owner_id: c.ownerId,
      due_date: c.dueDate,
      days_overdue: c.dueDate ? daysBetween(c.dueDate, now) : 0,
      capa_id: c.capaId,
      action_item_id: c.actionItemId,
      risk_id: c.risk.id,
      risk_number: c.risk.riskNumber,
      risk_title: c.risk.title,
      register: c.risk.register,
    })),
    counts: {
      overdue_reviews: reviewCount,
      overdue_controls: controlCount,
      risks_past_review_date: risksPastReview,
      overdue_controls_by_status: Object.fromEntries(
        controlsByStatus.map((s) => [s.status, s._count._all]),
      ),
      total: reviewCount + controlCount,
      truncated: reviewCount > reviews.length || controlCount > controls.length,
    },
  };
};

// ── By category (Pareto) ────────────────────────────────────────────────────

/**
 * Risk counts and mean residual score per category, ordered descending with a
 * running cumulative share so the client can draw a Pareto without a second
 * call and without re-deriving the ordering itself.
 */
export const getByCategory = async (q: ByCategoryQuery) => {
  const where: Prisma.RiskWhereInput = {};
  if (q.registerId) where.registerId = q.registerId;
  if (q.siteId) where.siteId = q.siteId;
  if (!q.includeClosed) where.status = { not: 'CLOSED' };

  const grouped = await prisma.risk.groupBy({
    by: ['categoryId'],
    where,
    _count: { _all: true },
    _avg: { residualScore: true, initialScore: true },
    _max: { residualScore: true },
  });

  const ids = grouped.map((g) => g.categoryId).filter((id): id is string => id !== null);
  const categories = ids.length
    ? await prisma.riskCategory.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, name: true, color: true, parentId: true },
      })
    : [];
  const byId = new Map(categories.map((c) => [c.id, c]));

  const total = grouped.reduce((acc, g) => acc + g._count._all, 0);
  const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

  const rows = grouped
    .map((g) => {
      const cat = g.categoryId ? byId.get(g.categoryId) : undefined;
      return {
        category_id: g.categoryId,
        category_code: cat?.code ?? null,
        category_name: cat?.name ?? 'Uncategorised',
        color: cat?.color ?? null,
        parent_id: cat?.parentId ?? null,
        risk_count: g._count._all,
        avg_residual_score: round(g._avg.residualScore),
        avg_initial_score: round(g._avg.initialScore),
        max_residual_score: g._max.residualScore,
        share: total > 0 ? Math.round((g._count._all / total) * 10000) / 100 : 0,
      };
    })
    .sort((a, b) => b.risk_count - a.risk_count || a.category_name.localeCompare(b.category_name));

  let running = 0;
  const data = rows.map((r) => {
    running += r.risk_count;
    return { ...r, cumulative_share: total > 0 ? Math.round((running / total) * 10000) / 100 : 0 };
  });

  return { total, include_closed: q.includeClosed, categories: data };
};
