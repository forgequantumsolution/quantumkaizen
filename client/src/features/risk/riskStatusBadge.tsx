/**
 * Risk Management status/level badges.
 *
 * Colour maps live here (not in the API client) for the same reason the audit
 * module keeps them in auditStatusBadge.tsx: they are presentation, and every
 * risk screen must render a given status identically. Props are plain strings so
 * a badge never breaks when the server adds an enum member — an unknown value
 * degrades to the neutral style instead of rendering blank.
 */

const cls = 'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border';
const NEUTRAL = 'bg-gray-50 text-gray-700 border-gray-200';

const RISK_STATUS_COLORS: Record<string, string> = {
  IDENTIFIED: 'bg-gray-50 text-gray-700 border-gray-200',
  UNDER_ASSESSMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  TREATMENT_PLANNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  TREATMENT_IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  RESIDUAL_ASSESSED: 'bg-purple-50 text-purple-700 border-purple-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MONITORED: 'bg-teal-50 text-teal-700 border-teal-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  REOPENED: 'bg-orange-50 text-orange-700 border-orange-200',
  ESCALATED: 'bg-red-50 text-red-700 border-red-200',
};

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
  IN_ASSESSMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_APPROVAL: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  PERIODIC_REVIEW: 'bg-purple-50 text-purple-700 border-purple-200',
  SUPERSEDED: 'bg-slate-100 text-slate-600 border-slate-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const CONTROL_STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-gray-50 text-gray-700 border-gray-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
  IMPLEMENTED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INEFFECTIVE: 'bg-red-50 text-red-700 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-500 border-gray-200',
};

const label = (s: string) => s.replace(/_/g, ' ');

export function RiskStatusBadge({ status }: { status: string }) {
  return <span className={`${cls} ${RISK_STATUS_COLORS[status] ?? NEUTRAL}`}>{label(status)}</span>;
}

export function AssessmentStatusBadge({ status }: { status: string }) {
  return (
    <span className={`${cls} ${ASSESSMENT_STATUS_COLORS[status] ?? NEUTRAL}`}>{label(status)}</span>
  );
}

export function ControlStatusBadge({ status }: { status: string }) {
  return (
    <span className={`${cls} ${CONTROL_STATUS_COLORS[status] ?? NEUTRAL}`}>{label(status)}</span>
  );
}

/**
 * A risk level as configured on the framework. The colour is the tenant's own
 * band colour — never a hard-coded ramp — so "HIGH" looks the same everywhere
 * it appears. Renders an explicit "Not scored" chip rather than nothing when the
 * stage has no level yet: a blank cell is indistinguishable from a bug.
 */
export function RiskLevelBadge({
  level,
  score,
  prefix,
}: {
  level?: { code: string; label: string; color: string } | null;
  score?: number | null;
  prefix?: string;
}) {
  if (!level) {
    return (
      <span className={`${cls} bg-gray-50 text-gray-400 border-gray-200 border-dashed`}>
        {prefix ? `${prefix} — ` : ''}Not scored
      </span>
    );
  }
  return (
    <span
      className={cls}
      style={{
        backgroundColor: `${level.color}18`,
        color: level.color,
        borderColor: `${level.color}55`,
      }}
      title={`${level.label}${score != null ? ` (score ${score})` : ''}`}
    >
      {prefix ? `${prefix} — ` : ''}
      {level.label}
      {score != null && <span className="ml-1 font-semibold tabular-nums">{score}</span>}
    </span>
  );
}
