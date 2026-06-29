import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Table, Button } from 'antd';
import { Search, Plus, FileText, BookOpenCheck } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useDocuments,
  useMyPendingReads,
  DOC_TYPE_LABELS,
  type DocSummary,
  type DocumentStatus,
  type DocumentType,
} from '@/lib/api/dms';
import DocStatusBadge from './DocStatusBadge';

type Tab = DocumentStatus | 'ALL' | 'REVIEW_DUE';
const STATUS_TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'EFFECTIVE', label: 'Effective' },
  { key: 'REVIEW_DUE', label: 'Review Due' },
  { key: 'RETIRED', label: 'Retired' },
];

export default function DocumentListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('document.create');
  const [status, setStatus] = useState<Tab>('ALL');
  const [type, setType] = useState<DocumentType | undefined>();
  const [search, setSearch] = useState('');

  const { data: myReads } = useMyPendingReads();

  const { data, isLoading } = useDocuments({
    status: status === 'ALL' || status === 'REVIEW_DUE' ? undefined : status,
    review_due: status === 'REVIEW_DUE' || undefined,
    type,
    search: search || undefined,
    page_size: 100,
  });
  const rows = data?.data ?? [];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-gray-500" />
            Documents
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Controlled documents — SOPs, policies and protocols authored in the online editor.
          </p>
        </div>
        {canCreate && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => nav('/dms/new')}>
            New Document
          </Button>
        )}
      </div>

      {myReads && myReads.count > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900 mb-1.5">
            <BookOpenCheck size={15} />
            You have {myReads.count} document{myReads.count === 1 ? '' : 's'} to read &amp; acknowledge
          </div>
          <div className="flex flex-wrap gap-2">
            {myReads.items.map((it) => (
              <button
                key={it.receipt_id}
                onClick={() => nav(`/dms/${it.document_id}`)}
                className="inline-flex items-center gap-1.5 text-xs bg-white border border-amber-200 text-amber-800 hover:bg-amber-100 rounded px-2 py-1"
              >
                <span className="font-mono">{it.doc_number}</span>
                <span className="truncate max-w-[200px]">{it.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                status === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={type}
            onChange={setType}
            allowClear
            placeholder="All types"
            style={{ width: 170 }}
            options={Object.entries(DOC_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))}
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input
              placeholder="Search number / title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ width: 240 }}
            />
          </div>
        </div>
      </div>

      <Table<DocSummary>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => nav(`/dms/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Doc #',
            dataIndex: 'doc_number',
            width: 150,
            render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
          },
          { title: 'Title', dataIndex: 'title', ellipsis: true },
          {
            title: 'Type',
            dataIndex: 'type',
            width: 130,
            render: (v: DocumentType) => DOC_TYPE_LABELS[v],
          },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 110,
            render: (v: DocumentStatus) => <DocStatusBadge status={v} />,
          },
          {
            title: 'Version',
            width: 90,
            render: (_: unknown, r) => r.latest_version_label ?? '—',
          },
          { title: 'Owner', width: 150, render: (_: unknown, r) => r.owner_name ?? '—' },
          {
            title: 'Effective',
            width: 110,
            render: (_: unknown, r) =>
              r.effective_date ? new Date(r.effective_date).toLocaleDateString() : '—',
          },
        ]}
      />
    </PageContainer>
  );
}
