/**
 * "Risk assessments for this record" — the panel that closes the change-control
 * loop.
 *
 * A change ticket whose approval stage carries a risk criterion cannot advance
 * until an approved assessment exists for it. This is where the person working
 * the change sees whether that assessment exists, what state it is in, and — if
 * it is still in draft — why the stage will refuse.
 *
 * It also accepts an assessment authored independently. A site that runs a
 * periodic process FMEA should be able to attach it to the change it already
 * covers, rather than redoing the work to satisfy a gate.
 *
 * Self-hiding when nothing is attached and the viewer cannot attach anything.
 */
import { Link } from 'react-router-dom';
import { ClipboardCheck, ExternalLink } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { useAssessmentsLinkedTo } from '@/lib/api/risk';
import { AssessmentStatusBadge } from '@/features/risk/riskStatusBadge';

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

/** Statuses that satisfy a RISK_ASSESSMENT_APPROVED stage criterion. */
const CLEARS_GATE = 'APPROVED';

export interface AssessmentLinkPanelProps {
  entityType: string;
  entityId: string;
  title?: string;
  className?: string;
}

export default function AssessmentLinkPanel({
  entityType,
  entityId,
  title = 'Risk assessments',
  className,
}: AssessmentLinkPanelProps) {
  const canRead = useHasPermission('risk_assessment.read');
  const { data: links = [], isLoading } = useAssessmentsLinkedTo(
    canRead ? entityType : undefined,
    canRead ? entityId : undefined,
  );

  if (!canRead) return null;
  if (!isLoading && links.length === 0) return null;

  const approved = links.filter((l) => l.assessment.status === CLEARS_GATE).length;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className ?? ''}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {links.length > 0 && (
          <span className="text-[11px] font-medium text-gray-500 tabular-nums">
            {approved}/{links.length} approved
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-xs text-gray-400">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {links.map((l) => (
            <li key={l.link_id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/risk/assessments/${l.assessment.id}`}
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 hover:text-blue-700"
                  >
                    <span className="font-mono">{l.assessment.assessment_number}</span>
                    <ExternalLink
                      size={11}
                      className="text-gray-300 group-hover:text-blue-500 shrink-0"
                    />
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-600 truncate">{l.assessment.title}</p>
                </div>
                <AssessmentStatusBadge status={l.assessment.status} />
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
                <span>{l.assessment.methodology}</span>
                <span>Attached {fmtDate(l.linked_at)}</span>
                {l.assessment.status !== CLEARS_GATE && (
                  <span className="font-medium text-amber-600">
                    Will not clear an approval gate until approved
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
