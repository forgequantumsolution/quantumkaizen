import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Empty, Progress, Spin, Tag } from 'antd';
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
  Layers,
  Plug,
  ArrowRight,
  Package,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { KpiCard } from '@/components/ui';
import {
  useCalibrationOverview,
  useCapabilities,
  STATUS_BADGE,
  CRITICALITY_BADGE,
  EVENT_STATUS_BADGE,
  OUTCOME_BADGE,
  KIND_LABELS,
  fmtDate,
  fmtDateTime,
  type Overview,
} from '@/lib/api/calibration';

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
  const { data: caps } = useCapabilities();

  const unavailableIntegrations = useMemo(
    () => Object.values(caps?.integrations ?? {}).filter((i) => !i.available).length,
    [caps],
  );

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Instruments" value={o.instruments.total} icon={Ruler} accent="blue" onClick={() => nav('/calibration/instruments')} />
        <KpiCard
          label="Overdue"
          value={o.schedule.overdue}
          icon={AlertTriangle}
          accent={o.schedule.overdue > 0 ? 'red' : 'green'}
          onClick={() => nav('/calibration/instruments?status=OVERDUE')}
        />
        <KpiCard
          label="Open work"
          value={o.events.open_workload}
          subtitle="scheduled → approval"
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
        <KpiCard
          label="Compliance"
          value={o.instruments.compliance_rate === null ? '—' : `${o.instruments.compliance_rate}%`}
          icon={CheckCircle2}
          accent={(o.instruments.compliance_rate ?? 0) >= 95 ? 'green' : (o.instruments.compliance_rate ?? 0) >= 80 ? 'amber' : 'red'}
        />
      </div>

      {/* ── Things that quietly undermine the programme ── */}
      <Attention o={o} nav={nav} />

      {/* ── Instruments ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Panel title="Instruments" icon={Ruler} to="/calibration/instruments" nav={nav} className="lg:col-span-2">
          {o.instruments.total === 0 ? (
            <Blank text="No instruments registered" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>By calibration status</Label>
                <div className="space-y-1.5">
                  {o.instruments.by_status.map((row) => {
                    const b = STATUS_BADGE[row.status];
                    const share = o.instruments.total ? (row.count / o.instruments.total) * 100 : 0;
                    return (
                      <div key={row.status} className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border w-[105px] justify-center ${b.cls}`}>
                          {b.label}
                        </span>
                        <Progress
                          percent={Math.round(share)}
                          size="small"
                          showInfo={false}
                          strokeColor={row.status === 'OVERDUE' || row.status === 'OUT_OF_SERVICE' ? '#dc2626' : undefined}
                          className="flex-1 !mb-0"
                        />
                        <span className="text-[11px] font-semibold text-gray-700 w-6 text-right">{row.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>By kind</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {o.instruments.by_kind.map((k) => (
                      <Chip key={k.kind} label={KIND_LABELS[k.kind]} value={k.count} />
                    ))}
                  </div>
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
        <Panel title="Schedule" icon={CalendarClock} to="/calibration/schedule" nav={nav}>
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <Stat v={o.schedule.overdue} l="overdue" tone={o.schedule.overdue > 0 ? 'red' : undefined} />
            <Stat v={o.schedule.due_7} l="7 days" />
            <Stat v={o.schedule.due_30} l="30 days" />
            <Stat v={o.schedule.due_90} l="90 days" />
          </div>
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
        <Panel title="Calibrations" icon={ClipboardCheck} to="/calibration/events" nav={nav}>
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <Stat v={o.events.scheduled} l="scheduled" />
            <Stat v={o.events.in_progress} l="in progress" />
            <Stat v={o.events.pending_review} l="review" tone={o.events.pending_review > 0 ? 'amber' : undefined} />
            <Stat v={o.events.pending_approval} l="approval" tone={o.events.pending_approval > 0 ? 'amber' : undefined} />
          </div>
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
          <div className="grid grid-cols-4 gap-2 mb-3 text-center">
            <Stat v={o.oot.open} l="open" tone={o.oot.open > 0 ? 'red' : undefined} />
            <Stat v={o.oot.impact_confirmed} l="confirmed" tone={o.oot.impact_confirmed > 0 ? 'red' : undefined} />
            <Stat v={o.oot.no_impact} l="no impact" />
            <Stat v={o.oot.affected_records} l="records" tone={o.oot.affected_records > 0 ? 'amber' : undefined} />
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

      {/* ── Config-side surfaces ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {o.checks.enabled && (
          <Panel title="In-Use Checks" icon={Repeat} to="/calibration/checks" nav={nav}>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <Stat v={o.checks.due_now} l="due now" tone={o.checks.due_now > 0 ? 'amber' : undefined} />
              <Stat v={o.checks.failed_7d} l="failed 7d" tone={o.checks.failed_7d > 0 ? 'red' : undefined} />
              <Stat v={o.checks.monitored_instruments} l="monitored" />
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {o.msa.enabled && (
          <Panel title="MSA / Gage R&R" icon={Sigma} to="/calibration/config/msa" nav={nav}>
            {o.msa.total === 0 ? (
              <Blank text="No studies recorded" />
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                  <Stat v={o.msa.acceptable} l="acceptable" />
                  <Stat v={o.msa.conditional} l="conditional" tone={o.msa.conditional > 0 ? 'amber' : undefined} />
                  <Stat v={o.msa.unacceptable} l="rejected" tone={o.msa.unacceptable > 0 ? 'red' : undefined} />
                  <Stat v={o.msa.not_computed} l="pending" />
                </div>
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

        <Panel title="Categories" icon={Layers} to="/calibration/config/categories" nav={nav}>
          <div className="grid grid-cols-2 gap-3">
            <Stat v={o.categories.in_use} l="in use" />
            <Stat v={o.categories.active} l="active" />
            <Stat v={o.categories.requiring_msa} l="require MSA" />
            <Stat v={o.categories.requiring_checks} l="require checks" />
          </div>
          {o.instruments.without_plan > 0 && (
            <p className="text-[11px] text-amber-700 mt-3 pt-2 border-t border-gray-100">
              {o.instruments.without_plan} instrument(s) still have no calibration plan.
            </p>
          )}
        </Panel>

        <Panel title="Configuration" icon={Package} to="/calibration/config/policy" nav={nav}>
          <div className="space-y-1.5 text-[11px]">
            <KV k="Industry pack" v={<Tag className="!text-[10px] !mr-0">{o.config.industry_pack}</Tag>} />
            <KV k="Due-soon window" v={`${o.config.due_soon_window_days} days`} />
            <KV k="OOT impact window" v={o.config.oot_impact_window.replace(/_/g, ' ').toLowerCase()} />
            <KV k="MSA" v={o.config.enable_msa ? 'enabled' : 'off'} />
            <KV k="In-use checks" v={o.config.enable_in_use_checks ? 'enabled' : 'off'} />
          </div>

          <div className="mt-3 pt-2 border-t border-gray-100">
            <Label>Integrations</Label>
            <div className="space-y-1">
              {Object.entries(caps?.integrations ?? {}).map(([key, v]) => (
                <div key={key} className="flex items-center gap-1.5 text-[10px]">
                  <Plug size={10} className={v.available ? 'text-emerald-600' : 'text-gray-300'} />
                  <span className={v.available ? 'text-gray-700' : 'text-gray-400'}>{v.label}</span>
                </div>
              ))}
            </div>
            {unavailableIntegrations > 0 && (
              <p className="text-[10px] text-gray-400 mt-1.5 leading-snug">
                Unavailable integrations are hidden from action menus rather than failing when clicked.
              </p>
            )}
          </div>
        </Panel>
      </div>

      <p className="text-[10px] text-gray-400 mt-4 text-right">
        All figures from one query at {fmtDateTime(o.generated_at)} · {o.window_days}-day window
      </p>
    </PageContainer>
  );
}

// ─────────────────────────── Attention strip ───────────────────────────

/** Only renders when there is something genuinely wrong. */
function Attention({ o, nav }: { o: Overview; nav: (to: string) => void }) {
  const items: { type: 'error' | 'warning'; msg: string; desc: string; to: string }[] = [];

  if (o.standards.lapsed > 0)
    items.push({
      type: 'error',
      msg: `${o.standards.lapsed} reference standard(s) lapsed`,
      desc: 'A calibration performed with a lapsed standard has no valid traceability.',
      to: '/calibration/config/standards',
    });
  if (o.providers.accreditation_lapsed > 0)
    items.push({
      type: 'error',
      msg: `${o.providers.accreditation_lapsed} provider accreditation(s) lapsed`,
      desc: 'A certificate from a lapsed laboratory is a finding in every regime.',
      to: '/calibration/config/providers',
    });
  if (o.checks.due_now > 0)
    items.push({
      type: 'warning',
      msg: `${o.checks.due_now} in-use check(s) due now`,
      desc: 'Shift or daily verification is overdue on these devices.',
      to: '/calibration/checks',
    });
  if (o.instruments.without_plan > 0)
    items.push({
      type: 'warning',
      msg: `${o.instruments.without_plan} instrument(s) with no plan`,
      desc: 'Without a plan there is no schedule and no tolerance to judge against.',
      to: '/calibration/instruments',
    });
  if (o.msa.unacceptable > 0)
    items.push({
      type: 'error',
      msg: `${o.msa.unacceptable} gauge(s) failed MSA`,
      desc: '%GRR above 30% — the measurement system cannot discriminate the characteristic.',
      to: '/calibration/config/msa',
    });

  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
      {items.map((i) => (
        <Alert
          key={i.msg}
          type={i.type}
          showIcon
          message={i.msg}
          description={i.desc}
          className="cursor-pointer"
          onClick={() => nav(i.to)}
        />
      ))}
    </div>
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

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border border-gray-200 bg-gray-50 text-gray-600">
      {label}
      <span className="font-bold text-gray-900">{value}</span>
    </span>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{k}</span>
      <span className="text-gray-900 font-medium">{v}</span>
    </div>
  );
}

function Blank({ text }: { text: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="text-[11px]">{text}</span>} className="!my-3" />;
}
