/**
 * The risk workspace — where a risk is scored, treated, linked, reviewed and
 * formally accepted.
 *
 * The rule that shapes this whole screen: the client never computes a persisted
 * score. The Scoring tab collects factor *ranks* from the framework's anchored
 * scales and posts them; the score, the level and the action priority all come
 * back from the server, and the history chart is drawn from the immutable
 * snapshots the server wrote. Nothing here invents a number.
 *
 * The status control is deliberately permissive: the server owns the transition
 * state machine and its 400 spells out which moves are legal from here. Mirroring
 * that map in the browser would rot; surfacing the server's own sentence does not.
 */
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Button as AntButton,
  DatePicker,
  Drawer,
  Form,
  Input as AntInput,
  Select as AntSelect,
  Switch,
  Tooltip,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronsRight,
  CalendarClock,
  ExternalLink,
  FileText,
  Gauge,
  History,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { ChartCard, EmptyChart, PALETTE, TrendLineChart } from '@/components/analytics';
import { Badge, Card, DataTable, type Column } from '@/components/ui';
import Spinner from '@/components/ui/Spinner';
import Tabs from '@/components/ui/Tabs';
import ESignatureModal from '@/components/shared/ESignatureModal';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDocuments } from '@/lib/api/dms';
import { api } from '@/lib/api';
import DownloadRiskReportButton from './report/DownloadRiskReportButton';
import {
  riskKeys,
  useAcceptRisk,
  useAddRiskLink,
  useCompleteReview,
  useCreateControl,
  useCreateReview,
  useDeleteControl,
  useLinkableSearch,
  useLinkableTypes,
  useRemoveRiskLink,
  useRisk,
  useRiskControls,
  useRiskFramework,
  useRiskFrameworks,
  useRiskHistory,
  useRiskReviews,
  useScoreRisk,
  useUpdateControl,
  useUpdateControlStatus,
  useUpdateRisk,
  useUpdateRiskStatus,
  useVerifyControl,
  CONTROL_HIERARCHY_LABELS,
  CONTROL_STATUS_LABELS,
  CONTROL_TYPE_LABELS,
  REVIEW_OUTCOME_LABELS,
  RISK_STATUS_LABELS,
  TREATMENT_LABELS,
  type ControlHierarchy,
  type ControlStatus,
  type ControlType,
  type FactorValues,
  type Risk,
  type RiskControl,
  type RiskFramework,
  type RiskLink,
  type RiskReview,
  type RiskScoreSnapshot,
  type RiskStatus,
  type RiskTreatment,
  type ReviewOutcome,
  type ScoreStage,
} from '@/lib/api/risk';
import { ControlStatusBadge, RiskLevelBadge, RiskStatusBadge } from './riskStatusBadge';

const RISK_STATUSES = Object.keys(RISK_STATUS_LABELS) as RiskStatus[];
const CONTROL_TYPES = Object.keys(CONTROL_TYPE_LABELS) as ControlType[];
const CONTROL_HIERARCHIES = Object.keys(CONTROL_HIERARCHY_LABELS) as ControlHierarchy[];

// Non-verify control transitions offered by the "Advance status" action. The
// server owns the real state machine (risk-control.service ALLOWED_CONTROL_
// TRANSITIONS); IMPLEMENTED→VERIFIED / IMPLEMENTED→INEFFECTIVE are deliberately
// omitted here because those go through the Verify flow (they need evidence).
const NEXT_CONTROL_STATUSES: Record<ControlStatus, ControlStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IMPLEMENTED', 'CANCELLED'],
  IMPLEMENTED: [],
  VERIFIED: [],
  INEFFECTIVE: ['IN_PROGRESS'],
  CANCELLED: [],
};
const REVIEW_OUTCOMES = Object.keys(REVIEW_OUTCOME_LABELS) as ReviewOutcome[];
const TREATMENTS = Object.keys(TREATMENT_LABELS) as RiskTreatment[];

const SCORE_STAGES: { value: ScoreStage; label: string }[] = [
  { value: 'INITIAL', label: 'Initial — before controls' },
  { value: 'RESIDUAL', label: 'Residual — after controls' },
  { value: 'TARGET', label: 'Target — where treatment aims' },
  { value: 'REVIEW', label: 'Review — periodic re-score' },
];

// The linkable record types are served by the backend entity registry
// (GET /risk/links/types) rather than hardcoded here — adding a type must not
// require a client release, and a list that drifts from the backend's is how
// links ended up unresolvable in the first place.

const LINK_RELATIONS = ['CAUSED_BY', 'MITIGATED_BY', 'APPLIES_TO', 'EVIDENCE', 'ESCALATED_TO'] as const;

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const fmtDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : '—');

/**
 * The risk API returns actionable prose in its 400s — the legal transitions, the
 * missing residual score, the ISO 14971 benefit–risk requirement. Swallowing that
 * into "Operation failed" is the single worst thing this page could do.
 */
const extractErr = (err: unknown): string => {
  const res = (err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  })?.response?.data;
  return res?.error?.message ?? res?.message ?? (err as { message?: string })?.message ?? 'Operation failed';
};

const humanise = (s: string) => s.replace(/_/g, ' ');

// ── Audit trail ─────────────────────────────────────────────────────────────

interface TrailEntry {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  user_name: string | null;
  created_at: string;
}

/** Shared trail endpoint — enveloped as { status, data: [...] }, snake_case rows. */
const useRiskAuditTrail = (id: string) =>
  useQuery<TrailEntry[]>({
    queryKey: ['audit', 'trail', 'Risk', id],
    queryFn: () => api.get(`/audit/trail/Risk/${id}`).then((r) => (r.data?.data ?? []) as TrailEntry[]),
    enabled: !!id,
  });

// ── Page ────────────────────────────────────────────────────────────────────

export default function RiskDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [tab, setTab] = useState('overview');

  const canUpdate = useHasPermission('risk.update');
  const canAccept = useHasPermission('risk.accept');
  const canReadControls = useHasPermission('risk_control.read');
  const canReadReviews = useHasPermission('risk_review.read');

  const { data: risk, isLoading } = useRisk(id);
  const { data: frameworks = [] } = useRiskFrameworks({ isActive: true });
  const { data: history = [] } = useRiskHistory(id);
  const { data: trail = [], isLoading: trailLoading } = useRiskAuditTrail(id);

  // A risk may inherit its framework from the register; fall back to the org
  // default so the scoring scales shown are the ones the server will apply.
  const frameworkId = risk?.framework?.id ?? frameworks.find((f) => f.is_default)?.id ?? '';
  const { data: framework } = useRiskFramework(frameworkId || undefined);

  const { data: controlPage } = useRiskControls(
    canReadControls && id ? { riskId: id, pageSize: 200, sortBy: 'controlNumber', sortDir: 'asc' } : {},
  );
  const { data: reviewPage } = useRiskReviews(
    canReadReviews && id ? { riskId: id, pageSize: 200, sortBy: 'dueAt', sortDir: 'desc' } : {},
  );

  const statusMut = useUpdateRiskStatus(id);
  const [statusError, setStatusError] = useState<string | null>(null);

  const controls = canReadControls ? controlPage?.data ?? [] : [];
  const reviews = canReadReviews ? reviewPage?.data ?? [] : [];

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 pt-5 pb-10">
        <div className="flex items-center justify-center py-32">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="px-4 sm:px-6 pt-5 pb-10">
        <Card className="text-center py-16">
          <p className="text-sm text-gray-500">This risk does not exist, or you cannot see it.</p>
          <AntButton className="mt-4" onClick={() => nav('/risk/risks')}>
            Back to the risk register
          </AntButton>
        </Card>
      </div>
    );
  }

  const changeStatus = async (next: RiskStatus, reason?: string) => {
    setStatusError(null);
    try {
      await statusMut.mutateAsync({ status: next, reason: reason?.trim() || null });
      message.success(`Risk moved to ${RISK_STATUS_LABELS[next]}`);
    } catch (err) {
      // The server lists the transitions it will accept — show the sentence.
      const text = extractErr(err);
      setStatusError(text);
      message.error(text);
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'scoring', label: 'Scoring', count: history.length },
    ...(canReadControls ? [{ id: 'controls', label: 'Controls', count: controls.length }] : []),
    { id: 'links', label: 'Links', count: risk.links?.length ?? 0 },
    ...(canReadReviews ? [{ id: 'reviews', label: 'Reviews', count: reviews.length }] : []),
    { id: 'trail', label: 'Audit Trail' },
  ];

  return (
    <div className="px-4 sm:px-6 pt-5 pb-10 space-y-4">
      <Card noPadding>
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => nav('/risk/risks')}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 mb-2"
          >
            <ArrowLeft size={14} /> Risk register
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-blue-700">{risk.risk_number}</span>
                <RiskStatusBadge status={risk.status} />
                {risk.is_review_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border bg-red-50 text-red-700 border-red-200">
                    <TriangleAlert size={11} /> Review overdue
                  </span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mt-1">{risk.title}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {risk.register?.name ?? 'No register'}
                {risk.category ? ` · ${risk.category.name}` : ''}
                {risk.framework ? ` · ${risk.framework.name}` : ''}
              </p>

              {/* Initial → residual, side by side: the delta IS the risk story. */}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <RiskLevelBadge level={risk.initial_level} score={risk.initial_score} prefix="Initial" />
                <ArrowRight size={13} className="text-gray-300" />
                <RiskLevelBadge level={risk.residual_level} score={risk.residual_score} prefix="Residual" />
                {risk.initial_score != null && risk.residual_score != null && (
                  <span
                    className={
                      risk.residual_score < risk.initial_score
                        ? 'text-[11px] font-semibold text-emerald-600'
                        : 'text-[11px] font-semibold text-gray-400'
                    }
                  >
                    {risk.residual_score < risk.initial_score
                      ? `−${risk.initial_score - risk.residual_score} reduction`
                      : 'No reduction yet'}
                  </span>
                )}
                {risk.target_level && (
                  <RiskLevelBadge level={risk.target_level} score={risk.target_score} prefix="Target" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <DownloadRiskReportButton kind="risk" id={risk.id} number={risk.risk_number} />
              {canUpdate && (
                <StatusTransition
                  current={risk.status}
                  pending={statusMut.isPending}
                  onChange={changeStatus}
                />
              )}
              {canAccept && <AcceptRiskAction risk={risk} />}
            </div>
          </div>

          {statusError && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <TriangleAlert size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">{statusError}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100">
          <Tabs tabs={tabs} activeTab={tab} onTabChange={setTab} />
        </div>
      </Card>

      {tab === 'overview' && <OverviewTab risk={risk} canUpdate={canUpdate} />}
      {tab === 'scoring' && (
        <ScoringTab risk={risk} framework={framework} history={history} canUpdate={canUpdate} />
      )}
      {tab === 'controls' && canReadControls && <ControlsTab riskId={risk.id} controls={controls} />}
      {tab === 'links' && <LinksTab risk={risk} canUpdate={canUpdate} />}
      {tab === 'reviews' && canReadReviews && <ReviewsTab riskId={risk.id} reviews={reviews} />}
      {tab === 'trail' && <TrailTab entries={trail} isLoading={trailLoading} />}
    </div>
  );
}

// ── Status transition ───────────────────────────────────────────────────────

/**
 * Every status is offered, with an optional reason. The server refuses the
 * illegal ones and names the legal set in the message the caller surfaces —
 * that beats a client-side copy of the state machine that silently drifts.
 */
function StatusTransition({
  current,
  pending,
  onChange,
}: {
  current: RiskStatus;
  pending: boolean;
  onChange: (next: RiskStatus, reason?: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<RiskStatus | undefined>();
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!next) return;
    await onChange(next, reason);
    setOpen(false);
    setNext(undefined);
    setReason('');
  };

  return (
    <>
      <AntButton loading={pending} onClick={() => setOpen(true)}>
        Change status
      </AntButton>
      <Drawer
        title="Change risk status"
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" disabled={!next} loading={pending} onClick={submit}>
              Apply
            </AntButton>
          </div>
        }
      >
        <p className="text-xs text-gray-500 mb-4">
          Current status is <span className="font-semibold text-gray-800">{RISK_STATUS_LABELS[current]}</span>.
          The risk lifecycle is enforced server-side — if the move is not permitted from here, the
          allowed transitions are reported back on this screen.
        </p>
        <label className="label label-required">Move to</label>
        <AntSelect
          className="w-full"
          placeholder="Select the new status"
          value={next}
          onChange={(v) => setNext(v as RiskStatus)}
          options={RISK_STATUSES.filter((s) => s !== current).map((s) => ({
            value: s,
            label: RISK_STATUS_LABELS[s],
          }))}
        />
        <label className="label mt-4 block">Reason</label>
        <AntInput.TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Recorded on the audit trail with the transition"
        />
      </Drawer>
    </>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap break-words">{value || '—'}</div>
    </div>
  );
}

function OverviewTab({ risk, canUpdate }: { risk: Risk; canUpdate: boolean }) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const updateMut = useUpdateRisk(risk.id);
  const { data: directory } = useUserDirectory();

  const owner = (directory?.items ?? []).find((u) => u.id === risk.owner_id);

  const openEdit = () => {
    form.setFieldsValue({
      title: risk.title,
      description: risk.description ?? '',
      hazard: risk.hazard ?? '',
      hazardousSituation: risk.hazardous_situation ?? '',
      harm: risk.harm ?? '',
      cause: risk.cause ?? '',
      consequence: risk.consequence ?? '',
      treatment: risk.treatment ?? null,
      ownerId: risk.owner_id ?? null,
    });
    setOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await updateMut.mutateAsync({
        title: String(v.title).trim(),
        description: v.description?.trim() || null,
        hazard: v.hazard?.trim() || null,
        hazardousSituation: v.hazardousSituation?.trim() || null,
        harm: v.harm?.trim() || null,
        cause: v.cause?.trim() || null,
        consequence: v.consequence?.trim() || null,
        treatment: (v.treatment || null) as RiskTreatment | null,
        ownerId: v.ownerId || null,
      });
      message.success('Risk updated');
      setOpen(false);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Risk statement</h3>
          {canUpdate && (
            <AntButton size="small" icon={<Pencil size={13} />} onClick={openEdit}>
              Edit
            </AntButton>
          )}
        </div>
        <div className="space-y-4">
          <Field label="Description" value={risk.description} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Hazard" value={risk.hazard} />
            <Field label="Hazardous situation" value={risk.hazardous_situation} />
            <Field label="Harm" value={risk.harm} />
            <Field label="Cause" value={risk.cause} />
            <Field label="Consequence" value={risk.consequence} />
            <Field
              label="Planned treatment"
              value={
                risk.treatment ? <Badge variant="info">{TREATMENT_LABELS[risk.treatment]}</Badge> : null
              }
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Governance</h3>
        <div className="space-y-4">
          <Field label="Register" value={risk.register?.name} />
          <Field label="Category" value={risk.category?.name} />
          <Field label="Framework" value={risk.framework?.name} />
          <Field label="Risk owner" value={owner?.name ?? (risk.owner_id ? 'Assigned' : null)} />
          <Field label="Identified" value={fmtDate(risk.identified_at)} />
          <Field
            label="Next review"
            value={
              <span className={risk.is_review_overdue ? 'text-red-600 font-semibold' : undefined}>
                {fmtDate(risk.next_review_at)}
              </span>
            }
          />
          <Field label="Accepted" value={fmtDateTime(risk.accepted_at)} />
          <Field label="Closed" value={fmtDateTime(risk.closed_at)} />
        </div>
      </Card>

      <Drawer
        title="Edit risk"
        width={520}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={updateMut.isPending} onClick={submit}>
              Save changes
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'A title is required' }]}>
            <AntInput />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="hazard" label="Hazard">
            <AntInput placeholder="The source of potential harm" />
          </Form.Item>
          <Form.Item name="hazardousSituation" label="Hazardous situation">
            <AntInput placeholder="The circumstance that exposes people or product to the hazard" />
          </Form.Item>
          <Form.Item name="harm" label="Harm">
            <AntInput />
          </Form.Item>
          <Form.Item name="cause" label="Cause">
            <AntInput.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="consequence" label="Consequence">
            <AntInput.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="treatment" label="Planned treatment">
            <AntSelect
              allowClear
              placeholder="Not decided"
              options={TREATMENTS.map((t) => ({ value: t, label: TREATMENT_LABELS[t] }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Risk owner">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={(directory?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function ScoringTab({
  risk,
  framework,
  history,
  canUpdate,
}: {
  risk: Risk;
  framework: RiskFramework | undefined;
  history: RiskScoreSnapshot[];
  canUpdate: boolean;
}) {
  const [stage, setStage] = useState<ScoreStage>('INITIAL');
  const [draft, setDraft] = useState<FactorValues>({});
  const [reason, setReason] = useState('');
  const [computed, setComputed] = useState<NonNullable<Risk['computed']> | null>(null);
  const scoreMut = useScoreRisk(risk.id);

  // Prefill from whichever stage's ranks are already stored, so a re-score edits
  // the previous judgement rather than starting from an empty grid.
  const stored = useMemo<FactorValues>(() => {
    if (stage === 'INITIAL') return risk.initial_factors ?? {};
    if (stage === 'TARGET') return risk.target_factors ?? {};
    return risk.residual_factors ?? {};
  }, [stage, risk.initial_factors, risk.target_factors, risk.residual_factors]);

  const effective = { ...stored, ...draft };
  const factors = framework?.factors ?? [];
  const complete = factors.length > 0 && factors.every((f) => effective[f.key] != null);

  const submit = async () => {
    if (!complete) {
      message.warning('Give every factor an anchored rank before scoring');
      return;
    }
    try {
      const updated = await scoreMut.mutateAsync({
        stage,
        // Ranks only. The server owns the arithmetic and the band lookup.
        factors: Object.fromEntries(factors.map((f) => [f.key, effective[f.key]!])),
        reason: reason.trim() || null,
      });
      setComputed(updated.computed ?? null);
      setDraft({});
      setReason('');
      message.success('Score recorded');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  // Oldest-first for the trend; the table below reads newest-first.
  const trendRows = useMemo(
    () =>
      [...history]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((h) => ({
          point: new Date(h.created_at).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
          }),
          score: h.score ?? 0,
        })),
    [history],
  );

  const newestFirst = useMemo(
    () =>
      [...history].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [history],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Score this risk</h3>
        </div>

        {!framework ? (
          <p className="text-xs text-gray-500 py-10 text-center">
            No scoring framework resolves for this risk. Attach one to the register, or mark a
            framework as the organisation default under Risk Configuration.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                Stage
              </label>
              <AntSelect
                className="w-full"
                value={stage}
                onChange={(v) => {
                  setStage(v as ScoreStage);
                  setDraft({});
                  setComputed(null);
                }}
                options={SCORE_STAGES}
              />
            </div>

            <div className="space-y-4">
              {[...factors]
                .sort((a, b) => a.order - b.order)
                .map((f) => {
                  const selected = effective[f.key];
                  const level = f.levels.find((l) => l.rank === selected);
                  return (
                    <div key={f.id}>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                        {f.label} <span className="font-mono normal-case text-gray-300">{f.key}</span>
                      </label>
                      <AntSelect
                        className="w-full"
                        disabled={!canUpdate}
                        placeholder={`Select ${f.label.toLowerCase()}`}
                        value={selected}
                        onChange={(v) => setDraft((prev) => ({ ...prev, [f.key]: v as number }))}
                        options={[...f.levels]
                          .sort((a, b) => a.rank - b.rank)
                          .map((l) => ({ value: l.rank, label: `${l.rank} — ${l.label}` }))}
                      />
                      {/* The anchored definition is what makes the score defensible
                          in an inspection — it is never hidden behind a tooltip. */}
                      <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                        {level?.definition ??
                          level?.guidance ??
                          f.description ??
                          'Pick the anchored level whose definition matches the evidence.'}
                      </p>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
                Justification
              </label>
              <AntInput.TextArea
                rows={2}
                value={reason}
                disabled={!canUpdate}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why these ranks — stored on the immutable snapshot"
              />
            </div>

            {canUpdate && (
              <AntButton type="primary" block className="mt-4" loading={scoreMut.isPending} onClick={submit}>
                Record score
              </AntButton>
            )}

            {computed && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
                  Server result — {humanise(computed.stage)}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold tabular-nums text-emerald-800">{computed.score}</span>
                  <RiskLevelBadge level={computed.level} />
                  {computed.action_priority && (
                    <Badge variant="warning">AP {computed.action_priority}</Badge>
                  )}
                  {computed.requires_capa && <Badge variant="danger">CAPA required</Badge>}
                  {computed.requires_control && <Badge variant="warning">Control required</Badge>}
                  {computed.requires_approval && <Badge variant="purple">Approval required</Badge>}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
              {(
                [
                  ['Initial', risk.initial_level, risk.initial_score],
                  ['Residual', risk.residual_level, risk.residual_score],
                  ['Target', risk.target_level, risk.target_score],
                ] as const
              ).map(([label, lvl, sc]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    {label}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-gray-900">{sc ?? '—'}</p>
                  <div className="mt-1 flex justify-center">
                    <RiskLevelBadge level={lvl} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-snug">
              Only the factor ranks are submitted. The score, the level band and the review date are
              computed and stored by the server — the browser never persists a score.
            </p>
          </>
        )}
      </Card>

      <div className="space-y-4">
        <ChartCard title="Score history" subtitle="Every snapshot, oldest first" accent={PALETTE.purple}>
          {trendRows.length === 0 ? (
            <EmptyChart label="This risk has not been scored yet" height={220} />
          ) : (
            <TrendLineChart
              data={trendRows}
              xKey="point"
              height={220}
              series={[{ key: 'score', name: 'Score', color: PALETTE.purple, area: false }]}
              emptyLabel="This risk has not been scored yet"
            />
          )}
        </ChartCard>

        <Card noPadding>
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <History size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Snapshots</h3>
          </div>
          {newestFirst.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-gray-400">No snapshots recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    {['When', 'Stage', 'Factors', 'Score', 'Level', 'By', 'Reason'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((h) => (
                    <tr key={h.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {fmtDateTime(h.created_at)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="default">{humanise(h.stage)}</Badge>
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-gray-600">
                        {Object.entries(h.factors ?? {})
                          .map(([k, v]) => `${k}=${v}`)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-2 text-xs font-semibold tabular-nums text-gray-900">
                        {h.score ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-700">{h.level_label ?? '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{h.user_name}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 max-w-[220px] truncate" title={h.reason ?? ''}>
                        {h.reason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

interface ControlFormValues {
  title: string;
  description?: string;
  type: ControlType;
  hierarchy?: ControlHierarchy | null;
  ownerId?: string | null;
  dueDate?: Dayjs | null;
  documentId?: string | null;
}

function ControlsTab({ riskId, controls }: { riskId: string; controls: RiskControl[] }) {
  const canCreate = useHasPermission('risk_control.create');
  const canUpdate = useHasPermission('risk_control.update');
  const canApprove = useHasPermission('risk_control.approve');
  const canDelete = useHasPermission('risk_control.delete');
  const confirmDelete = useConfirmDelete();

  const [editing, setEditing] = useState<RiskControl | null>(null);
  const [open, setOpen] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<RiskControl | null>(null);
  const [statusTarget, setStatusTarget] = useState<RiskControl | null>(null);
  const [form] = Form.useForm<ControlFormValues>();

  const createMut = useCreateControl();
  const updateMut = useUpdateControl(editing?.id ?? '');
  const deleteMut = useDeleteControl();
  const { data: directory } = useUserDirectory();
  // Controlled documents that can back a control as evidence (RiskControl.documentId).
  const { data: docs } = useDocuments({ page_size: 200 });

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      title: '',
      description: '',
      type: 'PREVENTIVE',
      hierarchy: null,
      ownerId: null,
      dueDate: null,
      documentId: null,
    });
    setOpen(true);
  };

  const openEdit = (c: RiskControl) => {
    setEditing(c);
    setOpen(true);
    // Values are applied after the drawer mounts so destroyOnClose does not wipe them.
    setTimeout(() =>
      form.setFieldsValue({
        title: c.title,
        description: c.description ?? '',
        type: c.type,
        hierarchy: c.hierarchy ?? null,
        ownerId: c.owner_id ?? null,
        dueDate: c.due_date ? dayjs(c.due_date) : null,
        documentId: c.document_id ?? null,
      }),
    );
  };

  const submit = async () => {
    const v = await form.validateFields();
    const body = {
      title: v.title.trim(),
      description: v.description?.trim() || null,
      type: v.type,
      hierarchy: v.hierarchy || null,
      ownerId: v.ownerId || null,
      dueDate: v.dueDate ? v.dueDate.toISOString() : null,
      documentId: v.documentId || null,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(body);
        message.success('Control updated');
      } else {
        await createMut.mutateAsync({ risk_id: riskId, body });
        message.success('Control added');
      }
      setOpen(false);
      setEditing(null);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const columns: Column<RiskControl>[] = [
    {
      key: 'control_number',
      header: 'Control #',
      render: (c) => <span className="font-mono text-xs text-blue-700">{c.control_number}</span>,
    },
    {
      key: 'title',
      header: 'Control',
      render: (c) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate max-w-[300px]">{c.title}</p>
          <p className="text-xs text-gray-500 truncate max-w-[300px]">
            {CONTROL_TYPE_LABELS[c.type]}
            {c.hierarchy ? ` · ${CONTROL_HIERARCHY_LABELS[c.hierarchy]}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (c) => <ControlStatusBadge status={c.status} /> },
    {
      key: 'due_date',
      header: 'Due',
      render: (c) => (
        <span
          className={c.is_overdue ? 'text-xs font-semibold text-red-600' : 'text-xs text-gray-600'}
        >
          {fmtDate(c.due_date)}
        </span>
      ),
    },
    {
      key: 'effectiveness',
      header: 'Effectiveness',
      render: (c) =>
        c.is_effective == null ? (
          <span className="text-xs text-gray-400">Not verified</span>
        ) : (
          <Badge variant={c.is_effective ? 'success' : 'danger'} dot>
            {c.is_effective ? 'Effective' : 'Ineffective'}
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'text-right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          {canUpdate && NEXT_CONTROL_STATUSES[c.status].length > 0 && (
            <Tooltip title="Advance status">
              <AntButton
                type="text"
                size="small"
                icon={<ChevronsRight size={15} />}
                onClick={() => setStatusTarget(c)}
              />
            </Tooltip>
          )}
          {canApprove && (c.status === 'IMPLEMENTED' || c.status === 'VERIFIED') && (
            <Tooltip title={c.status === 'VERIFIED' ? 'Re-verify effectiveness' : 'Verify effectiveness'}>
              <AntButton
                type="text"
                size="small"
                icon={<BadgeCheck size={15} />}
                onClick={() => setVerifyTarget(c)}
              />
            </Tooltip>
          )}
          {canUpdate && (
            <Tooltip title="Edit">
              <AntButton type="text" size="small" icon={<Pencil size={15} />} onClick={() => openEdit(c)} />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <AntButton
                type="text"
                size="small"
                danger
                icon={<Trash2 size={15} />}
                onClick={() =>
                  confirmDelete({
                    entityLabel: 'risk control',
                    name: `${c.control_number} — ${c.title}`,
                    mutate: () => deleteMut.mutateAsync(c.id),
                    invalidateKey: riskKeys.all,
                  })
                }
              />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card noPadding>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Risk controls</h3>
        </div>
        {canCreate && (
          <AntButton size="small" type="primary" icon={<Plus size={13} />} onClick={openCreate}>
            Add control
          </AntButton>
        )}
      </div>

      <DataTable
        columns={columns}
        data={controls}
        emptyMessage="No controls recorded against this risk"
        rowClassName={(c) => (c.is_overdue ? 'bg-red-50/40' : '')}
      />

      <Drawer
        title={editing ? `Edit ${editing.control_number}` : 'Add control'}
        width={480}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </AntButton>
            <AntButton
              type="primary"
              loading={createMut.isPending || updateMut.isPending}
              onClick={submit}
            >
              {editing ? 'Save changes' : 'Add control'}
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="title"
            label="Control title"
            rules={[{ required: true, message: 'A title is required' }]}
          >
            <AntInput placeholder="e.g. Line clearance checklist before changeover" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <AntInput.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <AntSelect options={CONTROL_TYPES.map((t) => ({ value: t, label: CONTROL_TYPE_LABELS[t] }))} />
          </Form.Item>
          <Form.Item
            name="hierarchy"
            label="Control hierarchy"
            extra="Elimination beats substitution beats engineering — record where this control sits."
          >
            <AntSelect
              allowClear
              placeholder="Not classified"
              options={CONTROL_HIERARCHIES.map((h) => ({
                value: h,
                label: CONTROL_HIERARCHY_LABELS[h],
              }))}
            />
          </Form.Item>
          <Form.Item name="ownerId" label="Owner">
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Unassigned"
              options={(directory?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <Form.Item name="dueDate" label="Due date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            name="documentId"
            label="Supporting document"
            extra="Link a controlled document as evidence (e.g. SOP, qualification or effectiveness report)."
          >
            <AntSelect
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="No document linked"
              options={(docs?.data ?? []).map((d) => ({
                value: d.id,
                label: `${d.doc_number} — ${d.title}`,
              }))}
            />
          </Form.Item>
        </Form>
      </Drawer>

      <VerifyControlDrawer control={verifyTarget} onClose={() => setVerifyTarget(null)} />
      <ControlStatusDrawer control={statusTarget} onClose={() => setStatusTarget(null)} />
    </Card>
  );
}

/**
 * Verification is its own component so the mutation hook is bound to a real
 * control id — a hook keyed off `target?.id ?? ''` would post to /controls/.
 */
function VerifyControlDrawer({
  control,
  onClose,
}: {
  control: RiskControl | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={control ? `Verify ${control.control_number}` : 'Verify control'}
      width={460}
      open={!!control}
      onClose={onClose}
      destroyOnClose
      footer={null}
    >
      {control && <VerifyControlForm control={control} onDone={onClose} />}
    </Drawer>
  );
}

function VerifyControlForm({ control, onDone }: { control: RiskControl; onDone: () => void }) {
  const [form] = Form.useForm<{
    isEffective: boolean;
    effectiveness: string;
    verifiedAt?: Dayjs;
    documentId?: string | null;
  }>();
  const verifyMut = useVerifyControl(control.id);
  // The verify endpoint stores only the text verdict; the evidence document is a
  // field on the control itself, so persist it separately when it changes.
  const updateMut = useUpdateControl(control.id);
  const { data: docs } = useDocuments({ page_size: 200 });

  const submit = async () => {
    const v = await form.validateFields();
    try {
      if ((v.documentId ?? null) !== (control.document_id ?? null)) {
        await updateMut.mutateAsync({ documentId: v.documentId || null });
      }
      await verifyMut.mutateAsync({
        isEffective: !!v.isEffective,
        effectiveness: v.effectiveness.trim(),
        verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
      });
      message.success('Verification recorded');
      onDone();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Recording a control as ineffective invalidates the residual assessment that relied on it.
        Describe what was checked and what it showed — this is the evidence an inspector reads.
      </p>
      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{ isEffective: true, effectiveness: '', documentId: control.document_id ?? null }}
      >
        <Form.Item name="isEffective" label="Control is effective" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item
          name="effectiveness"
          label="Effectiveness evidence"
          rules={[{ required: true, message: 'Describe the effectiveness evidence' }]}
        >
          <AntInput.TextArea rows={4} placeholder="What was checked, over what period, and the result" />
        </Form.Item>
        <Form.Item
          name="documentId"
          label="Evidence document"
          extra="Optional — link the controlled document that holds the proof (report, study, requalification)."
        >
          <AntSelect
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="No document linked"
            options={(docs?.data ?? []).map((d) => ({
              value: d.id,
              label: `${d.doc_number} — ${d.title}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="verifiedAt" label="Verified on" extra="Defaults to now.">
          <DatePicker className="w-full" />
        </Form.Item>
      </Form>
      <div className="flex justify-end gap-2">
        <AntButton onClick={onDone}>Cancel</AntButton>
        <AntButton type="primary" loading={verifyMut.isPending || updateMut.isPending} onClick={submit}>
          Record verification
        </AntButton>
      </div>
    </>
  );
}

/**
 * Advancing a control through its lifecycle (PLANNED → IN_PROGRESS →
 * IMPLEMENTED, or rework from INEFFECTIVE). Its own component so the mutation
 * hook binds to a real control id. The VERIFIED / INEFFECTIVE verdicts go
 * through VerifyControlDrawer instead, since they require effectiveness evidence.
 */
function ControlStatusDrawer({
  control,
  onClose,
}: {
  control: RiskControl | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={control ? `Advance ${control.control_number}` : 'Advance control'}
      width={460}
      open={!!control}
      onClose={onClose}
      destroyOnClose
      footer={null}
    >
      {control && <ControlStatusForm control={control} onDone={onClose} />}
    </Drawer>
  );
}

function ControlStatusForm({ control, onDone }: { control: RiskControl; onDone: () => void }) {
  const [form] = Form.useForm<{ status: ControlStatus; reason?: string }>();
  const statusMut = useUpdateControlStatus(control.id);
  const options = NEXT_CONTROL_STATUSES[control.status];

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await statusMut.mutateAsync({ status: v.status, reason: v.reason?.trim() || null });
      message.success(`Control moved to ${CONTROL_STATUS_LABELS[v.status]}`);
      onDone();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Current status is{' '}
        <span className="font-semibold text-gray-800">{CONTROL_STATUS_LABELS[control.status]}</span>. A
        control must reach <span className="font-semibold text-gray-800">Implemented</span> before its
        effectiveness can be verified.
      </p>
      <Form form={form} layout="vertical" requiredMark initialValues={{ status: options[0] }}>
        <Form.Item name="status" label="New status" rules={[{ required: true }]}>
          <AntSelect options={options.map((s) => ({ value: s, label: CONTROL_STATUS_LABELS[s] }))} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" extra="Optional — stored on the audit trail.">
          <AntInput.TextArea rows={3} placeholder="Why this transition" />
        </Form.Item>
      </Form>
      <div className="flex justify-end gap-2">
        <AntButton onClick={onDone}>Cancel</AntButton>
        <AntButton type="primary" loading={statusMut.isPending} onClick={submit}>
          Update status
        </AntButton>
      </div>
    </>
  );
}

// ── Links ───────────────────────────────────────────────────────────────────

/**
 * One linked record. Clickable when the registry gave the type a detail route;
 * plain text otherwise. A link whose target no longer exists renders as an
 * explicit warning rather than as a normal-looking row — a dangling link is a
 * break in the traceability chain and hiding it is the worst option.
 */
function LinkedRecordCell({ link }: { link: RiskLink }) {
  const text = link.label ?? link.entity_number ?? link.entity_id;

  if (link.entity_exists === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-red-600">
        <AlertTriangle size={12} className="shrink-0" />
        <span className="line-through">{text}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide">deleted</span>
      </span>
    );
  }

  if (!link.entity_route) return <span>{text}</span>;

  return (
    <RouterLink
      to={link.entity_route}
      className="group inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 hover:underline"
    >
      {text}
      <ExternalLink size={11} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
    </RouterLink>
  );
}

function LinksTab({ risk, canUpdate }: { risk: Risk; canUpdate: boolean }) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{
    entityType: string;
    entityId: string;
    label?: string;
    relation?: string;
  }>();
  // The picker searches one type at a time, so the chosen type drives the query
  // and clearing it must clear any half-typed search along with the selection.
  const [pickType, setPickType] = useState<string | undefined>('Capa');
  const [pickQuery, setPickQuery] = useState('');
  const { data: linkTypes = [] } = useLinkableTypes();
  const { data: hits = [], isFetching: searching } = useLinkableSearch(pickType, pickQuery);

  const addMut = useAddRiskLink(risk.id);
  const removeMut = useRemoveRiskLink();
  const confirmDelete = useConfirmDelete();

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await addMut.mutateAsync({
        entityType: v.entityType,
        entityId: v.entityId.trim(),
        // Left blank, the backend captures the record's own reference as the
        // label — so this stays an optional override, not a chore.
        label: v.label?.trim() || null,
        relation: v.relation || null,
      });
      message.success('Link added');
      setOpen(false);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const links = risk.links ?? [];

  return (
    <Card noPadding>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Linked QMS records</h3>
        </div>
        {canUpdate && (
          <AntButton
            size="small"
            type="primary"
            icon={<Plus size={13} />}
            onClick={() => {
              setOpen(true);
              setPickType('Capa');
              setPickQuery('');
              setTimeout(() =>
                form.setFieldsValue({
                  entityType: 'Capa',
                  entityId: undefined,
                  label: '',
                  relation: undefined,
                }),
              );
            }}
          >
            Add link
          </AntButton>
        )}
      </div>

      {links.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-gray-400">
          Nothing linked yet. Link the CAPA, deviation, finding or document this risk relates to so the
          traceability chain is complete.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Type', 'Record', 'Relation', 'Linked', ''].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5">
                    <Badge variant="info">{l.entity_type_label ?? l.entity_type}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-800">
                    <LinkedRecordCell link={l} />
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">
                    {l.relation ? humanise(l.relation) : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(l.created_at)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {canUpdate && (
                      <Tooltip title="Remove link">
                        <AntButton
                          type="text"
                          size="small"
                          danger
                          icon={<Trash2 size={14} />}
                          loading={removeMut.isPending}
                          onClick={() =>
                            confirmDelete({
                              entityLabel: 'link',
                              name: l.label ?? `${l.entity_type} ${l.entity_id}`,
                              extraWarning: 'The linked record itself is not affected.',
                              mutate: () => removeMut.mutateAsync(l.id),
                              invalidateKey: riskKeys.risk(risk.id),
                            })
                          }
                        />
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        title="Link a record"
        width={440}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={addMut.isPending} onClick={submit}>
              Add link
            </AntButton>
          </div>
        }
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="entityType" label="Record type" rules={[{ required: true }]}>
            <AntSelect
              options={linkTypes.map((t) => ({ value: t.type, label: t.label }))}
              onChange={(v: string) => {
                setPickType(v);
                setPickQuery('');
                // The previously picked record belongs to the old type.
                form.setFieldsValue({ entityId: undefined });
              }}
            />
          </Form.Item>
          <Form.Item
            name="entityId"
            label="Record"
            rules={[{ required: true, message: 'Search for and select the record to link' }]}
            extra="Search by reference number or title."
          >
            <AntSelect
              showSearch
              filterOption={false}
              placeholder={pickType ? 'Type at least 2 characters…' : 'Choose a record type first'}
              disabled={!pickType}
              notFoundContent={
                searching
                  ? 'Searching…'
                  : pickQuery.trim().length < 2
                    ? 'Type at least 2 characters'
                    : 'No matching records you have access to'
              }
              onSearch={setPickQuery}
              options={hits.map((h) => ({ value: h.id, label: h.label }))}
            />
          </Form.Item>
          <Form.Item
            name="label"
            label="Display label"
            extra="Optional — the record's own reference is used when left blank."
          >
            <AntInput placeholder="e.g. Changeover procedure revision" />
          </Form.Item>
          <Form.Item name="relation" label="Relation">
            <AntSelect
              allowClear
              placeholder="Unspecified"
              options={LINK_RELATIONS.map((r) => ({ value: r, label: humanise(r) }))}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
}

// ── Reviews ─────────────────────────────────────────────────────────────────

function ReviewsTab({ riskId, reviews }: { riskId: string; reviews: RiskReview[] }) {
  const canCreate = useHasPermission('risk_review.create');
  const canUpdate = useHasPermission('risk_review.update');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completing, setCompleting] = useState<RiskReview | null>(null);
  const [scheduleForm] = Form.useForm<{ dueAt: Dayjs; findings?: string }>();
  const createMut = useCreateReview();

  const schedule = async () => {
    const v = await scheduleForm.validateFields();
    try {
      await createMut.mutateAsync({
        risk_id: riskId,
        body: { dueAt: v.dueAt.toISOString(), findings: v.findings?.trim() || null },
      });
      message.success('Review scheduled');
      setScheduleOpen(false);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Card noPadding>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarClock size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Periodic reviews</h3>
        </div>
        {canCreate && (
          <AntButton
            size="small"
            type="primary"
            icon={<Plus size={13} />}
            onClick={() => setScheduleOpen(true)}
          >
            Schedule review
          </AntButton>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-gray-400">
          No review scheduled. The framework's review cadence normally sets one when the risk is scored.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Due', 'State', 'Outcome', 'Reviewed', 'Findings', ''].map((h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 last:border-0 ${r.is_overdue && !r.is_complete ? 'bg-red-50/40' : ''}`}
                >
                  <td className="px-5 py-2.5 text-xs text-gray-700 whitespace-nowrap">{fmtDate(r.due_at)}</td>
                  <td className="px-5 py-2.5">
                    <Badge
                      variant={r.is_complete ? 'success' : r.is_overdue ? 'danger' : 'warning'}
                      dot
                    >
                      {r.is_complete ? 'Complete' : r.is_overdue ? 'Overdue' : 'Due'}
                    </Badge>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-600">
                    {r.outcome ? REVIEW_OUTCOME_LABELS[r.outcome] : '—'}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDate(r.reviewed_at)}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-600 max-w-[300px] truncate" title={r.findings ?? ''}>
                    {r.findings ?? '—'}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {canUpdate && !r.is_complete && (
                      <AntButton size="small" onClick={() => setCompleting(r)}>
                        Complete
                      </AntButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        title="Schedule a review"
        width={420}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setScheduleOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={createMut.isPending} onClick={schedule}>
              Schedule
            </AntButton>
          </div>
        }
      >
        <Form form={scheduleForm} layout="vertical" requiredMark>
          <Form.Item name="dueAt" label="Due date" rules={[{ required: true, message: 'Pick a due date' }]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="findings" label="Scope notes">
            <AntInput.TextArea rows={3} placeholder="What this review is expected to confirm" />
          </Form.Item>
        </Form>
      </Drawer>

      <CompleteReviewDrawer review={completing} onClose={() => setCompleting(null)} />
    </Card>
  );
}

// ── Complete review (shared by the detail page and the review queue) ─────────

export function CompleteReviewDrawer({
  review,
  onClose,
}: {
  review: RiskReview | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      title={review?.risk ? `Complete review — ${review.risk.risk_number}` : 'Complete review'}
      width={460}
      open={!!review}
      onClose={onClose}
      destroyOnClose
      footer={null}
    >
      {review && <CompleteReviewForm review={review} onDone={onClose} />}
    </Drawer>
  );
}

function CompleteReviewForm({ review, onDone }: { review: RiskReview; onDone: () => void }) {
  const [form] = Form.useForm<{ outcome: ReviewOutcome; findings: string; nextReviewAt?: Dayjs }>();
  const completeMut = useCompleteReview(review.id);

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await completeMut.mutateAsync({
        outcome: v.outcome,
        findings: v.findings.trim(),
        nextReviewAt: v.nextReviewAt ? v.nextReviewAt.toISOString() : null,
      });
      message.success('Review completed');
      onDone();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
        <p className="text-xs text-gray-500">
          Due <span className="font-medium text-gray-800">{fmtDate(review.due_at)}</span>
          {review.is_overdue && <span className="ml-2 font-semibold text-red-600">Overdue</span>}
        </p>
        {review.risk && (
          <p className="text-xs text-gray-600 mt-1 truncate" title={review.risk.title}>
            {review.risk.risk_number} — {review.risk.title}
          </p>
        )}
      </div>
      <Form form={form} layout="vertical" requiredMark initialValues={{ outcome: 'NO_CHANGE' }}>
        <Form.Item name="outcome" label="Outcome" rules={[{ required: true }]}>
          <AntSelect
            options={REVIEW_OUTCOMES.map((o) => ({ value: o, label: REVIEW_OUTCOME_LABELS[o] }))}
          />
        </Form.Item>
        <Form.Item
          name="findings"
          label="Findings"
          rules={[{ required: true, message: 'Record what the review found' }]}
        >
          <AntInput.TextArea rows={5} placeholder="What was reviewed, what changed, and what follows" />
        </Form.Item>
        <Form.Item
          name="nextReviewAt"
          label="Next review"
          extra="Leave blank to let the framework's review cadence schedule the next one."
        >
          <DatePicker className="w-full" />
        </Form.Item>
      </Form>
      <div className="flex justify-end gap-2">
        <AntButton onClick={onDone}>Cancel</AntButton>
        <AntButton type="primary" loading={completeMut.isPending} onClick={submit}>
          Record outcome
        </AntButton>
      </div>
    </>
  );
}

// ── Acceptance ──────────────────────────────────────────────────────────────

/**
 * ISO 14971 §8 acceptance. Two gates the server enforces and this UI mirrors
 * without duplicating the judgement: a residual score must exist, and an
 * UNACCEPTABLE residual level demands a benefit–risk rationale. If the server
 * still refuses, its sentence is shown verbatim rather than being flattened.
 */
function AcceptRiskAction({ risk }: { risk: Risk }) {
  const [open, setOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [justification, setJustification] = useState('');
  const [benefitRisk, setBenefitRisk] = useState('');
  const [error, setError] = useState<string | null>(null);
  const acceptMut = useAcceptRisk(risk.id);

  const unacceptable = risk.residual_level?.acceptance === 'UNACCEPTABLE';
  const noResidual = risk.residual_score == null;
  const blocked =
    !justification.trim() || noResidual || (unacceptable && !benefitRisk.trim());

  const sign = async (credential: string, meaning: string, comment: string) => {
    setError(null);
    try {
      await acceptMut.mutateAsync({
        justification: justification.trim(),
        benefitRiskRationale: benefitRisk.trim() || null,
        credential,
        meaning: comment.trim() ? `${meaning} — ${comment.trim()}` : meaning,
      });
      message.success('Residual risk accepted and signed');
      setSignOpen(false);
      setOpen(false);
      setJustification('');
      setBenefitRisk('');
    } catch (err) {
      const text = extractErr(err);
      setError(text);
      message.error(text);
      setSignOpen(false);
    }
  };

  return (
    <>
      <AntButton type="primary" icon={<ShieldCheck size={14} />} onClick={() => setOpen(true)}>
        Accept risk
      </AntButton>

      <Drawer
        title="Accept residual risk"
        width={480}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" disabled={blocked} onClick={() => setSignOpen(true)}>
              Sign &amp; accept
            </AntButton>
          </div>
        }
      >
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-1.5">Residual position</p>
          <RiskLevelBadge level={risk.residual_level} score={risk.residual_score} />
          {noResidual && (
            <p className="text-xs text-red-600 mt-2">
              This risk has no residual score. Score the residual stage before accepting — the server
              rejects acceptance without one.
            </p>
          )}
          {unacceptable && (
            <p className="text-xs text-amber-700 mt-2">
              The residual level is unacceptable. A benefit–risk rationale is mandatory (ISO 14971 §8).
            </p>
          )}
        </div>

        <label className="label label-required">Justification</label>
        <AntInput.TextArea
          rows={4}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Why this residual risk is tolerable, and on what evidence"
        />

        <label className={`label mt-4 block ${unacceptable ? 'label-required' : ''}`}>
          Benefit–risk rationale
        </label>
        <AntInput.TextArea
          rows={3}
          value={benefitRisk}
          onChange={(e) => setBenefitRisk(e.target.value)}
          placeholder="How the clinical or business benefit outweighs the residual risk"
        />

        {error && (
          <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <TriangleAlert size={14} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}
      </Drawer>

      <ESignatureModal
        isOpen={signOpen}
        onClose={() => setSignOpen(false)}
        onSign={sign}
        entityType="Risk"
        entityId={risk.risk_number}
        isLoading={acceptMut.isPending}
      />
    </>
  );
}

// ── Audit trail ─────────────────────────────────────────────────────────────

function TrailTab({ entries, isLoading }: { entries: TrailEntry[]; isLoading: boolean }) {
  return (
    <Card noPadding>
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
        <FileText size={15} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Audit trail</h3>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-gray-400">No trail entries recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['When', 'Action', 'Field', 'From', 'To', 'By', 'Reason'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {fmtDateTime(e.created_at)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="default">{humanise(e.action)}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">{e.field ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-[180px] truncate" title={e.old_value ?? ''}>
                    {e.old_value ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-800 max-w-[180px] truncate" title={e.new_value ?? ''}>
                    {e.new_value ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{e.user_name ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-[200px] truncate" title={e.reason ?? ''}>
                    {e.reason ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
