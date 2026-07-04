import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Modal } from 'antd';
import { Plus, Search, SlidersHorizontal, Check } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const PAGE_SIZE = 10;
import {
  useAuditRegisters,
  type AuditStatus,
  type AuditRegister,
} from '@/lib/api/audit';
import { AuditStatusBadge } from './auditStatusBadge';

const STATUS_TABS: { key: AuditStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function AuditRegisterListPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<AuditStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const activeStatusLabel =
    STATUS_TABS.find((t) => t.key === status)?.label ?? 'All';

  const debouncedSearch = useDebouncedValue(search, 450);
  // Reset to page 1 whenever the query changes.
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const { data, isLoading } = useAuditRegisters({
    page,
    page_size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    search: debouncedSearch || undefined,
  });
  const rows = data?.data ?? [];
  const totalItems = data?.pagination?.total_items ?? rows.length;

  return (
    <>
      {/* Single toolbar row: title + search + filter + create. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Audit Register</h2>
          <p className="text-xs text-gray-500">
            Plan audits, submit for approval, then execute them as a program.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search register #, title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ width: 240 }}
            />
          </div>
          <Button icon={<SlidersHorizontal size={14} />} onClick={() => setFilterOpen(true)}>
            Filter
            {status !== 'ALL' && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold px-1.5 py-0.5">
                {activeStatusLabel}
              </span>
            )}
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => nav('/audit/register/new')}
          >
            New Register
          </Button>
        </div>
      </div>

      {/* Filter modal — status selection lives here now. */}
      <Modal
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        title="Filter audits"
        footer={
          <div className="flex items-center justify-between">
            <Button
              type="text"
              onClick={() => {
                setStatus('ALL');
              }}
              disabled={status === 'ALL'}
            >
              Clear
            </Button>
            <Button type="primary" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="py-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_TABS.map((t) => {
              const active = status === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setStatus(t.key)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-gold-400 bg-gold-50 text-gold-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{t.label}</span>
                  {active && <Check size={15} className="text-gold-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <DataTable<AuditRegister>
          data={rows}
          isLoading={isLoading}
          emptyMessage="No audit registers found"
          onRowClick={(r) => nav(`/audit/register/${r.id}`)}
          columns={REGISTER_COLUMNS}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            onPageChange: setPage,
          }}
        />
      </div>
    </>
  );
}

const REGISTER_COLUMNS: Column<AuditRegister>[] = [
  {
    key: 'register_number',
    header: 'Register #',
    render: (r) => (
      <Link
        to={`/audit/register/${r.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-blue-600 hover:underline"
      >
        {r.register_number}
      </Link>
    ),
  },
  { key: 'title', header: 'Title' },
  {
    key: 'audit_type',
    header: 'Type',
    render: (r) => (
      <span className="text-xs font-medium text-gray-700">
        {r.audit_type.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    render: (r) => <AuditStatusBadge status={r.status as AuditStatus} />,
  },
  {
    key: 'planned_date',
    header: 'Planned',
    render: (r) => (r.planned_date ? new Date(r.planned_date).toLocaleDateString() : '—'),
  },
  {
    key: 'auditor',
    header: 'Auditor',
    sortable: false,
    render: (r) => r.auditor?.name ?? '—',
  },
  {
    key: 'approver',
    header: 'Approver',
    sortable: false,
    render: (r) => r.approver?.name ?? '—',
  },
  {
    key: 'checklist_form',
    header: 'Checklist',
    sortable: false,
    render: (r) => r.checklist_form?.title ?? '—',
  },
];
