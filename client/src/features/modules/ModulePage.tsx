import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { App } from 'antd';
import {
  Plus,
  Search,
  Filter as FilterIcon,
  Download,
  Settings2,
  LayoutDashboard,
  Briefcase,
  Bookmark,
  BookmarkCheck,
  Eye,
  Trash2,
  Clock,
  Users,
  User as UserIcon,
  List as ListIcon,
  FileText,
  Workflow as WorkflowIcon,
  AlertTriangle,
  CheckCircle2,
  History,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Card,
  Button,
  EmptyState,
  Spinner,
  Input,
  Select,
  KpiCard,
} from '@/components/ui';
import type { KpiAccent } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import {
  useDeleteTicket,
  useTickets,
  type TicketSummary,
} from '@/lib/api/ticket';
import { useWorkflows } from '@/lib/api/workflow';
import {
  usePriorities,
  useWorkflowTypes,
} from '@/lib/api/workflowLookups';
import RaiseTicketDrawer from '@/features/tickets/shared/RaiseTicketDrawer';
import ModuleDashboard from './ModuleDashboard';

type KpiId = 'mine' | 'department' | 'createdByMe' | 'all' | 'pending' | 'saved';
type Tab = 'dashboard' | 'workspace';

interface ColumnConfig {
  id: string;
  label: string;
  required?: boolean;
}

const COLUMN_CONFIG: ColumnConfig[] = [
  { id: 'bookmark', label: 'Bookmark', required: true },
  { id: 'uniqueId', label: 'ID', required: true },
  { id: 'createdAt', label: 'Created Date' },
  { id: 'process', label: 'Process Name' },
  { id: 'title', label: 'Title', required: true },
  { id: 'stage', label: 'Current Stage' },
  { id: 'department', label: 'Department' },
  { id: 'actions', label: 'Action', required: true },
];

const DEFAULT_VISIBLE = new Set(COLUMN_CONFIG.map((c) => c.id));

const KPI_DEFS: Array<{
  id: KpiId;
  label: string;
  icon: LucideIcon;
  accent: KpiAccent;
}> = [
  { id: 'mine',        label: 'My PR',            icon: FileText, accent: 'blue'    },
  { id: 'department',  label: 'My Department PR', icon: Users,    accent: 'emerald' },
  { id: 'createdByMe', label: 'Created By Me',    icon: UserIcon, accent: 'slate'   },
  { id: 'all',         label: 'All PR',           icon: ListIcon, accent: 'amber'   },
  { id: 'pending',     label: 'Pending',          icon: Clock,    accent: 'orange'  },
  { id: 'saved',       label: 'Saved PR',         icon: Bookmark, accent: 'rose'    },
];

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const relativeDays = (iso: string): string => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
};

interface ModulePageProps {
  /** Override the workflow type id (when not taken from the URL :typeId param). */
  typeId?: string;
  /** Embedded mode — render inside another layout (e.g. the Audit module tabs):
   *  no PageContainer, no title, no Dashboard/Workspace sub-tabs; locked to the
   *  workspace ticket list. */
  embedded?: boolean;
}

export default function ModulePage({
  typeId: propTypeId,
  embedded = false,
}: ModulePageProps = {}) {
  const params = useParams<{ typeId: string }>();
  const typeId = propTypeId ?? params.typeId ?? '';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreate = hasPermission('ticket.create');
  const canDelete = hasPermission('ticket.delete');
  const deleteTicket = useDeleteTicket();
  const { modal } = App.useApp();
  const bookmarks = useBookmarkStore();

  const { data: types = [], isLoading: loadingTypes } = useWorkflowTypes();
  const workflowType = useMemo(
    () => types.find((t) => t.id === typeId),
    [types, typeId],
  );

  // Allow deep-linking straight to the workspace (e.g. the Audit module's
  // "My Workspace" tab links here with ?tab=workspace).
  const initialTab: Tab =
    embedded || searchParams.get('tab') === 'workspace' ? 'workspace' : 'dashboard';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [activeKpi, setActiveKpi] = useState<KpiId | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 250);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [priorityId, setPriorityId] = useState<string>('');
  const [workflowFilterId, setWorkflowFilterId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);

  // Reset state when switching modules — honoring a ?tab= deep-link.
  useEffect(() => {
    setTab(
      embedded || searchParams.get('tab') === 'workspace' ? 'workspace' : 'dashboard',
    );
    setActiveKpi(null);
    setSearchInput('');
    setPriorityId('');
    setWorkflowFilterId('');
  }, [typeId, searchParams, embedded]);

  // Single fetch for the module — KPIs and table are derived from this.
  // Backend caps pageSize at 200; KPI counts beyond that will under-report.
  const { data, isLoading, error } = useTickets({
    workflowTypeId: typeId || undefined,
    status: 'all',
    pageSize: 200,
  });
  const allTickets = useMemo(() => data?.items ?? [], [data]);

  const { data: priorities = [] } = usePriorities();
  const { data: workflowsData } = useWorkflows({
    status: 'ACTIVE',
    typeId: typeId || undefined,
    pageSize: 100,
  });
  const typeWorkflows = workflowsData?.items ?? [];

  // KPI counts
  const kpiCounts = useMemo(() => {
    const myId = user?.id;
    const myDept = user?.department;
    return {
      mine:        allTickets.filter((t) => t.createdBy?.id === myId).length,
      department:  myDept ? allTickets.filter((t) => t.department?.name === myDept).length : 0,
      createdByMe: allTickets.filter((t) => t.createdBy?.id === myId).length,
      all:         allTickets.length,
      pending:     allTickets.filter((t) => !t.flows[0]?.isCompleted).length,
      saved:       allTickets.filter((t) => bookmarks.isBookmarked(t.id)).length,
    };
  }, [allTickets, user, bookmarks]);

  // "My Workspace" = tickets the user can act on. We treat that as: I created it,
  // OR it's in my department, OR I have a broad transition permission (so admins
  // who don't author tickets still see something useful instead of an empty list).
  const isWorkspaceWideViewer = hasPermission('ticket.transition');

  // Filtering pipeline: tab → kpi → search → priority → workflow
  const filtered = useMemo(() => {
    let list = allTickets;

    if (tab === 'workspace' && !isWorkspaceWideViewer) {
      const myId = user?.id;
      const myDept = user?.department;
      list = list.filter(
        (t) =>
          (myId && t.createdBy?.id === myId) ||
          (myDept && t.department?.name === myDept),
      );
    }

    if (activeKpi) {
      const myId = user?.id;
      const myDept = user?.department;
      switch (activeKpi) {
        case 'mine':
        case 'createdByMe':
          list = list.filter((t) => t.createdBy?.id === myId);
          break;
        case 'department':
          list = myDept ? list.filter((t) => t.department?.name === myDept) : [];
          break;
        case 'all':
          break;
        case 'pending':
          list = list.filter((t) => !t.flows[0]?.isCompleted);
          break;
        case 'saved':
          list = list.filter((t) => bookmarks.isBookmarked(t.id));
          break;
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.uniqueId.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q),
      );
    }

    if (priorityId) {
      list = list.filter((t) => t.priority?.id === priorityId);
    }

    if (workflowFilterId) {
      list = list.filter((t) => t.flows.some((f) => f.workflowId === workflowFilterId));
    }

    return list;
  }, [allTickets, tab, activeKpi, search, priorityId, workflowFilterId, user, bookmarks, isWorkspaceWideViewer]);

  const handleDelete = (t: TicketSummary) => {
    modal.confirm({
      title: 'Delete ticket',
      content: `Are you sure you want to delete ${t.uniqueId}?`,
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await deleteTicket.mutateAsync(t.id);
          toast.success('Ticket deleted');
        } catch (err) {
          const msg =
            (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
              ?.error?.message ?? 'Failed to delete';
          toast.error(msg);
        }
      },
    });
  };

  const handleDownload = () => {
    const cols = COLUMN_CONFIG.filter((c) => visibleCols.has(c.id) && c.id !== 'bookmark' && c.id !== 'actions');
    const header = cols.map((c) => c.label).join(',');
    const rows = filtered.map((t) =>
      cols
        .map((c) => {
          switch (c.id) {
            case 'uniqueId':   return t.uniqueId;
            case 'createdAt':  return formatDate(t.createdAt);
            case 'process':    return moduleName;
            case 'title':      return JSON.stringify(t.title);
            case 'stage':      return t.flows[0]?.currentStages[0]?.name ?? (t.flows[0]?.isCompleted ? 'Completed' : '—');
            case 'department': return t.department?.name ?? '';
            default:           return '';
          }
        })
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(workflowType?.name ?? 'tickets').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loadingTypes && !workflowType) {
    return (
      <PageContainer>
        <Card className="border-dashed">
          <EmptyState
            icon={WorkflowIcon}
            title="Module not found"
            description="This workflow type doesn't exist or has been removed."
            actionLabel="Back to Dashboard"
            onAction={() => navigate('/dashboard')}
          />
        </Card>
      </PageContainer>
    );
  }

  const moduleName = workflowType?.name ?? 'Module';
  const codePrefix = workflowType?.codePrefix;
  const hasFilter = !!priorityId || !!workflowFilterId;

  // Download + Customize Columns — shown on its own row on the full page, but
  // tucked to the right of the header row when embedded (Audit My Workspace).
  const tableToolbar = (
    <>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download size={14} />
        <span className="ml-1.5">Download</span>
      </Button>
      <div className="relative">
        <Button variant="outline" size="sm" onClick={() => setColumnsOpen((v) => !v)}>
          <Settings2 size={14} />
          <span className="ml-1.5">Customize Columns</span>
        </Button>
        {columnsOpen && (
          <ColumnsPopover
            visible={visibleCols}
            onToggle={(id) => {
              setVisibleCols((s) => {
                const next = new Set(s);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            onClose={() => setColumnsOpen(false)}
          />
        )}
      </div>
    </>
  );

  const body = (
    <>
      {/* ── Top header (title + search + filter + buttons) ──────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {!embedded && (
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {moduleName}
          </h1>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <Input
              placeholder="Search requests…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={hasFilter ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilterOpen((v) => !v)}
          >
            <FilterIcon size={14} />
            <span className="ml-1.5">Filter</span>
            {hasFilter && (
              <span className="ml-1.5 bg-white/30 text-white text-[10px] font-semibold rounded-full w-4 h-4 inline-flex items-center justify-center">
                {(priorityId ? 1 : 0) + (workflowFilterId ? 1 : 0)}
              </span>
            )}
          </Button>
          {!embedded && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard size={14} />
              <span className="ml-1.5">View Dashboard</span>
            </Button>
          )}
          {!embedded && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setTab('dashboard');
                setActiveKpi(null);
                setSearchInput('');
              }}
            >
              <History size={14} />
              <span className="ml-1.5">Recent {moduleName} Details</span>
            </Button>
          )}
          {!embedded && canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={typeWorkflows.length === 0}
              title={
                typeWorkflows.length === 0
                  ? `No active ${moduleName} workflows yet — create one first.`
                  : undefined
              }
            >
              <Plus size={14} />
              <span className="ml-1.5">Initiate {moduleName}</span>
            </Button>
          )}
        </div>

        {/* Embedded: keep the table toolbar on the same row, pushed right. */}
        {embedded && (tab === 'workspace' || activeKpi) && (
          <div className="flex items-center gap-2 flex-wrap ml-auto">{tableToolbar}</div>
        )}
      </div>

      {/* ── Sub-tabs ────────────────────────────────────────────────────── */}
      {!embedded && (
        <div className="mt-3 border-b border-gray-200 flex items-center gap-1">
          <TabButton
            active={tab === 'dashboard'}
            onClick={() => setTab('dashboard')}
            icon={<LayoutDashboard size={14} />}
            label="Dashboard"
          />
          <TabButton
            active={tab === 'workspace'}
            onClick={() => setTab('workspace')}
            icon={<Briefcase size={14} />}
            label="My Workspace"
          />
          {codePrefix && (
            <span className="ml-auto text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mb-1.5">
              {codePrefix}
            </span>
          )}
        </div>
      )}

      {tab === 'dashboard' && (
        <>
          {/* ── KPI cards ───────────────────────────────────────────────── */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {KPI_DEFS.map((k) => (
              <KpiCard
                key={k.id}
                label={k.label}
                value={kpiCounts[k.id]}
                icon={k.icon}
                accent={k.accent}
                selected={activeKpi === k.id}
                onClick={() => setActiveKpi((prev) => (prev === k.id ? null : k.id))}
              />
            ))}
          </div>

          {/* ── Module dashboard (charts) ──────────────────────────────── */}
          {!activeKpi && (
            <div className="mt-4">
              <ModuleDashboard tickets={allTickets} moduleName={moduleName} />
            </div>
          )}
        </>
      )}

      {/* ── Toolbar (Download + Customize Columns) — own row on the full page;
           embedded mode renders these in the header row above instead. ──── */}
      {!embedded && (tab === 'workspace' || activeKpi) && (
        <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
          {tableToolbar}
        </div>
      )}

      {filterOpen && (
        <Card className="!p-3 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Priority
              </label>
              <Select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                placeholder="Any priority"
                options={[
                  { value: '', label: 'Any priority' },
                  ...priorities.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
            </div>
            <div className="md:col-span-5">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">
                Workflow
              </label>
              <Select
                value={workflowFilterId}
                onChange={(e) => setWorkflowFilterId(e.target.value)}
                placeholder="Any workflow"
                options={[
                  { value: '', label: 'Any workflow' },
                  ...typeWorkflows.map((w) => ({
                    value: w.id,
                    label: displayWorkflowName(w),
                  })),
                ]}
              />
            </div>
            <div className="md:col-span-3 flex gap-2">
              {hasFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPriorityId('');
                    setWorkflowFilterId('');
                  }}
                >
                  <X size={12} />
                  <span className="ml-1">Clear</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterOpen(false)}
                className="ml-auto"
              >
                Done
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Table (workspace tab, or when a KPI is filtered) ────────────── */}
      {(tab === 'workspace' || activeKpi) && (
      <div className="mt-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : error ? (
          <Card>
            <p className="text-sm text-red-600">Failed to load tickets.</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <EmptyState
              icon={FileText}
              title={`No ${moduleName} tickets`}
              description={
                allTickets.length === 0
                  ? canCreate
                    ? `Initiate the first ${moduleName} to get started.`
                    : `No ${moduleName} tickets yet.`
                  : 'Try clearing filters or switching tabs.'
              }
              actionLabel={
                allTickets.length === 0 && canCreate
                  ? `Initiate ${moduleName}`
                  : 'Clear filters'
              }
              onAction={() => {
                if (allTickets.length === 0 && canCreate) {
                  setCreateOpen(true);
                } else {
                  setActiveKpi(null);
                  setPriorityId('');
                  setWorkflowFilterId('');
                  setSearchInput('');
                  setTab('dashboard');
                }
              }}
            />
          </Card>
        ) : (
          <TicketTable
            tickets={filtered}
            moduleName={moduleName}
            visibleCols={visibleCols}
            isBookmarked={(id) => bookmarks.isBookmarked(id)}
            onToggleBookmark={(id) => bookmarks.toggle(id)}
            onView={(t) => navigate(`/tickets/${t.id}`)}
            onDelete={canDelete ? handleDelete : undefined}
          />
        )}
      </div>
      )}

      <RaiseTicketDrawer
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        workflowTypeId={typeId}
      />
    </>
  );

  // Embedded (e.g. inside the Audit module tabs) skips its own PageContainer so
  // it nests under the host layout cleanly.
  return embedded ? body : <PageContainer>{body}</PageContainer>;
}

/* ── Helper components ───────────────────────────────────────────────── */

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        active
          ? 'text-blue-600 border-blue-500'
          : 'text-gray-500 border-transparent hover:text-gray-800',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

interface ColumnsPopoverProps {
  visible: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}

function ColumnsPopover({ visible, onToggle, onClose }: ColumnsPopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white rounded-lg shadow-lg border border-gray-200 p-2">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide px-2 py-1">
          Columns
        </div>
        {COLUMN_CONFIG.map((c) => {
          const isVisible = visible.has(c.id);
          return (
            <label
              key={c.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer',
                c.required ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
              )}
            >
              <input
                type="checkbox"
                checked={isVisible}
                disabled={c.required}
                onChange={() => onToggle(c.id)}
                className="rounded"
              />
              <span className="text-gray-700">{c.label}</span>
            </label>
          );
        })}
      </div>
    </>
  );
}

interface TicketTableProps {
  tickets: TicketSummary[];
  moduleName: string;
  visibleCols: Set<string>;
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (id: string) => void;
  onView: (t: TicketSummary) => void;
  onDelete?: (t: TicketSummary) => void;
}

function TicketTable({
  tickets,
  moduleName,
  visibleCols,
  isBookmarked,
  onToggleBookmark,
  onView,
  onDelete,
}: TicketTableProps) {
  return (
    <Card noPadding className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {visibleCols.has('bookmark') && <Th className="w-10" />}
              {visibleCols.has('uniqueId') && <Th>ID</Th>}
              {visibleCols.has('createdAt') && <Th>Created Date</Th>}
              {visibleCols.has('process') && <Th>Process Name</Th>}
              {visibleCols.has('title') && <Th>Title</Th>}
              {visibleCols.has('stage') && <Th>Current Stage</Th>}
              {visibleCols.has('department') && <Th>Department</Th>}
              {visibleCols.has('actions') && <Th className="w-32 text-center">Action</Th>}
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const flow = t.flows[0];
              const completed = !!flow?.isCompleted;
              const stageName = flow?.currentStages[0]?.name;
              const bookmarked = isBookmarked(t.id);
              return (
                <tr
                  key={t.id}
                  onClick={() => onView(t)}
                  className={cn(
                    'border-b border-gray-100 cursor-pointer transition-colors',
                    completed
                      ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                      : 'hover:bg-gray-50',
                  )}
                >
                  {visibleCols.has('bookmark') && (
                    <Td>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(t.id);
                        }}
                        className="p-1 rounded hover:bg-gray-100"
                        title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
                      >
                        {bookmarked ? (
                          <BookmarkCheck size={14} className="text-amber-500 fill-amber-400" />
                        ) : (
                          <Bookmark size={14} className="text-gray-400" />
                        )}
                      </button>
                    </Td>
                  )}
                  {visibleCols.has('uniqueId') && (
                    <Td>
                      <span className="text-[12px] font-mono text-gray-700">
                        {t.uniqueId}
                      </span>
                    </Td>
                  )}
                  {visibleCols.has('createdAt') && (
                    <Td>
                      <div className="text-sm text-gray-700">{formatDate(t.createdAt)}</div>
                      <div className="text-[11px] text-gray-400">{relativeDays(t.createdAt)}</div>
                    </Td>
                  )}
                  {visibleCols.has('process') && (
                    <Td>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <AlertTriangle size={11} />
                        {moduleName}
                      </span>
                    </Td>
                  )}
                  {visibleCols.has('title') && (
                    <Td className="max-w-md">
                      <div className="text-sm text-gray-900 line-clamp-2">{t.title}</div>
                    </Td>
                  )}
                  {visibleCols.has('stage') && (
                    <Td>
                      {completed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={11} />
                          Completed
                        </span>
                      ) : stageName ? (
                        <span className="inline-flex items-center text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                          {stageName}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </Td>
                  )}
                  {visibleCols.has('department') && (
                    <Td>
                      <span className="text-xs text-gray-700 truncate">
                        {t.department?.name ?? '—'}
                      </span>
                    </Td>
                  )}
                  {visibleCols.has('actions') && (
                    <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <IconAction
                          icon={<Eye size={14} />}
                          title="View"
                          onClick={() => onView(t)}
                        />
                        <IconAction
                          icon={<Download size={14} />}
                          title="Download"
                          onClick={() => {
                            const blob = new Blob(
                              [JSON.stringify(t, null, 2)],
                              { type: 'application/json' },
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${t.uniqueId}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          subtle
                        />
                        {onDelete && (
                          <IconAction
                            icon={<Trash2 size={14} />}
                            title="Delete"
                            onClick={() => onDelete(t)}
                            danger
                          />
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-4 py-2.5',
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  onClick,
}: {
  children?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td className={cn('px-4 py-3 align-middle', className)} onClick={onClick}>
      {children}
    </td>
  );
}

interface IconActionProps {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  subtle?: boolean;
}

function IconAction({ icon, title, onClick, danger, subtle }: IconActionProps) {
  const cls = danger
    ? 'text-red-500 hover:bg-red-50'
    : subtle
      ? 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn('p-1.5 rounded transition-colors', cls)}
    >
      {icon}
    </button>
  );
}
