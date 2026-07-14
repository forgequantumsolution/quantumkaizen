import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Table } from 'antd';
import { ScrollText, Plus, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import { useSpecs, type SpecSummary, type SpecStatus } from '@/lib/api/lims';

const STATUS_BADGE: Record<SpecStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETIRED: 'bg-red-50 text-red-700 border-red-200',
};

export default function SpecListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('specification.create');
  const [status, setStatus] = useState<SpecStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSpecs({ status, search: search || undefined });
  const rows = data?.data ?? [];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ScrollText size={22} className="text-gray-500" />Specification Library</h1>
          <p className="text-xs text-gray-500 mt-0.5">Product specifications with per-parameter acceptance limits — drives OOS/OOT in testing.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 150 }}
            options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'APPROVED', label: 'Approved' }, { value: 'RETIRED', label: 'Retired' }]} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / product…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 240 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => nav('/lims/specifications/new')}>New Specification</Button>}
        </div>
      </div>

      <Table<SpecSummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => nav(`/lims/specifications/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Product', dataIndex: 'product_name', width: 300, ellipsis: true },
          { title: 'Version', dataIndex: 'version', width: 90, render: (v: number) => `v${v}` },
          { title: 'Pharmacopoeia', dataIndex: 'pharmacopoeia', width: 140, render: (v: string | null) => v ?? '—' },
          { title: 'Parameters', dataIndex: 'parameter_count', width: 100 },
          {
            title: 'Status', width: 110,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[r.status]}`}>{r.status}</span>,
          },
          { title: 'Effective', width: 110, render: (_: unknown, r) => (r.effective_date ? new Date(r.effective_date).toLocaleDateString() : '—') },
        ]}
      />
    </PageContainer>
  );
}
