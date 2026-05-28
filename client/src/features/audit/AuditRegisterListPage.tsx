import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Select, Table } from 'antd';
import { Plus, Search } from 'lucide-react';
import {
  useAuditRegisters,
  type AuditStatus,
  type AuditRegister,
} from '@/lib/api/audit';
import { AuditStatusBadge } from './auditStatusBadge';
import AuditRegisterFormDrawer from './AuditRegisterFormDrawer';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, isLoading } = useAuditRegisters({
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
    page_size: 100,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Register</h2>
          <p className="text-xs text-gray-500">
            Plan audits, submit for approval, then execute them as a program.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={() => setDrawerOpen(true)}
        >
          New Register
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                status === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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
            style={{ width: 260 }}
          />
        </div>
      </div>

      <Table<AuditRegister>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({
          onClick: () => nav(`/audit/register/${r.id}`),
          style: { cursor: 'pointer' },
        })}
        columns={[
          {
            title: 'Register #',
            dataIndex: 'register_number',
            width: 140,
            render: (v: string, r) => (
              <Link
                to={`/audit/register/${r.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-blue-600 hover:underline"
              >
                {v}
              </Link>
            ),
          },
          { title: 'Title', dataIndex: 'title', ellipsis: true },
          {
            title: 'Type',
            dataIndex: 'audit_type',
            width: 110,
            render: (v: string) => (
              <span className="text-xs font-medium text-gray-700">
                {v.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 150,
            render: (v: AuditStatus) => <AuditStatusBadge status={v} />,
          },
          {
            title: 'Planned',
            dataIndex: 'planned_date',
            width: 110,
            render: (v: string) => (v ? new Date(v).toLocaleDateString() : '—'),
          },
          {
            title: 'Auditor',
            dataIndex: ['auditor', 'name'],
            width: 130,
            render: (_: unknown, r) => r.auditor?.name ?? '—',
          },
          {
            title: 'Approver',
            dataIndex: ['approver', 'name'],
            width: 130,
            render: (_: unknown, r) => r.approver?.name ?? '—',
          },
          {
            title: 'Checklist',
            dataIndex: ['checklist_form', 'title'],
            width: 160,
            ellipsis: true,
            render: (_: unknown, r) => r.checklist_form?.title ?? '—',
          },
        ]}
      />

      <AuditRegisterFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        register={null}
      />
    </>
  );
}
