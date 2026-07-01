import { Link } from 'react-router-dom';
import { User, Building2, Calendar, Clock, FileText, Link2, ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Capa } from '@/lib/api/audit';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ageDays = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );
}

export default function CapaSidebar({ capa }: { capa: Capa }) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Metadata</h3>
        <div className="space-y-3">
          <Row icon={<User size={15} />} label="Owner" value={capa.owner?.name ?? '—'} />
          <Row icon={<Building2 size={15} />} label="Department" value={capa.department?.name ?? '—'} />
          <Row icon={<Calendar size={15} />} label="Created" value={fmtDate(capa.created_at)} />
          <Row icon={<Clock size={15} />} label="Age" value={`${ageDays(capa.created_at)} days`} />
          <Row icon={<FileText size={15} />} label="Created By" value={capa.created_by?.name ?? '—'} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Linked Records</h3>
        <div className="space-y-2">
          {capa.non_conformance ? (
            <Link
              to="/audit/non-conformance"
              className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-sm hover:bg-red-50"
            >
              <ShieldAlert size={15} className="text-red-500" />
              <span>
                <span className="block text-[11px] uppercase tracking-wide text-red-500">Source NC</span>
                <span className="font-mono text-red-700">{capa.non_conformance.ncNumber}</span>
              </span>
            </Link>
          ) : (
            <div className="rounded-lg border border-gray-100 px-3 py-2 text-sm text-gray-400">
              No linked non-conformance
            </div>
          )}
          {capa.workflow_ticket_unique_id && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm">
              <Link2 size={15} className="text-gray-400" />
              <span>
                <span className="block text-[11px] uppercase tracking-wide text-gray-500">Workflow ticket</span>
                <span className="font-mono text-gray-700">{capa.workflow_ticket_unique_id}</span>
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Key Dates</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Initiated</dt>
            <dd className="text-gray-900">{fmtDate(capa.created_at)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Due Date</dt>
            <dd className={capa.due_date ? 'text-red-600' : 'text-gray-900'}>{fmtDate(capa.due_date)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="text-gray-900">{fmtDate(capa.updated_at)}</dd>
          </div>
          {capa.closed_at && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Closed</dt>
              <dd className="text-emerald-700">{fmtDate(capa.closed_at)}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
