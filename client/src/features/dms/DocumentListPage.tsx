import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Select, Table, Button } from 'antd';
import { Search, Plus, FileText, BookOpenCheck, LayoutDashboard, List as ListIcon } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
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
import DmsDashboard from './DmsDashboard';

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
  const [view, setView] = useState<'dashboard' | 'list'>('dashboard');
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
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden mb-4 border-l-[3px] border-l-gold-500">
        <div className="px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Identity + tabs share the top row. */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <FileText size={18} />
              </span>
              <h1 className="text-[15px] font-bold text-gray-900 tracking-tight truncate leading-none">
                Documents
              </h1>
              <div className="h-6 w-px bg-gray-200 shrink-0 hidden md:block" />
              <div className="w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -my-1">
                <nav className="inline-flex gap-1.5 p-1 rounded-lg bg-gray-100/80 ring-1 ring-gray-200/60">
                  <button
                    type="button"
                    onClick={() => setView('dashboard')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-all duration-150',
                      view === 'dashboard'
                        ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
                    )}
                  >
                    <LayoutDashboard size={14} /> Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-all duration-150',
                      view === 'list'
                        ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
                    )}
                  >
                    <ListIcon size={14} /> Documents
                  </button>
                </nav>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {view === 'list' && (
                <>
                  <Select
                    value={type}
                    onChange={setType}
                    allowClear
                    placeholder="All types"
                    style={{ width: 170 }}
                    options={Object.entries(DOC_TYPE_LABELS).map(([v, label]) => ({ value: v, label }))}
                  />
                  <div className="relative w-60">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
                    />
                    <Input
                      placeholder="Search number / title…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10 !rounded-full"
                    />
                  </div>
                </>
              )}
              {canCreate && (
                <Button type="primary" icon={<Plus size={14} />} onClick={() => nav('/dms/new')}>
                  New Document
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {view === 'dashboard' ? (
        <DmsDashboard />
      ) : (
        <DocumentListBody
          status={status}
          setStatus={setStatus}
          rows={rows}
          isLoading={isLoading}
          myReads={myReads}
          nav={nav}
        />
      )}
    </PageContainer>
  );
}

interface BodyProps {
  status: Tab;
  setStatus: (t: Tab) => void;
  rows: DocSummary[];
  isLoading: boolean;
  myReads: ReturnType<typeof useMyPendingReads>['data'];
  nav: ReturnType<typeof useNavigate>;
}

function DocumentListBody({ status, setStatus, rows, isLoading, myReads, nav }: BodyProps) {
  return (
    <>
      <div className="mb-4 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <nav className="inline-flex gap-1.5 p-1 rounded-lg bg-gray-100/80 ring-1 ring-gray-200/60">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatus(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-all duration-150',
                status === t.key
                  ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
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
    </>
  );
}
