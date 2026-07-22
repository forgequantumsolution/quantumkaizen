/**
 * The assessment workspace — and the worksheet grid that is the point of it.
 *
 * Three rules shape this screen:
 *
 *  1. The COLUMNS ARE THE METHODOLOGY. An FMEA worksheet is Item/Function →
 *     Failure Mode → Effect → S → Cause → O → Controls → D → RPN; a matrix
 *     worksheet is Hazard → Cause → Consequence → S → L → Score → Level. The
 *     same table component renders both because the column set is derived, not
 *     hard-coded per screen.
 *  2. The CLIENT NEVER OWNS A SCORE. Every S/O/D/L select posts a *rank* drawn
 *     from the framework's anchored levels; the RPN, the level band and the
 *     action priority all come back from the server. The grid does show a live
 *     arithmetic preview while you type — but it is drawn as a dashed "preview"
 *     chip until the server has confirmed it.
 *  3. AN APPROVED ASSESSMENT IS FROZEN. The API answers 409 to any edit of an
 *     approved worksheet, so rather than let the user discover that, the whole
 *     grid goes read-only and the screen points at Revise, which forks a new
 *     version.
 *
 * The scales come from the framework the assessment was scored against: the
 * immutable `framework_snapshot` once approved, the live framework before that.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button as AntButton,
  DatePicker,
  Drawer,
  Input as AntInput,
  Popconfirm,
  Select as AntSelect,
  Switch,
  Tooltip,
  message,
} from 'antd';
import dayjs from 'dayjs';
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  ShieldCheck,
  XCircle,
  GitBranch,
  Lock,
  AlertTriangle,
  ArrowUpRight,
  Grid3x3,
  SendHorizonal,
  Users,
} from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import ESignatureModal from '@/components/shared/ESignatureModal';
import { useHasPermission } from '@/stores/authStore';
import { useUserDirectory } from '@/features/admin/users/hooks';
import DownloadRiskReportButton from './report/DownloadRiskReportButton';
import {
  useApproveAssessment,
  usePromoteLine,
  useRejectAssessment,
  useReviseAssessment,
  useRiskAssessment,
  useRiskFramework,
  useRiskRegisters,
  useSaveAssessmentLines,
  useUpdateAssessmentStatus,
  ASSESSMENT_STATUS_LABELS,
  METHODOLOGY_LABELS,
  FORMULA_LABELS,
  type FactorValues,
  type RiskAssessmentLine,
  type RiskFactor,
  type RiskFramework,
  type RiskLevelDef,
  type RiskMethodology,
} from '@/lib/api/risk';
import { AssessmentStatusBadge, RiskLevelBadge } from './riskStatusBadge';

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const extractErr = (err: unknown): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? 'Operation failed';

const errStatus = (err: unknown): number | undefined =>
  (err as { response?: { status?: number } })?.response?.status;

const LOCKED_MESSAGE =
  'This assessment is approved and locked. Create a revision to change the worksheet.';

/** Statuses whose worksheet the server still accepts writes for. */
const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'IN_ASSESSMENT',
  'PENDING_REVIEW',
  'PENDING_APPROVAL',
  'REJECTED',
  'PERIODIC_REVIEW',
]);

const FMEA_METHODOLOGIES = new Set<RiskMethodology>(['FMEA', 'FMECA']);

/** Short column head for a factor — S/O/D/P/E is the language of the worksheet. */
const factorAbbr = (f: RiskFactor): string => {
  switch (f.kind) {
    case 'SEVERITY':
      return 'S';
    case 'OCCURRENCE':
      return 'O';
    case 'PROBABILITY':
      return 'L';
    case 'DETECTABILITY':
      return 'D';
    case 'EXPOSURE':
      return 'E';
    default:
      return (f.key || f.label || '?').slice(0, 2).toUpperCase();
  }
};

// ── Draft rows ──────────────────────────────────────────────────────────────

interface DraftRow {
  /** Stable local identity — survives an unsaved row having no server id. */
  key: string;
  id: string | null;
  lineNumber: number;
  itemFunction: string;
  failureMode: string;
  effect: string;
  cause: string;
  currentControls: string;
  hazard: string;
  consequence: string;
  factors: FactorValues;
  recommendedAction: string;
  ownerId: string | null;
  dueDate: string | null;
  isCritical: boolean;
  notes: string;
  // Server-owned, display only.
  serverScore: number | null;
  serverLevel: RiskAssessmentLine['initial_level'];
  serverActionPriority: string | null;
  riskId: string | null;
  risk: RiskAssessmentLine['risk'];
}

const toDraft = (l: RiskAssessmentLine): DraftRow => ({
  key: l.id,
  id: l.id,
  lineNumber: l.line_number,
  itemFunction: l.item_function ?? '',
  failureMode: l.failure_mode ?? '',
  effect: l.effect ?? '',
  cause: l.cause ?? '',
  currentControls: l.current_controls ?? '',
  hazard: l.hazard ?? '',
  consequence: l.consequence ?? '',
  factors: { ...(l.initial_factors ?? {}) },
  recommendedAction: l.recommended_action ?? '',
  ownerId: l.owner_id,
  dueDate: l.due_date,
  isCritical: l.is_critical,
  notes: l.notes ?? '',
  serverScore: l.initial_score,
  serverLevel: l.initial_level,
  serverActionPriority: l.action_priority,
  riskId: l.risk_id,
  risk: l.risk,
});

const signature = (lines: RiskAssessmentLine[]) =>
  lines.map((l) => `${l.id}:${l.updated_at}`).join('|');

// ── Client-side preview arithmetic ──────────────────────────────────────────
//
// Never persisted, never sent. It exists so a grid of twenty rows does not feel
// dead between keystroke and round-trip, and it is always rendered as a preview.

function previewScore(framework: RiskFramework | null, factors: FactorValues): number | null {
  if (!framework) return null;
  const used = framework.factors.filter((f) => typeof factors[f.key] === 'number');
  if (used.length === 0 || used.length !== framework.factors.length) return null;

  switch (framework.formula) {
    case 'PRODUCT':
      return used.reduce((acc, f) => acc * factors[f.key], 1);
    case 'SUM':
      return used.reduce((acc, f) => acc + factors[f.key], 0);
    case 'WEIGHTED_PRODUCT':
      return Math.round(used.reduce((acc, f) => acc * factors[f.key] * (f.weight || 1), 1));
    case 'MATRIX_LOOKUP': {
      const cell = matrixCell(framework, factors);
      return cell?.score ?? null;
    }
    // AIAG-VDA action priority is a lookup table the server owns; no preview.
    default:
      return null;
  }
}

function matrixCell(framework: RiskFramework, factors: FactorValues) {
  return (
    framework.matrix_cells.find(
      (c) =>
        factors[c.row_factor_key] === c.row_rank && factors[c.col_factor_key] === c.col_rank,
    ) ?? null
  );
}

function previewLevel(
  framework: RiskFramework | null,
  factors: FactorValues,
  score: number | null,
): RiskLevelDef | null {
  if (!framework) return null;
  if (framework.formula === 'MATRIX_LOOKUP') {
    const cell = matrixCell(framework, factors);
    if (cell?.level_id) return framework.levels.find((l) => l.id === cell.level_id) ?? null;
  }
  if (score == null) return null;
  return (
    framework.levels.find(
      (l) =>
        (l.min_score == null || score >= l.min_score) &&
        (l.max_score == null || score <= l.max_score),
    ) ?? null
  );
}

// ── Column model ────────────────────────────────────────────────────────────

type TextField =
  | 'itemFunction'
  | 'failureMode'
  | 'effect'
  | 'cause'
  | 'currentControls'
  | 'hazard'
  | 'consequence'
  | 'recommendedAction';

type GridColumn =
  | { kind: 'text'; field: TextField; header: string; width: number; placeholder: string }
  | { kind: 'factor'; factor: RiskFactor; header: string }
  | { kind: 'score'; header: string }
  | { kind: 'level'; header: string }
  | { kind: 'priority'; header: string }
  | { kind: 'owner'; header: string }
  | { kind: 'due'; header: string }
  | { kind: 'critical'; header: string };

function buildColumns(methodology: RiskMethodology, framework: RiskFramework | null): GridColumn[] {
  const factors = framework ? [...framework.factors].sort((a, b) => a.order - b.order) : [];
  const byKind = (kind: RiskFactor['kind']) => factors.find((f) => f.kind === kind) ?? null;
  const placed = new Set<string>();
  const take = (...kinds: RiskFactor['kind'][]): GridColumn[] => {
    for (const k of kinds) {
      const f = byKind(k);
      if (f && !placed.has(f.id)) {
        placed.add(f.id);
        return [{ kind: 'factor', factor: f, header: factorAbbr(f) }];
      }
    }
    return [];
  };
  const rest = (): GridColumn[] =>
    factors
      .filter((f) => !placed.has(f.id))
      .map((f) => {
        placed.add(f.id);
        return { kind: 'factor', factor: f, header: factorAbbr(f) } as GridColumn;
      });

  if (FMEA_METHODOLOGIES.has(methodology)) {
    return [
      { kind: 'text', field: 'itemFunction', header: 'Item & Function', width: 200, placeholder: 'Item / process step and its function' },
      { kind: 'text', field: 'failureMode', header: 'Failure Mode', width: 190, placeholder: 'How it can fail' },
      { kind: 'text', field: 'effect', header: 'Effect', width: 190, placeholder: 'Effect of the failure' },
      ...take('SEVERITY'),
      { kind: 'text', field: 'cause', header: 'Cause', width: 190, placeholder: 'Mechanism / root cause' },
      ...take('OCCURRENCE', 'PROBABILITY'),
      { kind: 'text', field: 'currentControls', header: 'Current Controls', width: 190, placeholder: 'Prevention & detection in place' },
      ...take('DETECTABILITY'),
      ...rest(),
      { kind: 'score', header: 'RPN' },
      { kind: 'priority', header: 'Action Priority' },
      { kind: 'text', field: 'recommendedAction', header: 'Recommended Action', width: 210, placeholder: 'What will be done' },
      { kind: 'owner', header: 'Owner' },
      { kind: 'due', header: 'Due' },
      { kind: 'critical', header: 'Crit.' },
    ];
  }

  return [
    { kind: 'text', field: 'hazard', header: 'Hazard', width: 200, placeholder: 'Source of potential harm' },
    { kind: 'text', field: 'cause', header: 'Cause', width: 190, placeholder: 'How it is triggered' },
    { kind: 'text', field: 'consequence', header: 'Consequence', width: 200, placeholder: 'Harm if it occurs' },
    ...take('SEVERITY'),
    ...take('PROBABILITY', 'OCCURRENCE'),
    ...rest(),
    { kind: 'score', header: 'Score' },
    { kind: 'level', header: 'Level' },
    { kind: 'text', field: 'recommendedAction', header: 'Recommended Action', width: 210, placeholder: 'Control or mitigation' },
    { kind: 'owner', header: 'Owner' },
    { kind: 'due', header: 'Due' },
    { kind: 'critical', header: 'Crit.' },
  ];
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function RiskAssessmentDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();

  const canUpdate = useHasPermission('risk_assessment.update');
  const canApprove = useHasPermission('risk_assessment.approve');
  const canCreateRisk = useHasPermission('risk.create');

  const { data: assessment, isLoading } = useRiskAssessment(id);
  const { data: liveFramework } = useRiskFramework(assessment?.framework_id);
  const { data: registerPage } = useRiskRegisters({ isActive: true, page: 1, pageSize: 200 });
  const { data: directory } = useUserDirectory();

  const saveMut = useSaveAssessmentLines(id);
  const approveMut = useApproveAssessment(id);
  const rejectMut = useRejectAssessment(id);
  const reviseMut = useReviseAssessment(id);
  const statusMut = useUpdateAssessmentStatus(id);

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [approveOpen, setApproveOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [conclusion, setConclusion] = useState('');
  const [nextReviewAt, setNextReviewAt] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseReason, setReviseReason] = useState('');
  const newRowSeq = useRef(0);
  const syncedRef = useRef<string>('');

  const users = useMemo(() => directory?.items ?? [], [directory]);
  const registers = useMemo(() => registerPage?.data ?? [], [registerPage]);
  const userName = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.id, u.name);
    return map;
  }, [users]);

  const isApproved = assessment?.status === 'APPROVED';
  // An approved assessment carries an immutable copy of the scales it was judged
  // against — read those, never today's framework, or the archive lies.
  const framework: RiskFramework | null = useMemo(() => {
    if (!assessment) return null;
    if (isApproved) return assessment.framework_snapshot ?? liveFramework ?? null;
    return liveFramework ?? assessment.framework_snapshot ?? null;
  }, [assessment, isApproved, liveFramework]);

  const methodology: RiskMethodology =
    assessment?.methodology ?? framework?.methodology ?? 'MATRIX';
  const columns = useMemo(() => buildColumns(methodology, framework), [methodology, framework]);

  const readOnly =
    !assessment ||
    !canUpdate ||
    assessment.is_locked ||
    !EDITABLE_STATUSES.has(assessment.status);

  const serverLines = assessment?.lines;

  useEffect(() => {
    if (!serverLines) return;
    const sig = signature(serverLines);
    if (sig === syncedRef.current) return;
    if (dirty) return; // never clobber unsaved edits with a background refetch
    syncedRef.current = sig;
    setRows(serverLines.map(toDraft));
  }, [serverLines, dirty]);

  // Browser-level guard; the in-page banner covers in-app navigation.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const patchRow = useCallback((key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const addRow = () => {
    newRowSeq.current += 1;
    const key = `new-${newRowSeq.current}`;
    setRows((prev) => [
      ...prev,
      {
        key,
        id: null,
        lineNumber: prev.reduce((max, r) => Math.max(max, r.lineNumber), 0) + 1,
        itemFunction: '',
        failureMode: '',
        effect: '',
        cause: '',
        currentControls: '',
        hazard: '',
        consequence: '',
        factors: {},
        recommendedAction: '',
        ownerId: null,
        dueDate: null,
        isCritical: false,
        notes: '',
        serverScore: null,
        serverLevel: null,
        serverActionPriority: null,
        riskId: null,
        risk: null,
      },
    ]);
    setDirty(true);
    setDirtyKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setDirty(true);
  };

  const discard = () => {
    if (!serverLines) return;
    syncedRef.current = signature(serverLines);
    setRows(serverLines.map(toDraft));
    setDirty(false);
    setDirtyKeys(new Set());
  };

  const saveAll = async () => {
    try {
      const saved = await saveMut.mutateAsync({
        replace: true,
        lines: rows.map((r, idx) => ({
          id: r.id,
          lineNumber: idx + 1,
          itemFunction: r.itemFunction.trim() || null,
          failureMode: r.failureMode.trim() || null,
          effect: r.effect.trim() || null,
          cause: r.cause.trim() || null,
          currentControls: r.currentControls.trim() || null,
          hazard: r.hazard.trim() || null,
          consequence: r.consequence.trim() || null,
          // Ranks only. The score, level and action priority come back computed.
          initialFactors: Object.keys(r.factors).length > 0 ? r.factors : null,
          recommendedAction: r.recommendedAction.trim() || null,
          ownerId: r.ownerId || null,
          dueDate: r.dueDate || null,
          isCritical: r.isCritical,
          notes: r.notes.trim() || null,
        })),
      });
      syncedRef.current = signature(saved);
      setRows(saved.map(toDraft));
      setDirty(false);
      setDirtyKeys(new Set());
      message.success(`Worksheet saved — ${saved.length} line${saved.length === 1 ? '' : 's'}`);
    } catch (err) {
      message.error(errStatus(err) === 409 ? LOCKED_MESSAGE : extractErr(err));
    }
  };

  const submitForApproval = async () => {
    try {
      await statusMut.mutateAsync({ status: 'PENDING_APPROVAL' });
      message.success('Sent for approval');
    } catch (err) {
      message.error(errStatus(err) === 409 ? LOCKED_MESSAGE : extractErr(err));
    }
  };

  const approve = async (password: string, meaning: string, comment: string) => {
    try {
      await approveMut.mutateAsync({
        password,
        meaning,
        reason: comment || null,
        conclusion: conclusion.trim() || null,
        nextReviewAt,
      });
      setSignOpen(false);
      setApproveOpen(false);
      message.success('Assessment approved and locked');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const reject = async () => {
    try {
      await rejectMut.mutateAsync({ reason: rejectReason.trim() });
      setRejectOpen(false);
      setRejectReason('');
      message.success('Assessment rejected');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const revise = async () => {
    try {
      const next = await reviseMut.mutateAsync({ reason: reviseReason.trim() || null });
      setReviseOpen(false);
      setReviseReason('');
      message.success(`Revision v${next.version} created`);
      if (next.id) nav(`/risk/assessments/${next.id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (!assessment) {
    return (
      <Card className="text-center py-16">
        <p className="text-sm text-gray-500">This assessment no longer exists.</p>
        <AntButton className="mt-4" onClick={() => nav('/risk/assessments')}>
          Back to assessments
        </AntButton>
      </Card>
    );
  }

  const team = assessment.team_members ?? [];
  const promotedCount = rows.filter((r) => r.riskId).length;
  const criticalCount = rows.filter((r) => r.isCritical).length;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <Card noPadding>
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={() => nav('/risk/assessments')}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft size={14} /> Assessments
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-blue-700">
                  {assessment.assessment_number}
                </span>
                <AssessmentStatusBadge status={assessment.status} />
                <Badge variant="outline">v{assessment.version}</Badge>
                <Badge variant="info">
                  {METHODOLOGY_LABELS[assessment.methodology] ?? assessment.methodology}
                </Badge>
                {assessment.is_locked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border bg-slate-100 text-slate-700 border-slate-200">
                    <Lock size={11} /> Locked
                  </span>
                )}
                {assessment.is_review_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border bg-red-50 text-red-700 border-red-200">
                    <AlertTriangle size={11} /> Review overdue
                  </span>
                )}
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mt-1">{assessment.title}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {assessment.register?.name ?? 'No register'}
                {framework
                  ? ` · ${framework.name} (v${framework.version}) · ${
                      FORMULA_LABELS[framework.formula] ?? framework.formula
                    }`
                  : ' · no framework resolved'}
                {isApproved && assessment.has_framework_snapshot ? ' · snapshot' : ''}
              </p>
              <div className="flex items-center gap-3 mt-2.5 flex-wrap text-xs text-gray-600">
                <span>
                  <span className="text-gray-400">Lead:</span>{' '}
                  {assessment.lead_id ? (userName.get(assessment.lead_id) ?? '—') : '—'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={12} className="text-gray-400" />
                  {team.length > 0 ? team.map((m) => m.name).join(', ') : 'No team recorded'}
                </span>
                <span>
                  <span className="text-gray-400">Next review:</span>{' '}
                  {fmtDate(assessment.next_review_at)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <DownloadRiskReportButton
                kind="assessment"
                id={assessment.id}
                number={assessment.assessment_number}
              />
              {!readOnly && assessment.status !== 'PENDING_APPROVAL' && (
                <AntButton
                  icon={<SendHorizonal size={14} />}
                  loading={statusMut.isPending}
                  onClick={submitForApproval}
                >
                  Send for approval
                </AntButton>
              )}
              {canApprove && !isApproved && assessment.status !== 'SUPERSEDED' && (
                <>
                  <AntButton
                    type="primary"
                    icon={<ShieldCheck size={14} />}
                    onClick={() => {
                      setConclusion(assessment.conclusion ?? '');
                      setNextReviewAt(assessment.next_review_at);
                      setApproveOpen(true);
                    }}
                  >
                    Approve
                  </AntButton>
                  <AntButton danger icon={<XCircle size={14} />} onClick={() => setRejectOpen(true)}>
                    Reject
                  </AntButton>
                </>
              )}
              {canUpdate && isApproved && (
                <AntButton
                  type="primary"
                  icon={<GitBranch size={14} />}
                  onClick={() => setReviseOpen(true)}
                >
                  Revise
                </AntButton>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Governance banners */}
      {isApproved && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-200 bg-emerald-50">
          <Lock size={15} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-xs text-emerald-800">
            <p className="font-semibold">Approved on {fmtDate(assessment.approved_at)} — read only</p>
            <p className="mt-0.5">
              {LOCKED_MESSAGE} The worksheet below is scored against the framework snapshot taken at
              approval, so it will not move if the framework is later re-configured.
            </p>
          </div>
        </div>
      )}
      {assessment.status === 'REJECTED' && assessment.rejection_reason && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-red-200 bg-red-50">
          <XCircle size={15} className="text-red-600 mt-0.5 shrink-0" />
          <div className="text-xs text-red-800">
            <p className="font-semibold">Rejected</p>
            <p className="mt-0.5">{assessment.rejection_reason}</p>
          </div>
        </div>
      )}
      {assessment.status === 'SUPERSEDED' && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
          <GitBranch size={15} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700">
            Superseded by a later revision. This version is retained as the record of what was
            assessed at the time.
          </p>
        </div>
      )}

      {/* Objective / scope */}
      {(assessment.objective || assessment.scope_text || assessment.conclusion) && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Objective" value={assessment.objective} />
            <Field label="Scope" value={assessment.scope_text} />
            <Field label="Conclusion" value={assessment.conclusion} />
          </div>
        </Card>
      )}

      {/* ── The worksheet ─────────────────────────────────────────────── */}
      <Card noPadding>
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Grid3x3 size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              {FMEA_METHODOLOGIES.has(methodology) ? 'FMEA worksheet' : 'Risk matrix worksheet'}
            </h3>
            <span className="text-xs text-gray-400">
              {rows.length} line{rows.length === 1 ? '' : 's'}
              {criticalCount > 0 ? ` · ${criticalCount} critical` : ''}
              {promotedCount > 0 ? ` · ${promotedCount} promoted` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertTriangle size={12} />
                Unsaved changes — scores stay provisional until saved
              </span>
            )}
            {!readOnly && (
              <>
                {dirty && (
                  <AntButton size="small" onClick={discard} disabled={saveMut.isPending}>
                    Discard
                  </AntButton>
                )}
                <AntButton size="small" icon={<Plus size={13} />} onClick={addRow}>
                  Add row
                </AntButton>
                <AntButton
                  size="small"
                  type="primary"
                  icon={<Save size={13} />}
                  disabled={!dirty}
                  loading={saveMut.isPending}
                  onClick={saveAll}
                >
                  Save all
                </AntButton>
              </>
            )}
          </div>
        </div>

        {!framework && (
          <div className="px-5 py-3 border-b border-amber-100 bg-amber-50 text-xs text-amber-800">
            No scoring framework resolves for this assessment, so the factor scales are unavailable.
            Set a framework on the assessment before scoring.
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={Grid3x3}
            title="The worksheet is empty"
            description={
              readOnly
                ? 'No lines were recorded on this assessment.'
                : 'Add the first line to start recording failure modes or hazards. Nothing is scored until you save — the server computes every score.'
            }
            actionLabel={readOnly ? undefined : 'Add first line'}
            onAction={readOnly ? undefined : addRow}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="text-left border-collapse" style={{ minWidth: '100%' }}>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 w-10">
                    #
                  </th>
                  {columns.map((c, i) => (
                    <th
                      key={`${c.kind}-${i}`}
                      className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap"
                    >
                      {c.kind === 'factor' ? (
                        <Tooltip title={`${c.factor.label} (${c.factor.key})`}>
                          <span className="cursor-help underline decoration-dotted">
                            {c.header}
                          </span>
                        </Tooltip>
                      ) : (
                        c.header
                      )}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Risk
                  </th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <WorksheetRow
                    key={row.key}
                    row={row}
                    index={idx}
                    columns={columns}
                    framework={framework}
                    readOnly={readOnly}
                    isRowDirty={dirtyKeys.has(row.key)}
                    users={users}
                    userName={userName}
                    registers={registers}
                    defaultRegisterId={assessment.register?.id ?? null}
                    canPromote={canCreateRisk && !readOnly}
                    onPatch={patchRow}
                    onRemove={removeRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-gray-500">
              Scores, levels and action priorities are computed and stored by the server from the
              ranks recorded here. Dashed chips are unsaved client previews.
            </p>
            {!readOnly && (
              <AntButton
                type="primary"
                icon={<Save size={14} />}
                disabled={!dirty}
                loading={saveMut.isPending}
                onClick={saveAll}
              >
                Save all
              </AntButton>
            )}
          </div>
        )}
      </Card>

      {/* Version history */}
      {assessment.versions && assessment.versions.length > 1 && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Versions</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {assessment.versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => nav(`/risk/assessments/${v.id}`)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  v.id === assessment.id
                    ? 'border-gold-300 bg-gold-50 text-gold-800'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span className="font-mono">{v.assessment_number}</span>
                <span className="tabular-nums font-semibold">v{v.version}</span>
                <span className="text-gray-400">
                  {ASSESSMENT_STATUS_LABELS[v.status] ?? v.status}
                </span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Approve */}
      <Drawer
        title="Approve assessment"
        width={520}
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setApproveOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" onClick={() => setSignOpen(true)}>
              Sign &amp; approve
            </AntButton>
          </div>
        }
      >
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Approving freezes this version: the framework is snapshotted and the worksheet becomes
          read-only. Further change requires a revision.
        </div>
        {dirty && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            The worksheet has unsaved changes. Save them before approving — they will not be part of
            the approved record otherwise.
          </div>
        )}
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
          Conclusion
        </label>
        <AntInput.TextArea
          rows={4}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          placeholder="The overall judgement this assessment reaches"
        />
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1 mt-4">
          Next review
        </label>
        <DatePicker
          className="w-full"
          value={nextReviewAt ? dayjs(nextReviewAt) : null}
          onChange={(d) => setNextReviewAt(d ? d.toISOString() : null)}
        />
      </Drawer>

      <ESignatureModal
        isOpen={signOpen}
        onClose={() => setSignOpen(false)}
        onSign={approve}
        entityType="RiskAssessment"
        entityId={assessment.assessment_number}
        isLoading={approveMut.isPending}
      />

      {/* Reject */}
      <Drawer
        title="Reject assessment"
        width={480}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setRejectOpen(false)}>Cancel</AntButton>
            <AntButton
              danger
              type="primary"
              disabled={!rejectReason.trim()}
              loading={rejectMut.isPending}
              onClick={reject}
            >
              Reject
            </AntButton>
          </div>
        }
      >
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
          Reason
        </label>
        <AntInput.TextArea
          rows={5}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="What has to change before this assessment can be approved"
        />
      </Drawer>

      {/* Revise */}
      <Drawer
        title={`Revise to v${assessment.version + 1}`}
        width={480}
        open={reviseOpen}
        onClose={() => setReviseOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setReviseOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={reviseMut.isPending} onClick={revise}>
              Create revision
            </AntButton>
          </div>
        }
      >
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
          A revision copies this worksheet into a new editable version and supersedes{' '}
          <span className="font-mono">{assessment.assessment_number}</span> v{assessment.version}.
          The approved version is retained unchanged.
        </div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
          Reason for revision
        </label>
        <AntInput.TextArea
          rows={4}
          value={reviseReason}
          onChange={(e) => setReviseReason(e.target.value)}
          placeholder="e.g. New failure mode identified during change control CC-2041"
        />
      </Drawer>
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
}

interface RowProps {
  row: DraftRow;
  index: number;
  columns: GridColumn[];
  framework: RiskFramework | null;
  readOnly: boolean;
  isRowDirty: boolean;
  users: { id: string; name: string }[];
  userName: Map<string, string>;
  registers: { id: string; register_number: string; name: string }[];
  defaultRegisterId: string | null;
  canPromote: boolean;
  onPatch: (key: string, patch: Partial<DraftRow>) => void;
  onRemove: (key: string) => void;
}

function WorksheetRow({
  row,
  index,
  columns,
  framework,
  readOnly,
  isRowDirty,
  users,
  userName,
  registers,
  defaultRegisterId,
  canPromote,
  onPatch,
  onRemove,
}: RowProps) {
  // The preview is only interesting while the row is out of step with the
  // server; once saved the authoritative number is the one to show.
  const preview = useMemo(
    () => (isRowDirty ? previewScore(framework, row.factors) : null),
    [isRowDirty, framework, row.factors],
  );
  const previewBand = useMemo(
    () => (isRowDirty ? previewLevel(framework, row.factors, preview) : null),
    [isRowDirty, framework, row.factors, preview],
  );

  const cellCls = 'px-2 py-1.5 align-top border-b border-gray-100';

  const renderCell = (col: GridColumn) => {
    switch (col.kind) {
      case 'text': {
        const value = row[col.field];
        if (readOnly) {
          return (
            <p className="text-xs text-gray-800 whitespace-pre-wrap" style={{ minWidth: col.width }}>
              {value || '—'}
            </p>
          );
        }
        return (
          <AntInput.TextArea
            autoSize={{ minRows: 2, maxRows: 6 }}
            size="small"
            style={{ width: col.width, fontSize: 12 }}
            value={value}
            placeholder={col.placeholder}
            onChange={(e) => onPatch(row.key, { [col.field]: e.target.value } as Partial<DraftRow>)}
          />
        );
      }
      case 'factor': {
        const f = col.factor;
        const rank = row.factors[f.key];
        const level = f.levels.find((l) => l.rank === rank);
        if (readOnly) {
          return (
            <Tooltip title={level ? `${level.label}${level.definition ? ` — ${level.definition}` : ''}` : undefined}>
              <span className="text-xs font-semibold tabular-nums text-gray-800">
                {rank ?? '—'}
              </span>
            </Tooltip>
          );
        }
        return (
          <AntSelect
            size="small"
            style={{ width: 74 }}
            popupMatchSelectWidth={320}
            placeholder="—"
            value={rank ?? undefined}
            onChange={(v: number) =>
              onPatch(row.key, { factors: { ...row.factors, [f.key]: v } })
            }
            options={[...f.levels]
              .sort((a, b) => a.rank - b.rank)
              .map((l) => ({
                value: l.rank,
                label: (
                  <span>
                    <span className="font-semibold tabular-nums">{l.rank}</span>{' '}
                    <span className="text-gray-500">{l.label}</span>
                  </span>
                ),
              }))}
          />
        );
      }
      case 'score': {
        if (isRowDirty) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] rounded border border-dashed border-amber-300 bg-amber-50 text-amber-800 whitespace-nowrap">
              {preview != null ? (
                <>
                  <span className="font-semibold tabular-nums mr-1">{preview}</span> preview
                </>
              ) : (
                'preview pending'
              )}
            </span>
          );
        }
        return (
          <span className="text-sm font-semibold tabular-nums text-gray-900">
            {row.serverScore ?? '—'}
          </span>
        );
      }
      case 'level': {
        if (isRowDirty) {
          return previewBand ? (
            <span
              className="inline-flex items-center px-2 py-0.5 text-[11px] rounded border border-dashed whitespace-nowrap"
              style={{
                backgroundColor: `${previewBand.color}14`,
                color: previewBand.color,
                borderColor: `${previewBand.color}66`,
              }}
            >
              {previewBand.label} (preview)
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">preview pending</span>
          );
        }
        return <RiskLevelBadge level={row.serverLevel} />;
      }
      case 'priority': {
        if (isRowDirty) {
          return <span className="text-[11px] text-gray-400 whitespace-nowrap">on save</span>;
        }
        return row.serverActionPriority ? (
          <Badge
            variant={
              row.serverActionPriority.toUpperCase().startsWith('H')
                ? 'danger'
                : row.serverActionPriority.toUpperCase().startsWith('M')
                  ? 'warning'
                  : 'success'
            }
          >
            {row.serverActionPriority}
          </Badge>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        );
      }
      case 'owner': {
        if (readOnly) {
          return (
            <span className="text-xs text-gray-700 whitespace-nowrap">
              {row.ownerId ? (userName.get(row.ownerId) ?? '—') : '—'}
            </span>
          );
        }
        return (
          <AntSelect
            size="small"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 140 }}
            placeholder="Unassigned"
            value={row.ownerId ?? undefined}
            onChange={(v?: string) => onPatch(row.key, { ownerId: v ?? null })}
            options={users.map((u) => ({ value: u.id, label: u.name }))}
          />
        );
      }
      case 'due': {
        if (readOnly) {
          return (
            <span className="text-xs text-gray-700 whitespace-nowrap">{fmtDate(row.dueDate)}</span>
          );
        }
        return (
          <DatePicker
            size="small"
            style={{ width: 130 }}
            value={row.dueDate ? dayjs(row.dueDate) : null}
            onChange={(d) => onPatch(row.key, { dueDate: d ? d.toISOString() : null })}
          />
        );
      }
      case 'critical': {
        if (readOnly) {
          return row.isCritical ? (
            <Badge variant="danger">Critical</Badge>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          );
        }
        return (
          <Tooltip title="Flag this line as a critical item">
            <Switch
              size="small"
              checked={row.isCritical}
              onChange={(v) => onPatch(row.key, { isCritical: v })}
            />
          </Tooltip>
        );
      }
      default:
        return null;
    }
  };

  return (
    <tr className={row.isCritical ? 'bg-red-50/30' : undefined}>
      <td className={`${cellCls} text-[11px] text-gray-400 tabular-nums`}>{index + 1}</td>
      {columns.map((c, i) => (
        <td key={`${c.kind}-${i}`} className={cellCls}>
          {renderCell(c)}
        </td>
      ))}
      <td className={cellCls}>
        <PromoteCell
          row={row}
          registers={registers}
          defaultRegisterId={defaultRegisterId}
          users={users}
          canPromote={canPromote}
        />
      </td>
      <td className={`${cellCls} text-right`}>
        {!readOnly && !row.riskId && (
          <Popconfirm
            title="Delete this line?"
            description="It is removed from the worksheet when you save."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => onRemove(row.key)}
          >
            <AntButton type="text" size="small" danger icon={<Trash2 size={14} />} />
          </Popconfirm>
        )}
      </td>
    </tr>
  );
}

/**
 * Promotion turns a worksheet line into a tracked risk in a register. It is a
 * one-way door — once a line has a risk the button is replaced by the link to
 * it, because re-promoting would fork the same hazard into two records.
 */
function PromoteCell({
  row,
  registers,
  defaultRegisterId,
  users,
  canPromote,
}: {
  row: DraftRow;
  registers: { id: string; register_number: string; name: string }[];
  defaultRegisterId: string | null;
  users: { id: string; name: string }[];
  canPromote: boolean;
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [registerId, setRegisterId] = useState<string | null>(defaultRegisterId);
  const [ownerId, setOwnerId] = useState<string | null>(row.ownerId);
  const [title, setTitle] = useState('');
  const promoteMut = usePromoteLine(row.id ?? '');

  if (row.riskId) {
    return (
      <button
        type="button"
        onClick={() => nav(`/risk/risks/${row.riskId}`)}
        className="inline-flex items-center gap-1 text-xs font-mono text-blue-700 hover:underline whitespace-nowrap"
        title={row.risk?.title ?? 'Open the tracked risk'}
      >
        {row.risk?.riskNumber ?? 'Promoted'}
        <ArrowUpRight size={12} />
      </button>
    );
  }

  if (!canPromote) return <span className="text-xs text-gray-400">—</span>;

  const suggested =
    row.failureMode?.trim() || row.hazard?.trim() || row.itemFunction?.trim() || '';

  const submit = async () => {
    try {
      const result = await promoteMut.mutateAsync({
        registerId: registerId || null,
        ownerId: ownerId || null,
        title: title.trim() || null,
      });
      setOpen(false);
      message.success(`Promoted to ${result.risk.risk_number}`);
    } catch (err) {
      message.error(errStatus(err) === 409 ? LOCKED_MESSAGE : extractErr(err));
    }
  };

  return (
    <>
      <Tooltip
        title={
          row.id
            ? 'Create a tracked risk from this line'
            : 'Save the worksheet before promoting this line'
        }
      >
        <AntButton
          size="small"
          disabled={!row.id}
          icon={<ArrowUpRight size={13} />}
          onClick={() => {
            setRegisterId(defaultRegisterId);
            setOwnerId(row.ownerId);
            setTitle(suggested);
            setOpen(true);
          }}
        >
          Promote
        </AntButton>
      </Tooltip>

      <Drawer
        title="Promote line to a tracked risk"
        width={460}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <AntButton onClick={() => setOpen(false)}>Cancel</AntButton>
            <AntButton type="primary" loading={promoteMut.isPending} onClick={submit}>
              Promote
            </AntButton>
          </div>
        }
      >
        <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
          The new risk inherits this line&apos;s factor ranks and is re-scored by the server against
          the register&apos;s framework. The line keeps a permanent link to it.
        </div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">
          Risk title
        </label>
        <AntInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Defaults to the failure mode / hazard on this line"
        />
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1 mt-4">
          Target register
        </label>
        <AntSelect
          className="w-full"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Assessment's register"
          value={registerId ?? undefined}
          onChange={(v?: string) => setRegisterId(v ?? null)}
          options={registers.map((r) => ({
            value: r.id,
            label: `${r.register_number} — ${r.name}`,
          }))}
        />
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1 mt-4">
          Risk owner
        </label>
        <AntSelect
          className="w-full"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Unassigned"
          value={ownerId ?? undefined}
          onChange={(v?: string) => setOwnerId(v ?? null)}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
        />
      </Drawer>
    </>
  );
}
