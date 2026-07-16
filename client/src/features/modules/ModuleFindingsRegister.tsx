import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Select } from 'antd';
import { AlertTriangle } from 'lucide-react';
import { Card, DataTable, EmptyState, type Column } from '@/components/ui';
import {
  useFindingsRegister,
  type Finding,
  type FindingSeverity,
  type FindingStatus,
} from '@/lib/api/finding';
import { FindingSeverityBadge, FindingStatusBadge } from '@/features/audit/auditStatusBadge';

const SEVERITIES: FindingSeverity[] = ['OBSERVATION', 'MINOR', 'MAJOR', 'CRITICAL'];
const STATUSES: FindingStatus[] = ['OPEN', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED'];

// Module-wide findings register — every finding across this module's tickets.
export default function ModuleFindingsRegister({ workflowTypeId }: { workflowTypeId: string }) {
  const nav = useNavigate();
  const [severity, setSeverity] = useState<FindingSeverity | undefined>();
  const [status, setStatus] = useState<FindingStatus | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFindingsRegister({
    workflow_type_id: workflowTypeId,
    severity,
    status,
    page,
    page_size: 20,
  });
  const findings = data?.data ?? [];

  const columns: Column<Finding>[] = [
    {
      key: 'finding_number',
      header: 'Finding',
      render: (f) => <span className="font-mono text-xs font-semibold">{f.finding_number}</span>,
    },
    { key: 'severity', header: 'Severity', render: (f) => <FindingSeverityBadge severity={f.severity} /> },
    {
      key: 'title',
      header: 'Title',
      render: (f) => <span className="text-sm text-gray-900">{f.title}</span>,
    },
    { key: 'status', header: 'Status', render: (f) => <FindingStatusBadge status={f.status} /> },
    {
      key: 'source_ticket',
      header: 'Source',
      render: (f) => (
        <span className="font-mono text-xs text-blue-600">
          {f.source_ticket?.unique_id ?? '—'}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (f) => (
        <span className="text-xs text-gray-500">{f.source_ticket?.department?.name ?? '—'}</span>
      ),
    },
  ];

  return (
    <div className="mt-4 space-y-3">
      <Card>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Findings register</h3>
            <p className="text-[11px] text-gray-400">
              Every finding across this module's records. {data?.total ?? 0} total.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={severity}
              onChange={(v) => {
                setSeverity(v as FindingSeverity | undefined);
                setPage(1);
              }}
              allowClear
              placeholder="Severity"
              options={SEVERITIES.map((s) => ({ value: s, label: s }))}
              style={{ minWidth: 140 }}
            />
            <Select
              value={status}
              onChange={(v) => {
                setStatus(v as FindingStatus | undefined);
                setPage(1);
              }}
              allowClear
              placeholder="Status"
              options={STATUSES.map((s) => ({ value: s, label: s }))}
              style={{ minWidth: 140 }}
            />
          </div>
        </div>

        {!isLoading && findings.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No findings yet"
            description="Findings appear when a checklist with non-conformances is submitted on this module's tickets."
          />
        ) : (
          <DataTable
            columns={columns}
            data={findings}
            isLoading={isLoading}
            onRowClick={(f) => f.source_ticket && nav(`/tickets/${f.source_ticket.id}`)}
            serverPagination={{
              page,
              pageSize: 20,
              totalItems: data?.total ?? 0,
              onPageChange: setPage,
            }}
          />
        )}
      </Card>
    </div>
  );
}
