import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Select, Table, Button } from 'antd';
import {
  Plus,
  FileText,
  LayoutDashboard,
  List as ListIcon,
  ClipboardCheck,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import FilterBar, { FilterField } from '@/components/shared/FilterBar';
import { cn } from '@/lib/utils';
import { useHasPermission } from '@/stores/authStore';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import { wfTypeReadKey } from '@/lib/navAccess';
import ModulePage from '@/features/modules/ModulePage';
import {
  useDocuments,
  DOC_TYPE_LABELS,
  type DocSummary,
  type DocumentStatus,
  type DocumentType,
} from '@/lib/api/dms';
import DocStatusBadge from './DocStatusBadge';
import DmsDashboard, {
  DOC_STATUS_LABELS,
  type DmsDashboardFilters,
  type DmsDashboardOptions,
} from './DmsDashboard';

type Tab = DocumentStatus | 'ALL' | 'REVIEW_DUE';
const STATUS_TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'EFFECTIVE', label: 'Effective' },
  { key: 'REVIEW_DUE', label: 'Review Due' },
  { key: 'RETIRED', label: 'Retired' },
];

/** Document Review is matched by name, the same rule the sidebar used when this
 *  workflow had its own nav entry. */
const isDocReview = (name: string) => /^document\s*review$/i.test(name.trim());

type View = 'dashboard' | 'list' | 'approval';

export default function DocumentListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('document.create');

  // The view lives in the URL so a tab is linkable and survives a refresh —
  // "Document Approval" used to be its own sidebar route, and links to it that
  // predate this merge should still land somewhere sensible.
  const [params, setParams] = useSearchParams();
  const urlView = params.get('view');
  const view: View =
    urlView === 'list' || urlView === 'approval' || urlView === 'dashboard'
      ? urlView
      : 'dashboard';
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'dashboard') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  // Document Approval is the "Document Review" ticket workspace, embedded as a
  // tab rather than living at its own /modules/:id sidebar entry.
  const { data: workflowTypes } = useWorkflowTypes();
  const docReviewType = (workflowTypes ?? []).find(
    (t) => !t.isDeleted && isDocReview(t.name),
  );
  // Unconditional hook call; the key just varies once the lookup resolves. The
  // placeholder below is never held by anyone, so the tab stays hidden until a
  // real Document Review type is known.
  const canReadApproval = useHasPermission(
    docReviewType ? wfTypeReadKey(docReviewType.id) : '__no_doc_review_type__',
  );
  const showApprovalTab = !!docReviewType && canReadApproval;

  const [status, setStatus] = useState<Tab>('ALL');
  const [type, setType] = useState<DocumentType | undefined>();
  const [search, setSearch] = useState('');

  // "All" is the default view, so it is not a filter — only a deliberate move
  // off it counts towards the badge. Search shows in the bar itself.
  const activeFilterCount = (status !== 'ALL' ? 1 : 0) + (type ? 1 : 0);

  // Dashboard filters are owned here so their controls can sit in the header
  // alongside every other module's, instead of on a row inside the panel.
  const [dashFilters, setDashFilters] = useState<DmsDashboardFilters>({});
  const [dashOptions, setDashOptions] = useState<DmsDashboardOptions>({
    statuses: [],
    types: [],
    departments: [],
  });
  const dashActiveCount = Object.values(dashFilters).filter(Boolean).length;
  // Stable identity — DmsDashboard fires this from an effect, so a new function
  // each render would loop.
  const handleDashOptions = useCallback(
    (o: DmsDashboardOptions) => setDashOptions(o),
    [],
  );

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
              {/* Code badge, same slot the module hero uses for its workflow
                  codePrefix. DMS numbers documents DOC-<year>-NNNN. */}
              <span className="text-[10px] font-mono font-bold text-gold-700 bg-gold-50 ring-1 ring-gold-200 px-1.5 py-0.5 rounded-md shrink-0">
                DOC
              </span>
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
                  {showApprovalTab && (
                    <button
                      type="button"
                      onClick={() => setView('approval')}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-lg whitespace-nowrap transition-all duration-150',
                        view === 'approval'
                          ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
                      )}
                    >
                      <ClipboardCheck size={14} /> Document Approval
                    </button>
                  )}
                </nav>
              </div>
            </div>

            {/* Actions — same position and order as the generic module hero
                (ModulePage): search, Filter, then the create button. */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {view === 'list' && (
                <FilterBar
                  inline
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search number / title…"
                  title="Filter documents"
                  activeCount={activeFilterCount}
                  onClear={() => {
                    setStatus('ALL');
                    setType(undefined);
                  }}
                >
                  <FilterField label="Status">
                    <Select
                      value={status}
                      onChange={(v) => setStatus(v ?? 'ALL')}
                      style={{ width: '100%' }}
                      options={STATUS_TABS.map((t) => ({ value: t.key, label: t.label }))}
                    />
                  </FilterField>
                  <FilterField label="Type">
                    <Select
                      value={type}
                      onChange={setType}
                      allowClear
                      placeholder="All types"
                      style={{ width: '100%' }}
                      options={Object.entries(DOC_TYPE_LABELS).map(([v, label]) => ({
                        value: v,
                        label,
                      }))}
                    />
                  </FilterField>
                </FilterBar>
              )}
              {view === 'dashboard' && (
                <FilterBar
                  inline
                  title="Filter dashboard"
                  activeCount={dashActiveCount}
                  onClear={() => setDashFilters({})}
                >
                  <FilterField label="Status">
                    <Select
                      value={dashFilters.status}
                      onChange={(v?: DocumentStatus) =>
                        setDashFilters((f) => ({ ...f, status: v }))
                      }
                      allowClear
                      placeholder="Any status"
                      style={{ width: '100%' }}
                      options={dashOptions.statuses.map((s) => ({
                        value: s,
                        label: DOC_STATUS_LABELS[s] ?? s,
                      }))}
                    />
                  </FilterField>
                  <FilterField label="Type">
                    <Select
                      value={dashFilters.type}
                      onChange={(v?: DocumentType) => setDashFilters((f) => ({ ...f, type: v }))}
                      allowClear
                      placeholder="Any type"
                      style={{ width: '100%' }}
                      options={dashOptions.types.map((t) => ({
                        value: t,
                        label: DOC_TYPE_LABELS[t] ?? t,
                      }))}
                    />
                  </FilterField>
                  <FilterField label="Department">
                    <Select
                      value={dashFilters.department}
                      onChange={(v?: string) => setDashFilters((f) => ({ ...f, department: v }))}
                      allowClear
                      placeholder="Any department"
                      style={{ width: '100%' }}
                      options={dashOptions.departments.map((d) => ({ value: d, label: d }))}
                    />
                  </FilterField>
                </FilterBar>
              )}
              {/* Creating a document belongs to the library, not to the
                  read-only dashboard or the approval queue. */}
              {view === 'list' && canCreate && (
                <Button type="primary" icon={<Plus size={14} />} onClick={() => nav('/dms/new')}>
                  New Document
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {view === 'dashboard' && (
        <DmsDashboard filters={dashFilters} onOptionsChange={handleDashOptions} />
      )}

      {/* `embedded` suppresses ModulePage's own hero header — this page already
          rendered one above, and two stacked module headers read as a bug. */}
      {view === 'approval' && showApprovalTab && docReviewType && (
        <ModulePage typeId={docReviewType.id} embedded />
      )}

      {view === 'list' && (
        <DocumentListBody rows={rows} isLoading={isLoading} nav={nav} />
      )}
    </PageContainer>
  );
}

interface BodyProps {
  rows: DocSummary[];
  isLoading: boolean;
  nav: ReturnType<typeof useNavigate>;
}

/** Just the table. Search and filters live in the module header above, matching
 *  the generic module pages (ModulePage). */
function DocumentListBody({ rows, isLoading, nav }: BodyProps) {
  return (
    <>
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
