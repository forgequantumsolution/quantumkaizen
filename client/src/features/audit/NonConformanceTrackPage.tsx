import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, Select, Spin, Table, message } from 'antd';
import {
  useNonConformances,
  useRaiseCapa,
  useUpdateNcStatus,
  type FindingSeverity,
  type NonConformance,
  type NonConformanceStatus,
} from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';
import { useTickets } from '@/lib/api/ticket';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import { FindingSeverityBadge, NcStatusBadge } from './auditStatusBadge';

type TrackMode = 'department' | 'severity' | 'status' | 'auditor';

const TRACKS: { key: TrackMode; label: string }[] = [
  { key: 'department', label: 'By Department' },
  { key: 'severity', label: 'By Severity' },
  { key: 'status', label: 'By Status' },
  { key: 'auditor', label: 'By Auditor' },
];

const NC_STATUSES: NonConformanceStatus[] = [
  'OPEN',
  'CAPA_RAISED',
  'IN_PROGRESS',
  'VERIFICATION',
  'CLOSED',
  'CANCELLED',
];

export default function NonConformanceTrackPage() {
  const [trackMode, setTrackMode] = useState<TrackMode>('department');
  const [statusFilter, setStatusFilter] = useState<NonConformanceStatus | 'ALL'>(
    'ALL',
  );
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | 'ALL'>('ALL');

  const canUpdate = useHasPermission('non_conformance.update');
  const updateStatus = useUpdateNcStatus();
  const [capaTarget, setCapaTarget] = useState<NonConformance | null>(null);

  const { data, isLoading } = useNonConformances({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    severity: severityFilter === 'ALL' ? undefined : severityFilter,
  });
  const rows = data?.data ?? [];

  // Group rows by the active track dimension
  const groups = useMemo(() => {
    const keyOf = (n: NonConformance): string => {
      switch (trackMode) {
        case 'department':
          return n.department?.name ?? 'Unassigned';
        case 'severity':
          return n.severity;
        case 'status':
          return n.status;
        case 'auditor':
          return 'All Auditors'; // backend doesn't carry auditor on NC; placeholder
      }
    };
    const map = new Map<string, NonConformance[]>();
    rows.forEach((n) => {
      const k = keyOf(n);
      const arr = map.get(k) ?? [];
      arr.push(n);
      map.set(k, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows, trackMode]);

  const handleStatusChange = async (id: string, status: NonConformanceStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      message.success(`Status set to ${status}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Non-Conformance</h2>
          <p className="text-xs text-gray-500">
            Findings promoted to non-conformances — track and close via CAPA.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TRACKS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTrackMode(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                trackMode === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'ALL', label: 'All statuses' },
              ...NC_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
            ]}
          />
          <Select
            value={severityFilter}
            onChange={setSeverityFilter}
            style={{ width: 140 }}
            options={[
              { value: 'ALL', label: 'All severities' },
              { value: 'MINOR', label: 'Minor' },
              { value: 'MAJOR', label: 'Major' },
              { value: 'CRITICAL', label: 'Critical' },
              { value: 'OBSERVATION', label: 'Observation' },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-24 text-center text-sm text-gray-400">
          No non-conformances match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([trackKey, items]) => (
            <div
              key={trackKey}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">
                  {trackKey}
                </div>
                <span className="text-[11px] text-gray-500">
                  {items.length} NC{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <Table<NonConformance>
                size="small"
                rowKey="id"
                dataSource={items}
                pagination={false}
                columns={[
                  {
                    title: 'NC #',
                    dataIndex: 'nc_number',
                    width: 130,
                    render: (v: string) => (
                      <span className="font-mono text-emerald-700">{v}</span>
                    ),
                  },
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    width: 100,
                    render: (v: FindingSeverity) => <FindingSeverityBadge severity={v} />,
                  },
                  {
                    title: 'Status',
                    width: 140,
                    render: (_: unknown, r) =>
                      canUpdate ? (
                        <Select
                          size="small"
                          value={r.status}
                          onChange={(v) => handleStatusChange(r.id, v)}
                          options={NC_STATUSES.map((s) => ({
                            value: s,
                            label: s.replace(/_/g, ' '),
                          }))}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <NcStatusBadge status={r.status} />
                      ),
                  },
                  {
                    title: 'From Finding',
                    render: (_: unknown, r) => (
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-gray-700">
                          {r.finding.findingNumber}
                        </div>
                        <div className="text-sm text-gray-900 truncate">
                          {r.finding.description ?? '—'}
                        </div>
                      </div>
                    ),
                  },
                  {
                    title: 'Audit',
                    width: 200,
                    render: (_: unknown, r) =>
                      r.finding.program?.register ? (
                        <Link
                          to={`/audit/program/${r.finding.program.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {r.finding.program.register.title}
                        </Link>
                      ) : (
                        '—'
                      ),
                  },
                  {
                    title: 'Due',
                    dataIndex: 'due_date',
                    width: 110,
                    render: (v: string | null) =>
                      v ? new Date(v).toLocaleDateString() : '—',
                  },
                  {
                    title: 'CAPA',
                    width: 150,
                    render: (_: unknown, r) =>
                      r.capa_ticket ? (
                        <Link
                          to={`/tickets/${r.capa_ticket.id}`}
                          className="font-mono text-amber-700 hover:underline"
                        >
                          {r.capa_ticket.uniqueId}
                        </Link>
                      ) : canUpdate ? (
                        <Button size="small" onClick={() => setCapaTarget(r)}>
                          Raise CAPA
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">Not raised</span>
                      ),
                  },
                ]}
              />
            </div>
          ))}
        </div>
      )}

      <RaiseCapaModal
        nc={capaTarget}
        onClose={() => setCapaTarget(null)}
      />
    </>
  );
}

/* ─── Raise CAPA modal: pick an existing CAPA-workflow ticket and link it ─── */

function RaiseCapaModal({
  nc,
  onClose,
}: {
  nc: NonConformance | null;
  onClose: () => void;
}) {
  const [ticketId, setTicketId] = useState<string | undefined>();
  const { data: types } = useWorkflowTypes();
  const capaType = (types ?? []).find((t) => /capa/i.test(t.name));
  const { data: ticketResp, isLoading } = useTickets({
    workflowTypeId: capaType?.id,
    pageSize: 100,
    status: 'open',
  });
  const tickets = ticketResp?.items ?? [];

  const raiseMut = useRaiseCapa();

  const submit = async () => {
    if (!nc || !ticketId) {
      message.error('Select a CAPA ticket to link');
      return;
    }
    try {
      await raiseMut.mutateAsync({ id: nc.id, capa_ticket_id: ticketId });
      message.success('CAPA ticket linked');
      setTicketId(undefined);
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Modal
      title={nc ? `Raise CAPA for ${nc.nc_number}` : 'Raise CAPA'}
      open={!!nc}
      onCancel={() => {
        setTicketId(undefined);
        onClose();
      }}
      onOk={submit}
      okText="Link CAPA"
      okButtonProps={{ loading: raiseMut.isPending }}
    >
      <p className="text-sm text-gray-600 mb-2">
        Pick an existing CAPA ticket to link. This sets the NC status to{' '}
        <span className="font-mono">CAPA_RAISED</span>.
      </p>
      {!capaType && (
        <p className="text-xs text-amber-700 mb-2">
          No workflow type matching "CAPA" was found — showing all open tickets.
        </p>
      )}
      <Select
        value={ticketId}
        onChange={setTicketId}
        loading={isLoading}
        showSearch
        optionFilterProp="label"
        placeholder="Search by ticket # or title…"
        className="w-full"
        options={tickets.map((t) => ({
          value: t.id,
          label: `${t.uniqueId} — ${t.title}`,
        }))}
      />
    </Modal>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
