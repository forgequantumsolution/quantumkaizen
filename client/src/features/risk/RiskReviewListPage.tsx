/**
 * The periodic review queue — every risk review that is due, overdue or already
 * closed out, across every register.
 *
 * A risk register that is not re-read on a cadence is a document, not a control.
 * This page is the cadence made visible: it opens on the outstanding reviews,
 * sorted by due date, so the oldest unanswered question is the first row.
 *
 * The complete-review drawer is shared with the risk workspace so an outcome
 * recorded from the queue and one recorded from the risk itself are the same
 * transaction, with the same required findings.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button as AntButton, Select as AntSelect, Tooltip, message } from 'antd';
import { CalendarCheck, CalendarClock, Download, ExternalLink, TriangleAlert } from 'lucide-react';
import { Badge, DataTable, KpiCard, type Column } from '@/components/ui';
import { exportToCSV } from '@/lib/export';
import { useHasPermission } from '@/stores/authStore';
import {
  useRiskReviews,
  useRiskRegisters,
  REVIEW_OUTCOME_LABELS,
  type ReviewOutcome,
  type RiskReview,
} from '@/lib/api/risk';
import { RiskStatusBadge } from './riskStatusBadge';
import { CompleteReviewDrawer } from './RiskDetailPage';

const PAGE_SIZE = 15;

const REVIEW_OUTCOMES = Object.keys(REVIEW_OUTCOME_LABELS) as ReviewOutcome[];

/** The queue is a state question, not a boolean one — three named views. */
const VIEWS = [
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'overdue', label: 'Overdue only' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All reviews' },
] as const;

type View = (typeof VIEWS)[number]['value'];

const SORTS = [
  { value: 'dueAt', label: 'Due date' },
  { value: 'reviewedAt', label: 'Recently reviewed' },
  { value: 'createdAt', label: 'Newest first' },
] as const;

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const daysFromNow = (iso: string) =>
  Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function RiskReviewListPage() {
  const nav = useNavigate();
  const canUpdate = useHasPermission('risk_review.update');

  const [view, setView] = useState<View>('outstanding');
  const [registerId, setRegisterId] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<ReviewOutcome | undefined>();
  const [sortBy, setSortBy] = useState<(typeof SORTS)[number]['value']>('dueAt');
  const [page, setPage] = useState(1);
  const [completing, setCompleting] = useState<RiskReview | null>(null);

  useEffect(() => setPage(1), [view, registerId, outcome, sortBy]);

  // `completed` and `overdue` are independent server filters; the named views
  // map onto them rather than exposing two half-understood checkboxes.
  const viewParams =
    view === 'outstanding'
      ? { completed: false }
      : view === 'overdue'
        ? { completed: false, overdue: true }
        : view === 'completed'
          ? { completed: true }
          : {};

  const { data, isLoading } = useRiskReviews({
    ...viewParams,
    registerId,
    outcome,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir: sortBy === 'dueAt' ? 'asc' : 'desc',
  });

  // Standing counters, independent of the current view.
  const { data: overduePage } = useRiskReviews({ completed: false, overdue: true, page: 1, pageSize: 1 });
  const { data: outstandingPage } = useRiskReviews({ completed: false, page: 1, pageSize: 1 });
  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });

  const rows = data?.data ?? [];
  const total = data?.total ?? rows.length;
  const registers = registerPage?.data ?? [];

  const dueSoon = useMemo(
    () =>
      rows.filter((r) => {
        if (r.is_complete || r.is_overdue) return false;
        const d = daysFromNow(r.due_at);
        return d >= 0 && d <= 30;
      }).length,
    [rows],
  );

  const handleExport = () => {
    if (rows.length === 0) {
      message.info('Nothing to export on this page');
      return;
    }
    exportToCSV(
      'risk-reviews',
      ['Risk #', 'Risk', 'Risk status', 'Residual score', 'Due', 'State', 'Outcome', 'Reviewed', 'Next review', 'Findings'],
      rows.map((r) => [
        r.risk?.risk_number ?? '',
        r.risk?.title ?? '',
        r.risk?.status ?? '',
        r.risk?.residual_score ?? '',
        new Date(r.due_at).toISOString().slice(0, 10),
        r.is_complete ? 'Complete' : r.is_overdue ? 'Overdue' : 'Due',
        r.outcome ? REVIEW_OUTCOME_LABELS[r.outcome] : '',
        r.reviewed_at ? new Date(r.reviewed_at).toISOString().slice(0, 10) : '',
        r.next_review_at ? new Date(r.next_review_at).toISOString().slice(0, 10) : '',
        r.findings ?? '',
      ]),
    );
  };

  const columns = useMemo<Column<RiskReview>[]>(
    () => [
      {
        key: 'risk',
        header: 'Risk',
        render: (r) =>
          r.risk ? (
            <div className="min-w-0">
              <span className="font-mono text-xs text-blue-700">{r.risk.risk_number}</span>
              <p className="font-medium text-gray-900 truncate max-w-[300px]">{r.risk.title}</p>
            </div>
          ) : (
            <span className="text-xs text-gray-400">Risk removed</span>
          ),
      },
      {
        key: 'risk_status',
        header: 'Risk status',
        render: (r) => (r.risk ? <RiskStatusBadge status={r.risk.status} /> : <span className="text-xs text-gray-400">—</span>),
      },
      {
        key: 'residual',
        header: 'Residual',
        render: (r) => (
          <span className="text-xs font-semibold tabular-nums text-gray-800">
            {r.risk?.residual_score ?? '—'}
          </span>
        ),
      },
      {
        key: 'due_at',
        header: 'Due',
        render: (r) => {
          const days = daysFromNow(r.due_at);
          return (
            <div className="min-w-0">
              <span
                className={
                  r.is_overdue && !r.is_complete
                    ? 'inline-flex items-center gap-1 text-xs font-semibold text-red-600'
                    : 'text-xs text-gray-700'
                }
              >
                {r.is_overdue && !r.is_complete && <TriangleAlert size={12} />}
                {fmtDate(r.due_at)}
              </span>
              {!r.is_complete && (
                <p className="text-[11px] text-gray-400">
                  {days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` : `in ${days} day${days === 1 ? '' : 's'}`}
                </p>
              )}
            </div>
          );
        },
      },
      {
        key: 'state',
        header: 'State',
        render: (r) => (
          <Badge variant={r.is_complete ? 'success' : r.is_overdue ? 'danger' : 'warning'} dot>
            {r.is_complete ? 'Complete' : r.is_overdue ? 'Overdue' : 'Due'}
          </Badge>
        ),
      },
      {
        key: 'outcome',
        header: 'Outcome',
        render: (r) =>
          r.outcome ? (
            <Badge variant="info">{REVIEW_OUTCOME_LABELS[r.outcome]}</Badge>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          ),
      },
      {
        key: 'reviewed_at',
        header: 'Reviewed',
        render: (r) => <span className="text-xs text-gray-500">{fmtDate(r.reviewed_at)}</span>,
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        className: 'text-right',
        render: (r) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {canUpdate && !r.is_complete && (
              <AntButton size="small" type="primary" onClick={() => setCompleting(r)}>
                Complete
              </AntButton>
            )}
            <Tooltip title="Open risk">
              <AntButton
                type="text"
                size="small"
                icon={<ExternalLink size={15} />}
                onClick={() => nav(`/risk/risks/${r.risk_id}`)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate],
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Risk review queue</h2>
          <p className="text-xs text-gray-500">
            {total} review{total === 1 ? '' : 's'} in the {VIEWS.find((v) => v.value === view)?.label.toLowerCase()} view
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AntButton icon={<Download size={14} />} onClick={handleExport}>
            Export CSV
          </AntButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <KpiCard
          label="Overdue reviews"
          value={overduePage?.total ?? 0}
          icon={TriangleAlert}
          accent="red"
          alert={(overduePage?.total ?? 0) > 0}
          subtitle="Past their due date"
          selected={view === 'overdue'}
          onClick={() => setView('overdue')}
        />
        <KpiCard
          label="Outstanding"
          value={outstandingPage?.total ?? 0}
          icon={CalendarClock}
          accent="gold"
          subtitle="Scheduled and not yet closed"
          selected={view === 'outstanding'}
          onClick={() => setView('outstanding')}
        />
        <KpiCard
          label="Due within 30 days"
          value={dueSoon}
          icon={CalendarCheck}
          accent="blue"
          subtitle="On this page"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-4 p-2.5 rounded-xl bg-gray-50 border border-gray-200/70">
        <AntSelect
          style={{ width: 170 }}
          value={view}
          onChange={(v) => setView(v)}
          options={VIEWS.map((v) => ({ value: v.value, label: v.label }))}
        />
        <AntSelect
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All registers"
          style={{ width: 220 }}
          value={registerId}
          onChange={(v) => setRegisterId(v ?? undefined)}
          options={registers.map((r) => ({ value: r.id, label: r.name }))}
        />
        <AntSelect
          allowClear
          placeholder="Any outcome"
          style={{ width: 180 }}
          value={outcome}
          onChange={(v) => setOutcome(v ?? undefined)}
          options={REVIEW_OUTCOMES.map((o) => ({ value: o, label: REVIEW_OUTCOME_LABELS[o] }))}
        />
        <div className="ml-auto">
          <AntSelect
            style={{ width: 190 }}
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          emptyMessage="No reviews match this view"
          onRowClick={(r) => nav(`/risk/risks/${r.risk_id}`)}
          rowClassName={(r) => (r.is_overdue && !r.is_complete ? 'bg-red-50/40' : '')}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems: total,
            onPageChange: setPage,
          }}
        />
      </div>

      <CompleteReviewDrawer review={completing} onClose={() => setCompleting(null)} />
    </>
  );
}
