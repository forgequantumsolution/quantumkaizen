import { Link } from 'react-router-dom';
import {
  User,
  Building2,
  Calendar,
  Clock,
  Flag,
  MapPin,
  Link2,
  GitBranch,
} from 'lucide-react';
import { Card } from '@/components/ui';
import type { TicketDetail } from '@/lib/api/ticket';

const fmtDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const ageDays = (d: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900 truncate">{value}</div>
      </div>
    </div>
  );
}

/**
 * Persistent metadata rail shared by every workflow module's detail page —
 * mirrors the CAPA sidebar but sourced from the generic ticket record so
 * Change Control, Deviations, and all other modules get the same experience.
 */
export default function TicketSidebar({ ticket }: { ticket: TicketDetail }) {
  const flow = ticket.flows[0];
  const overdue =
    !!ticket.dueDate && !flow?.isCompleted && new Date(ticket.dueDate) < new Date();

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Metadata</h3>
        <div className="space-y-3">
          <Row icon={<User size={15} />} label="Owner" value={ticket.createdBy?.name ?? '—'} />
          <Row
            icon={<Building2 size={15} />}
            label="Department"
            value={ticket.department?.name ?? '—'}
          />
          <Row
            icon={<Flag size={15} />}
            label="Priority"
            value={ticket.priority?.name ?? '—'}
          />
          {ticket.site && (
            <Row icon={<MapPin size={15} />} label="Site" value={ticket.site.name} />
          )}
          <Row icon={<Calendar size={15} />} label="Created" value={fmtDate(ticket.createdAt)} />
          <Row icon={<Clock size={15} />} label="Age" value={`${ageDays(ticket.createdAt)} days`} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Linked Records</h3>
        <div className="space-y-2">
          {flow?.workflow && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <GitBranch size={15} className="text-gray-400 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">
                  Workflow
                </span>
                <span className="text-gray-700 truncate block">
                  {flow.workflow.name}
                  <span className="text-gray-400"> · v{flow.workflow.version}</span>
                </span>
              </span>
            </div>
          )}
          {ticket.parentTicket ? (
            <Link
              to={`/tickets/${ticket.parentTicket.id}`}
              className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm hover:bg-blue-50"
            >
              <Link2 size={15} className="text-blue-500 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] uppercase tracking-wide text-blue-500">
                  Parent ticket
                </span>
                <span className="font-mono text-blue-700 truncate block">
                  {ticket.parentTicket.uniqueId}
                </span>
              </span>
            </Link>
          ) : (
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-400">
              No parent ticket
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Key Dates</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Initiated</dt>
            <dd className="text-gray-900">{fmtDate(ticket.createdAt)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Due Date</dt>
            <dd className={overdue ? 'text-red-600 font-medium' : 'text-gray-900'}>
              {fmtDate(ticket.dueDate)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="text-gray-900">{fmtDate(ticket.updatedAt)}</dd>
          </div>
          {flow?.completedAt && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Completed</dt>
              <dd className="text-emerald-700">{fmtDate(flow.completedAt)}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
