/**
 * Child corrective-actions (CAPAs) raised from an audit ticket's non-
 * conformances, listed on the parent audit ticket so every CAPA — however many
 * were raised — can be tracked from one place instead of hunting them down
 * individually.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui';
import { useRegisterCapas, type CapaStatus } from '@/lib/api/audit';

interface Props {
  registerId: string;
}

const STATUS_COLOR: Record<CapaStatus, string> = {
  OPEN: '#64748b',
  INVESTIGATION: '#2563eb',
  PLAN: '#7c3aed',
  IMPLEMENTATION: '#d97706',
  VERIFICATION: '#0891b2',
  CLOSED: '#16a34a',
  CANCELLED: '#9ca3af',
};

function StatusPill({ status }: { status: CapaStatus }) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {status}
    </span>
  );
}

export default function AuditCapaChildrenCard({ registerId }: Props) {
  const { data, isLoading } = useRegisterCapas(registerId);
  const capas = data?.data ?? [];

  const openCount = useMemo(
    () => capas.filter((c) => c.status !== 'CLOSED' && c.status !== 'CANCELLED').length,
    [capas],
  );

  if (isLoading || capas.length === 0) return null;

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch size={16} className="text-[#C9A84C]" />
        <h3 className="text-sm font-semibold text-gray-800">Corrective Actions (CAPAs)</h3>
        <span className="text-[11px] text-gray-400">
          {capas.length} total · {openCount} open
        </span>
      </div>

      <ul className="space-y-1.5">
        {capas.map((c) => (
          <li
            key={c.id}
            className="flex items-start justify-between gap-3 rounded-md border border-gray-100 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to={`/audit/capa/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                >
                  {c.capa_number}
                  <ExternalLink size={11} />
                </Link>
                <span className="text-[11px] text-gray-400">{c.type}</span>
                {c.non_conformance?.ncNumber && (
                  <span className="text-[11px] text-gray-400">
                    from {c.non_conformance.ncNumber}
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-gray-700">{c.title}</div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {c.action_item_count > 0 && (
                <span className="text-[11px] text-gray-400">
                  {c.action_item_count} action{c.action_item_count === 1 ? '' : 's'}
                </span>
              )}
              <StatusPill status={c.status} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
