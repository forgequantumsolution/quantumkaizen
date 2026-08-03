import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Empty, Spin, Tag } from 'antd';
import {
  Ruler,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  Repeat,
  Sigma,
  Truck,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { KpiCard } from '@/components/ui';
import {
  ComplianceGauge,
  AgingBucketChart,
  FunnelChart,
  DonutChart,
  CategoryParetoChart,
  type Slice,
} from '@/components/analytics';
import {
  useCalibrationOverview,
  STATUS_BADGE,
  CRITICALITY_BADGE,
  EVENT_STATUS_BADGE,
  OUTCOME_BADGE,
  KIND_LABELS,
  fmtDate,
  fmtDateTime,
} from '@/lib/api/calibration';

/**
 * Chart colours for calibration status. The STATUS_BADGE map holds Tailwind
 * classes, which recharts can't consume — these are the same hues as hex.
 */
const STATUS_HEX: Record<string, string> = {
  CALIBRATED: '#10B981',
  DUE_SOON: '#F59E0B',
  OVERDUE: '#DC2626',
  UNDER_CALIBRATION: '#3B82F6',
  LIMITED_USE: '#F97316',
  OUT_OF_SERVICE: '#991B1B',
  NOT_REQUIRED: '#94A3B8',
};

const OOT_STATUS_CHART: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Open', color: '#DC2626' },
  IMPACT_IN_PROGRESS: { label: 'Impact in progress', color: '#F59E0B' },
  PENDING_QA_APPROVAL: { label: 'Pending QA approval', color: '#D97706' },
  CLOSED: { label: 'Closed', color: '#10B981' },
};

const OUTCOME_CHART: Record<string, { label: string; color: string }> = {
  PASS: { label: 'Pass', color: '#10B981' },
  FAIL: { label: 'Fail', color: '#DC2626' },
  CONDITIONAL: { label: 'Conditional', color: '#F59E0B' },
  NOT_PERFORMED: { label: 'Not performed', color: '#94A3B8' },
};

/**
 * Calibration Overview — the module's front door.
 *
 * Every panel here is one module surface, fed from a single `/analytics/overview`
 * call so nothing on screen can disagree with anything else, and every panel
 * links to the page it summarises. Nothing is hardcoded: an empty install shows
 * honest zeroes and an empty state, not plausible demo numbers.
 */
export default function CalibrationDashboardPage() {
  const nav = useNavigate();
  const { data: o, isLoading } = useCalibrationOverview(90);
  // Chart series, all derived from the single overview payload so they can't
  // disagree with the tiles above them.
  const charts = useMemo(() => {
    const statusRows = o?.instruments.by_status ?? [];
    const statusMap = new Map(statusRows.map((r) => [r.status, r.count]));

    const fleet: Slice[] = statusRows
      .filter((r) => r.count > 0)
      .map((r) => ({
        name: STATUS_BADGE[r.status].label,
        value: r.count,
        color: STATUS_HEX[r.status] ?? '#94A3B8',
      }));

    // The API's due_7 / due_30 / due_90 are CUMULATIVE windows (each counts
    // everything due between now and N days out), so they must be subtracted
    // into disjoint bands before charting — plotting them raw would count the
    // same instrument in three bars.
    const d7 = o?.schedule.due_7 ?? 0;
    const d30 = o?.schedule.due_30 ?? 0;
    const d90 = o?.schedule.due_90 ?? 0;
    const dueHorizon: Slice[] = [
      { name: 'Overdue', value: o?.schedule.overdue ?? 0, color: '#DC2626' },
      { name: '0–7d', value: d7, color: '#F97316' },
      { name: '8–30d', value: Math.max(0, d30 - d7), color: '#F59E0B' },
      { name: '31–90d', value: Math.max(0, d90 - d30), color: '#3B82F6' },
    ];

    // The real order calibrations move through — a funnel reads the bottleneck
    // straight off the widest band.
    const pipeline: Slice[] = [
      { name: 'Scheduled', value: o?.events.scheduled ?? 0, color: '#3B82F6' },
      { name: 'In progress', value: o?.events.in_progress ?? 0, color: '#6366F1' },
      { name: 'Pending review', value: o?.events.pending_review ?? 0, color: '#F59E0B' },
      { name: 'Pending approval', value: o?.events.pending_approval ?? 0, color: '#D97706' },
    ];

    const byKind: Slice[] = (o?.instruments.by_kind ?? []).map((k) => ({
      name: KIND_LABELS[k.kind],
      value: k.count,
    }));

    const msa: Slice[] = [
      { name: 'Acceptable', value: o?.msa.acceptable ?? 0, color: '#10B981' },
      { name: 'Conditional', value: o?.msa.conditional ?? 0, color: '#F59E0B' },
      { name: 'Rejected', value: o?.msa.unacceptable ?? 0, color: '#DC2626' },
      { name: 'Not computed', value: o?.msa.not_computed ?? 0, color: '#94A3B8' },
    ].filter((s) => s.value > 0);

    const ootByStatus: Slice[] = (o?.oot.by_status ?? [])
      .filter((r) => r.count > 0)
      .map((r) => ({
        name: OOT_STATUS_CHART[r.status]?.label ?? r.status,
        value: r.count,
        color: OOT_STATUS_CHART[r.status]?.color ?? '#94A3B8',
      }));

    // Outcome split of the in-use checks actually performed in the last 7 days.
    const checkTally = new Map<string, number>();
    for (const c of o?.checks.recent ?? []) {
      checkTally.set(c.outcome, (checkTally.get(c.outcome) ?? 0) + 1);
    }
    const checkOutcomes: Slice[] = [...checkTally.entries()].map(([outcome, value]) => ({
      name: OUTCOME_CHART[outcome]?.label ?? outcome,
      value,
      color: OUTCOME_CHART[outcome]?.color ?? '#94A3B8',
    }));

    return {
      fleet,
      dueHorizon,
      pipeline,
      byKind,
      msa,
      ootByStatus,
      checkOutcomes,
      // Instruments found within tolerance on arrival — the inverse of the
      // as-found failure rate the API returns.
      asFoundPassRate:
        o?.events.as_found_failure_rate === null || o?.events.as_found_failure_rate === undefined
          ? null
          : 100 - o.events.as_found_failure_rate,
      // Matches the backend's compliance_rate numerator exactly (CALIBRATED +
      // DUE_SOON), so the gauge caption can't contradict the percentage.
      inDate: (statusMap.get('CALIBRATED') ?? 0) + (statusMap.get('DUE_SOON') ?? 0),
    };
  }, [o]);

  if (isLoading || !o) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const empty = o.instruments.total === 0;

  return (
    <PageContainer>
      {empty && (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="No instruments registered yet"
          description="Apply an industry pack in Configuration to seed instrument categories and tolerance templates, then register your first instrument."
          action={
            <a className="text-blue-600 text-xs font-semibold" onClick={() => nav('/calibration/config/packs')}>
              Open Configuration
            </a>
          }
        />
      )}

      {/* ── Headline: the five numbers someone actually acts on ── */}
      <div className={`grid grid-cols-2 gap-3 mb-4 ${o.checks.enabled ? 'lg:grid-cols-6' : 'lg:grid-cols-5'}`}>
        <KpiCard label="Instruments" value={o.instruments.total} icon={Ruler} accent="blue" onClick={() => nav('/calibration/instruments')} />
        <KpiCard
          label="Overdue"
          subtitle="calibration"
          value={o.schedule.overdue}
          icon={AlertTriangle}
          accent={o.schedule.overdue > 0 ? 'red' : 'green'}
          onClick={() => nav('/calibration/instruments?status=OVERDUE')}
        />
        <KpiCard
          label="Open work"
          value={o.events.open_workload}
          subtitle="calibrations in flight"
          icon={ClipboardCheck}
          accent={o.events.open_workload > 0 ? 'amber' : 'green'}
          onClick={() => nav('/calibration/events')}
        />
        <KpiCard
          label="Open OOT"
          value={o.oot.open}
          icon={ShieldAlert}
          accent={o.oot.open > 0 ? 'red' : 'green'}
          onClick={() => nav('/calibration/oot')}
        />
        {o.checks.enabled && (
          <KpiCard
            label="Checks due"
            subtitle="in-use verification"
            value={o.checks.due_now}
            icon={Repeat}
            accent={o.checks.due_now > 0 ? 'amber' : 'green'}
            onClick={() => nav('/calibration/checks')}
          />
        )}
        <KpiCard
          label="Compliance"
          subtitle="instruments in date"
          value={o.instruments.compliance_rate === null ? '—' : `${o.instruments.compliance_rate}%`}
          icon={CheckCircle2}
          accent={(o.instruments.compliance_rate ?? 0) >= 95 ? 'green' : (o.instruments.compliance_rate ?? 0) >= 80 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Programme at a glance: the three shapes the tiles can't show ── */}
      {!empty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <Panel title="Calibration Compliance" icon={CheckCircle2} to="/calibration/instruments" nav={nav}>
            <ComplianceGauge
              value={o.instruments.compliance_rate ?? 0}
              target={95}
              label="Instruments in date"
              caption={`${charts.inDate} of ${o.instruments.total} instruments`}
            />
          </Panel>

          <Panel title="Due Horizon" icon={CalendarClock} to="/calibration/schedule" nav={nav}>
            <AgingBucketChart
              data={charts.dueHorizon}
              height={230}
              valueLabel="Instruments"
              emptyLabel="Nothing due in the next 90 days"
            />
          </Panel>

          <Panel title="Calibration Pipeline" icon={ClipboardCheck} to="/calibration/events" nav={nav}>
            <FunnelChart
              stages={charts.pipeline}
              height={230}
              emptyLabel="No calibrations in flight"
            />
          </Panel>
        </div>
      )}

      {/* ── Instruments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Panel title="Instruments" icon={Ruler} to="/calibration/instruments" nav={nav} className="lg:col-span-2">
          {o.instruments.total === 0 ? (
            <Blank text="No instruments registered" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>By calibration status</Label>
                <DonutChart
                  data={charts.fleet}
                  height={250}
                  centerLabel="instruments"
                  emptyLabel="No instrument statuses yet"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <Label>By kind</Label>
                  <CategoryParetoChart
                    data={charts.byKind}
                    height={180}
                    cumulativeLine={false}
                    valueLabel="Instruments"
                    emptyLabel="No instrument kinds recorded"
                  />
                </div>
                <div>
                  <Label>By criticality</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {o.instruments.by_criticality.map((c) => (
                      <span
                        key={c.criticality}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded border ${CRITICALITY_BADGE[c.criticality]}`}
                      >
                        {c.criticality}
                        <span className="font-bold">{c.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
                {o.instruments.blocked_for_use > 0 && (
                  <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                    <strong>{o.instruments.blocked_for_use}</strong> instrument(s) are currently blocked from producing data.
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>

        {/* ── Schedule ── */}
        {/* The overdue/7/30/90 counts that used to sit here are now the Due
            Horizon chart above, so this panel is just the next-due list. */}
        <Panel title="Schedule" icon={CalendarClock} to="/calibration/schedule" nav={nav}>
          <Label>Next due</Label>
          {o.schedule.next.length === 0 ? (
            <Blank text="Nothing scheduled" />
          ) : (
            <div className="space-y-1">
              {o.schedule.next.map((n) => {
                const overdue = n.due_at ? new Date(n.due_at) < new Date() : false;
                return (
                  <Row key={n.instrument_id} onClick={() => nav(`/calibration/instruments/${n.instrument_id}`)}>
                    <span className="font-mono text-[10px] text-blue-600 w-[68px] shrink-0">{n.code}</span>
                    <span className="text-[11px] text-gray-700 truncate flex-1">{n.name}</span>
                    <span className={`text-[10px] shrink-0 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {fmtDate(n.due_at)}
                    </span>
                  </Row>
                );
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Calibrations + Out of tolerance ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* The scheduled/in-progress/review/approval counts that used to sit
            here are now the Calibration Pipeline funnel above. */}
        <Panel title="Calibrations" icon={ClipboardCheck} to="/calibration/events" nav={nav}>
          <div className="flex gap-4 text-[11px] text-gray-600 mb-3 pb-2 border-b border-gray-100">
            <span>
              <strong className="text-gray-900">{o.events.completed_in_window}</strong> completed / {o.window_days}d
            </span>
            <span>
              on time <strong className="text-gray-900">{o.events.on_time_rate === null ? '—' : `${o.events.on_time_rate}%`}</strong>
            </span>
            <span>
              as-found fail{' '}
              <strong className={o.events.as_found_failure_rate ? 'text-amber-700' : 'text-gray-900'}>
                {o.events.as_found_failure_rate === null ? '—' : `${o.events.as_found_failure_rate}%`}
              </strong>
            </span>
          </div>
          {o.events.recent.length === 0 ? (
            <Blank text="No calibration records" />
          ) : (
            <div className="space-y-1">
              {o.events.recent.map((e) => {
                const b = EVENT_STATUS_BADGE[e.status];
                return (
                  <Row key={e.id} onClick={() => nav(`/calibration/events/${e.id}`)}>
                    <span className="font-mono text-[10px] text-blue-600 w-[104px] shrink-0">{e.event_no}</span>
                    <span className="text-[11px] text-gray-700 truncate flex-1">
                      {e.instrument_code} · {e.instrument_name}
                    </span>
                    {e.as_found_outcome && (
                      <span className={`inline-flex px-1 py-0.5 text-[9px] font-medium rounded border shrink-0 ${OUTCOME_BADGE[e.as_found_outcome]}`}>
                        {e.as_found_outcome}
                      </span>
                    )}
                    <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-medium rounded border shrink-0 ${b.cls}`}>{b.label}</span>
                  </Row>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Out of Tolerance" icon={AlertTriangle} to="/calibration/oot" nav={nav}>
          {/* by_status is a true distribution, so it charts honestly; the other
              figures are separate measures and stay as a summary line. */}
          <DonutChart
            data={charts.ootByStatus}
            height={210}
            centerLabel="assessments"
            emptyLabel="No out-of-tolerance assessments"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600 my-3 pt-2 border-t border-gray-100">
            <span>
              impact confirmed{' '}
              <strong className={o.oot.impact_confirmed > 0 ? 'text-red-600' : 'text-gray-900'}>
                {o.oot.impact_confirmed}
              </strong>
            </span>
            <span>
              no impact <strong className="text-gray-900">{o.oot.no_impact}</strong>
            </span>
            <span>
              affected records{' '}
              <strong className={o.oot.affected_records > 0 ? 'text-amber-700' : 'text-gray-900'}>
                {o.oot.affected_records}
              </strong>
            </span>
          </div>
          {(o.oot.awaiting_customer_notification > 0 || o.oot.awaiting_product_hold > 0) && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
              {o.oot.awaiting_customer_notification > 0 && (
                <div>{o.oot.awaiting_customer_notification} awaiting customer notification (IATF §7.1.5.2.1)</div>
              )}
              {o.oot.awaiting_product_hold > 0 && <div>{o.oot.awaiting_product_hold} awaiting a product-hold reference</div>}
            </div>
          )}
          {o.oot.largest_error !== null && (
            <p className="text-[11px] text-gray-500 mb-2">
              Largest as-found error in window: <span className="font-mono font-semibold">{o.oot.largest_error}</span>
            </p>
          )}
          {o.oot.recent.length === 0 ? (
            <Blank text="No open assessments" />
          ) : (
            <div className="space-y-1">
              {o.oot.recent.map((r) => (
                <Row key={r.id} onClick={() => nav(`/calibration/oot/${r.id}`)}>
                  <span className="font-mono text-[10px] text-blue-600 w-[104px] shrink-0">{r.event_no}</span>
                  <span className="text-[11px] text-gray-700 truncate flex-1">{r.instrument_code}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{r.window_days}d</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${r.affected_total > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {r.affected_total} rec
                  </span>
                </Row>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Quality of the calibrations themselves, plus traceability ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Panel title="As-Found Quality" icon={ShieldAlert} to="/calibration/events" nav={nav}>
          {charts.asFoundPassRate === null ? (
            <Blank text={`No calibrations completed in ${o.window_days} days`} />
          ) : (
            <ComplianceGauge
              value={charts.asFoundPassRate}
              target={90}
              label="Found in tolerance"
              caption={`${o.events.completed_in_window} completed / ${o.window_days}d · on time ${
                o.events.on_time_rate === null ? '—' : `${o.events.on_time_rate}%`
              }`}
            />
          )}
        </Panel>

        {o.checks.enabled && (
          <Panel title="In-Use Checks" icon={Repeat} to="/calibration/checks" nav={nav}>
            <DonutChart
              data={charts.checkOutcomes}
              height={190}
              centerLabel="checks / 7d"
              emptyLabel="No checks in the last 7 days"
            />
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 my-3 pt-2 border-t border-gray-100">
              <span>
                due now{' '}
                <strong className={o.checks.due_now > 0 ? 'text-amber-700' : 'text-gray-900'}>{o.checks.due_now}</strong>
              </span>
              <span>
                failed 7d{' '}
                <strong className={o.checks.failed_7d > 0 ? 'text-red-600' : 'text-gray-900'}>{o.checks.failed_7d}</strong>
              </span>
              <span>
                monitored <strong className="text-gray-900">{o.checks.monitored_instruments}</strong>
              </span>
            </div>
            {o.checks.recent.length === 0 ? (
              <Blank text="No checks in the last 7 days" />
            ) : (
              <div className="space-y-1">
                {o.checks.recent.slice(0, 5).map((c) => (
                  <Row key={c.id} onClick={() => nav('/calibration/checks')}>
                    <span className="font-mono text-[10px] text-gray-500 w-[68px] shrink-0">{c.instrument_code}</span>
                    <span className="text-[10px] text-gray-400 flex-1 truncate">{fmtDateTime(c.performed_at)}</span>
                    {c.hold_triggered && <Tag color="red" className="!text-[9px] !mr-0">hold</Tag>}
                    <span className={`inline-flex px-1 py-0.5 text-[9px] font-medium rounded border shrink-0 ${OUTCOME_BADGE[c.outcome]}`}>
                      {c.outcome}
                    </span>
                  </Row>
                ))}
              </div>
            )}
          </Panel>
        )}

        <Panel title="Reference Standards" icon={ShieldCheck} to="/calibration/config/standards" nav={nav}>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <Stat v={o.standards.total} l="total" />
            <Stat v={o.standards.lapsed} l="lapsed" tone={o.standards.lapsed > 0 ? 'red' : undefined} />
            <Stat v={o.standards.expiring_60} l="due 60d" tone={o.standards.expiring_60 > 0 ? 'amber' : undefined} />
          </div>
          {o.standards.items.length === 0 ? (
            <Blank text={o.standards.total === 0 ? 'No reference standards registered' : 'All standards in date'} />
          ) : (
            <div className="space-y-1">
              {o.standards.items.map((s) => (
                <Row key={s.instrument_id} onClick={() => nav(`/calibration/instruments/${s.instrument_id}`)}>
                  <span className="font-mono text-[10px] text-blue-600 w-[68px] shrink-0">{s.code}</span>
                  <span className="text-[11px] text-gray-700 truncate flex-1">{s.name}</span>
                  <span className={`text-[10px] shrink-0 ${s.is_lapsed ? 'text-red-600 font-semibold' : 'text-amber-700'}`}>
                    {fmtDate(s.due_at)}
                  </span>
                </Row>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Providers" icon={Truck} to="/calibration/config/providers" nav={nav}>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <Stat v={o.providers.active} l="active" />
            <Stat v={o.providers.accreditation_lapsed} l="lapsed" tone={o.providers.accreditation_lapsed > 0 ? 'red' : undefined} />
            <Stat v={o.providers.accreditation_expiring_60} l="expiring" tone={o.providers.accreditation_expiring_60 > 0 ? 'amber' : undefined} />
          </div>
          {o.providers.items.length === 0 ? (
            <Blank text={o.providers.total === 0 ? 'No providers registered' : 'All accreditations valid'} />
          ) : (
            <div className="space-y-1">
              {o.providers.items.map((p) => (
                <Row key={p.provider_id} onClick={() => nav('/calibration/config/providers')}>
                  <span className="font-mono text-[10px] text-blue-600 w-[52px] shrink-0">{p.code}</span>
                  <span className="text-[11px] text-gray-700 truncate flex-1">{p.name}</span>
                  <span className={`text-[10px] shrink-0 ${p.is_lapsed ? 'text-red-600 font-semibold' : 'text-amber-700'}`}>
                    {fmtDate(p.expires)}
                  </span>
                </Row>
              ))}
            </div>
          )}
        </Panel>

        {/* MSA lives in this row rather than one of its own: it's optional, so
            a dedicated row collapses to a lone card whenever it's disabled. */}
        {o.msa.enabled && (
          <Panel title="MSA / Gage R&R" icon={Sigma} to="/calibration/config/msa" nav={nav}>
            {o.msa.total === 0 ? (
              <Blank text="No studies recorded" />
            ) : (
              <>
                <DonutChart
                  data={charts.msa}
                  height={210}
                  centerLabel="studies"
                  emptyLabel="No study verdicts yet"
                />
                {o.msa.awaiting_approval > 0 && (
                  <p className="text-[11px] text-amber-700 mb-2">{o.msa.awaiting_approval} study(ies) computed but not approved.</p>
                )}
                <div className="space-y-1">
                  {o.msa.recent.map((m) => (
                    <Row key={m.id} onClick={() => nav('/calibration/config/msa')}>
                      <span className="font-mono text-[10px] text-blue-600 w-[96px] shrink-0">{m.study_no}</span>
                      <span className="text-[11px] text-gray-700 truncate flex-1">{m.instrument_code}</span>
                      <span className="font-mono text-[10px] text-gray-600 shrink-0">
                        {m.grr_percent === null ? '—' : `${m.grr_percent.toFixed(1)}%`}
                      </span>
                    </Row>
                  ))}
                </div>
              </>
            )}
          </Panel>
        )}
      </div>

      {/* The Categories and Configuration panels that used to close the page
          were pure setup state, not programme health, and are one click away
          under Configuration. */}
      <p className="text-[10px] text-gray-400 mt-4 text-right">
        {o.config.industry_pack} pack · due-soon {o.config.due_soon_window_days}d · all figures from one query at{' '}
        {fmtDateTime(o.generated_at)} · {o.window_days}-day window
      </p>
    </PageContainer>
  );
}


// ─────────────────────────── Primitives ───────────────────────────

function Panel({
  title,
  icon: Icon,
  to,
  nav,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  to: string;
  nav: (to: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-gray-200/80 bg-white shadow-sm p-4 ${className ?? ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <Icon size={14} className="text-gray-400" />
          {title}
        </h2>
        <button
          type="button"
          onClick={() => nav(to)}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          View <ArrowRight size={11} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Stat({ v, l, tone }: { v: number | string; l: string; tone?: 'red' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div>
      <div className={`text-lg font-bold leading-tight ${color}`}>{v}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wide font-semibold">{l}</div>
    </div>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2 py-1 px-1 -mx-1 rounded hover:bg-gray-50 cursor-pointer transition-colors"
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">{children}</div>;
}

function Blank({ text }: { text: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[11px]">{text}</span>} className="!my-3" />;
}
