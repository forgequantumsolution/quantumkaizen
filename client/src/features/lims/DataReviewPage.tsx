import { useState } from 'react';
import { DatePicker, Input, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { ShieldCheck, History, Search, ArrowRight } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useAuditReview,
  useAuditEntityTypes,
  type AuditEntry,
} from '@/lib/api/limsAnalytics';

const { RangePicker } = DatePicker;

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'TRANSITION', 'SIGN', 'REVIEW'];
const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  TRANSITION: 'geekblue',
  SIGN: 'purple',
  REVIEW: 'gold',
};

const PAGE_SIZE = 10;

export default function DataReviewPage() {
  const canRead = useHasPermission('data_review.read');

  const [entityType, setEntityType] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();
  const [user, setUser] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);

  const from = range?.[0]?.startOf('day').toISOString();
  const to = range?.[1]?.endOf('day').toISOString();

  const { data: entityTypes } = useAuditEntityTypes();
  const { data, isLoading } = useAuditReview({
    entity_type: entityType,
    action,
    user: user || undefined,
    search: search || undefined,
    from,
    to,
    page,
    page_size: PAGE_SIZE,
  });

  const resetPage = () => setPage(1);

  if (!canRead) {
    return (
      <PageContainer>
        <Header />
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <ShieldCheck size={32} className="mx-auto text-gray-300 mb-3" />
          <div className="text-sm font-medium text-gray-700">No access to the audit trail</div>
          <div className="text-xs text-gray-400 mt-1">
            You need the <code className="font-mono">data_review.read</code> permission to view this page.
          </div>
        </div>
      </PageContainer>
    );
  }

  const rows = data?.data ?? [];

  const columns: ColumnsType<AuditEntry> = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => (
        <span className="text-xs text-gray-600 whitespace-nowrap">{new Date(v).toLocaleString()}</span>
      ),
    },
    {
      title: 'Entity',
      width: 180,
      render: (_: unknown, r) => (
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-800">{r.entity_type}</div>
          <div className="text-[11px] font-mono text-gray-400 truncate" title={r.entity_id}>
            {r.entity_id?.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 120,
      render: (v: string) => <Tag color={ACTION_COLOR[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Field',
      dataIndex: 'field',
      width: 140,
      render: (v: string | null) => (v ? <span className="text-xs font-mono text-gray-600">{v}</span> : <span className="text-gray-300">—</span>),
    },
    {
      title: 'Change',
      render: (_: unknown, r) => {
        if (r.old_value == null && r.new_value == null) return <span className="text-gray-300">—</span>;
        return (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-red-600 line-through truncate max-w-[160px]" title={r.old_value ?? ''}>
              {r.old_value ?? '∅'}
            </span>
            <ArrowRight size={12} className="text-gray-400 shrink-0" />
            <span className="text-emerald-700 truncate max-w-[160px]" title={r.new_value ?? ''}>
              {r.new_value ?? '∅'}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      ellipsis: true,
      render: (v: string | null) => (v ? <span className="text-xs text-gray-600">{v}</span> : <span className="text-gray-300">—</span>),
    },
    {
      title: 'User',
      dataIndex: 'user_name',
      width: 150,
      render: (v: string | null) => <span className="text-xs text-gray-700">{v ?? 'System'}</span>,
    },
  ];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <Header />
        <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={entityType}
          onChange={(v) => { setEntityType(v); resetPage(); }}
          allowClear
          placeholder="All entities"
          style={{ width: 180 }}
          showSearch
          optionFilterProp="label"
          options={(entityTypes?.data ?? []).map((t) => ({ value: t, label: t }))}
        />
        <Select
          value={action}
          onChange={(v) => { setAction(v); resetPage(); }}
          allowClear
          placeholder="All actions"
          style={{ width: 150 }}
          options={ACTIONS.map((a) => ({ value: a, label: a }))}
        />
        <Input
          placeholder="User…"
          value={user}
          onChange={(e) => { setUser(e.target.value); resetPage(); }}
          allowClear
          style={{ width: 160 }}
        />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            allowClear
            className="pl-9"
            style={{ width: 240 }}
          />
        </div>
        <RangePicker
          value={range ?? undefined}
          onChange={(v) => { setRange(v as [Dayjs | null, Dayjs | null] | null); resetPage(); }}
        />
        </div>
      </div>

      <Table<AuditEntry>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        columns={columns}
        pagination={{
          current: data?.page ?? page,
          pageSize: data?.page_size ?? PAGE_SIZE,
          total: data?.total ?? 0,
          showSizeChanger: false,
          showTotal: (t) => `${t} entries`,
          onChange: (p) => setPage(p),
        }}
      />
    </PageContainer>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <ShieldCheck size={22} className="text-gray-500" />
        Data Review / Audit Trail
      </h1>
      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
        <History size={12} /> Immutable record of every change across LIMS entities.
      </p>
    </div>
  );
}
