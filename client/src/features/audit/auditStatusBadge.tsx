import type {
  ActionItemPriority,
  ActionItemStatus,
  AuditStatus,
  CapaStatus,
  FindingSeverity,
  FindingStatus,
  NonConformanceStatus,
  ProgramStatus,
} from '@/lib/api/audit';

const cls =
  'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border';

const STATUS_COLORS: Record<AuditStatus, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-purple-50 text-purple-700 border-purple-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const PROGRAM_COLORS: Record<ProgramStatus, string> = {
  PLANNED: 'bg-gray-50 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const FINDING_SEV_COLORS: Record<FindingSeverity, string> = {
  OBSERVATION: 'bg-blue-50 text-blue-700 border-blue-200',
  MINOR: 'bg-amber-50 text-amber-700 border-amber-200',
  MAJOR: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

const FINDING_STATUS_COLORS: Record<FindingStatus, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
};

const NC_COLORS: Record<NonConformanceStatus, string> = {
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  CAPA_RAISED: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const CAPA_COLORS: Record<CapaStatus, string> = {
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  INVESTIGATION: 'bg-amber-50 text-amber-700 border-amber-200',
  PLAN: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  IMPLEMENTATION: 'bg-blue-50 text-blue-700 border-blue-200',
  VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200',
  CLOSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ACTION_STATUS_COLORS: Record<ActionItemStatus, string> = {
  OPEN: 'bg-gray-50 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  VERIFIED: 'bg-purple-50 text-purple-700 border-purple-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const ACTION_PRIORITY_COLORS: Record<ActionItemPriority, string> = {
  LOW: 'bg-gray-50 text-gray-600 border-gray-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

const label = (s: string) => s.replace(/_/g, ' ');

export const AuditStatusBadge = ({ status }: { status: AuditStatus }) => (
  <span className={`${cls} ${STATUS_COLORS[status]}`}>{label(status)}</span>
);
export const ProgramStatusBadge = ({ status }: { status: ProgramStatus }) => (
  <span className={`${cls} ${PROGRAM_COLORS[status]}`}>{label(status)}</span>
);
export const FindingSeverityBadge = ({ severity }: { severity: FindingSeverity }) => (
  <span className={`${cls} ${FINDING_SEV_COLORS[severity]}`}>{label(severity)}</span>
);
export const FindingStatusBadge = ({ status }: { status: FindingStatus }) => (
  <span className={`${cls} ${FINDING_STATUS_COLORS[status]}`}>{label(status)}</span>
);
export const NcStatusBadge = ({ status }: { status: NonConformanceStatus }) => (
  <span className={`${cls} ${NC_COLORS[status]}`}>{label(status)}</span>
);
export const CapaStatusBadge = ({ status }: { status: CapaStatus }) => (
  <span className={`${cls} ${CAPA_COLORS[status]}`}>{label(status)}</span>
);
export const ActionStatusBadge = ({ status }: { status: ActionItemStatus }) => (
  <span className={`${cls} ${ACTION_STATUS_COLORS[status]}`}>{label(status)}</span>
);
export const ActionPriorityBadge = ({ priority }: { priority: ActionItemPriority }) => (
  <span className={`${cls} ${ACTION_PRIORITY_COLORS[priority]}`}>{label(priority)}</span>
);
