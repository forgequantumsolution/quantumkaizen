/**
 * "Risks linked to this record" — the drop-in panel every module detail page
 * uses to surface risk without building its own risk UI.
 *
 *   <RiskLinkPanel entityType="Document" entityId={doc.id} />
 *
 * Why it lives in components/ and not features/risk/: the consumers are CAPA,
 * DMS, audit, LIMS and change-control pages. A component only those pages render
 * does not belong inside the risk feature folder.
 *
 * It renders nothing at all when the record has no linked risks and the viewer
 * cannot read risks — a permanently empty card on every detail page in the
 * platform would be noise. See docs/RISK-cross-module-integration-plan.md §C.1.
 */
import { Link } from 'react-router-dom';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { useRisksLinkedTo } from '@/lib/api/risk';
import { RiskLevelBadge, RiskStatusBadge } from '@/features/risk/riskStatusBadge';

const humanise = (s: string) => s.replace(/_/g, ' ');

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export interface RiskLinkPanelProps {
  /** Must be a type the backend registry knows — see GET /risk/links/types. */
  entityType: string;
  entityId: string;
  /** Override the card heading. */
  title?: string;
  /** Render the card even when there is nothing to show. */
  showWhenEmpty?: boolean;
  className?: string;
}

export default function RiskLinkPanel({
  entityType,
  entityId,
  title = 'Linked risks',
  showWhenEmpty = false,
  className,
}: RiskLinkPanelProps) {
  const canRead = useHasPermission('risk.read');
  const { data: links = [], isLoading } = useRisksLinkedTo(
    canRead ? entityType : undefined,
    canRead ? entityId : undefined,
  );

  if (!canRead) return null;
  if (!isLoading && links.length === 0 && !showWhenEmpty) return null;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg ${className ?? ''}`}>
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShieldAlert size={15} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {links.length > 0 && (
          <span className="text-[11px] font-medium text-gray-500 tabular-nums">{links.length}</span>
        )}
      </div>

      {isLoading ? (
        <p className="px-5 py-8 text-center text-xs text-gray-400">Loading…</p>
      ) : links.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-gray-400">
          No risks are linked to this record yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {links.map((l) => (
            <li key={l.link_id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/risk/risks/${l.risk.id}`}
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 hover:text-blue-700"
                  >
                    <span className="font-mono">{l.risk.risk_number}</span>
                    <ExternalLink
                      size={11}
                      className="text-gray-300 group-hover:text-blue-500 shrink-0"
                    />
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-600 truncate">{l.risk.title}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {/* Residual is the current judgement of the risk; fall back to
                      initial so a risk that has not been re-scored yet still
                      shows a level rather than an empty column. */}
                  <RiskLevelBadge
                    level={l.risk.residual_level ?? l.risk.initial_level}
                    score={l.risk.residual_score ?? l.risk.initial_score}
                  />
                  <RiskStatusBadge status={l.risk.status} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
                {l.relation && <span>{humanise(l.relation)}</span>}
                <span>Linked {fmtDate(l.linked_at)}</span>
                {l.risk.is_review_overdue && (
                  <span className="font-semibold text-red-600">Review overdue</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
