import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { App } from 'antd';
import {
  Plus,
  Search,
  Filter as FilterIcon,
  Download,
  Loader2,
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
  XCircle,
  History,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  GitBranch,
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
  Modal,
} from '@/components/ui';
import type { KpiAccent } from '@/components/ui';
import PageContainer from '@/components/layout/PageContainer';
import { cn, formatDate, displayWorkflowName } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useBookmarkStore } from '@/stores/bookmarkStore';
import {
  useDeleteTicket,
  useTickets,
  ticketOutcome,
  isClosed,
  isCompletedSuccessfully,
  type TicketSummary,
} from '@/lib/api/ticket';
import { useTicketChildren } from '@/lib/api/finding';
import { useWorkflowDirectory } from '@/lib/api/workflow';
import {
  usePriorities,
  useWorkflowTypes,
} from '@/lib/api/workflowLookups';
import RaiseTicketDrawer from '@/features/tickets/shared/RaiseTicketDrawer';
import { downloadTicketReport } from '@/features/tickets/report/downloadTicketReport';
import ModuleAnalytics from './analytics';
import ModuleFindingsRegister from './ModuleFindingsRegister';

type KpiId = 'mine' | 'department' | 'createdByMe' | 'all' | 'pending' | 'saved';
type Tab = 'dashboard' | 'workspace' | 'findings';
type StatusView = 'all' | 'open' | 'overdue' | 'onhold' | 'completed';

const STATUS_VIEW_LABEL: Record<StatusView, string> = {
  all: 'All records',
  open: 'Active / open',
  overdue: 'Overdue',
  onhold: 'On hold',
  completed: 'Completed',
};

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
  { id: 'mine',        label: 'My Records',            icon: FileText, accent: 'blue'    },
  { id: 'department',  label: 'My Department Records', icon: Users,    accent: 'emerald' },
  { id: 'createdByMe', label: 'Created By Me',         icon: UserIcon, accent: 'slate'   },
  { id: 'all',         label: 'All Records',           icon: ListIcon, accent: 'amber'   },
  { id: 'pending',     label: 'Pending',               icon: Clock,    accent: 'orange'  },
  { id: 'saved',       label: 'Saved Records',         icon: Bookmark, accent: 'rose'    },
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
  // Strictly per-type gating. The global `ticket.*` master was retired
  // (docs/per-module-ticket-master-plan.md, Phase 3-4) — the only key that grants
  // a ticket action is `wf_type.<typeId>.<action>`.
  const canForType = (action: string) => hasPermission(`wf_type.${typeId}.${action}`);
  const canCreate = canForType('create');
  const canDelete = canForType('delete');
  // Findings register is gated by the per-type `finding.<id>.read` key, separate
  // from ticket access (see lib/rbac-findings.ts).
  const canReadFindings = hasPermission(`finding.${typeId}.read`);
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
  // Drill-through target set when a KPI card on the Overview is clicked.
  const [statusView, setStatusView] = useState<StatusView | null>(null);
  const [showAllKpis, setShowAllKpis] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 250);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [priorityId, setPriorityId] = useState<string>('');
  const [workflowFilterId, setWorkflowFilterId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);

  // Reset state when switching modules — honoring a ?tab= deep-link.
  useEffect(() => {
    setTab(
      embedded || searchParams.get('tab') === 'workspace' ? 'workspace' : 'dashboard',
    );
    setActiveKpi(null);
    setSearchInput('');
    setPriorityId('');
    setWorkflowFilterId('');
    setStatusView(null);
  }, [typeId, searchParams, embedded]);

  // Overview KPI card → jump to the My Tasks list filtered to that slice.
  const handleDrill = (view: StatusView) => {
    setActiveKpi(null);
    setStatusView(view);
    setTab('workspace');
  };

  // Single fetch for the module — KPIs and table are derived from this.
  // Backend caps pageSize at 200; KPI counts beyond that will under-report.
  const { data, isLoading, error } = useTickets({
    workflowTypeId: typeId || undefined,
    status: 'all',
    pageSize: 200,
  });
  const allTickets = useMemo(() => data?.items ?? [], [data]);

  const { data: priorities = [] } = usePriorities();
  const { data: workflowsData } = useWorkflowDirectory(typeId || undefined);
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
      pending:     allTickets.filter((t) => !isClosed(t)).length,
      saved:       allTickets.filter((t) => bookmarks.isBookmarked(t.id)).length,
    };
  }, [allTickets, user, bookmarks]);

  // "My Workspace" = tickets the user can act on. We treat that as: I created it,
  // OR it's in my department, OR I have a broad transition permission (so admins
  // who don't author tickets still see something useful instead of an empty list).
  const isWorkspaceWideViewer = canForType('transition');

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
          list = list.filter((t) => !isClosed(t));
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

    // Drill-through from an Overview KPI card (Active / Overdue / …).
    if (statusView && statusView !== 'all') {
      list = list.filter((t) => {
        // `isCompleted` is true for rejected flows too, so "completed" has to
        // ask for a successful finish or the tile counts rejections as wins.
        const outcome = ticketOutcome(t);
        const completed = outcome === 'completed' || outcome === 'rejected';
        switch (statusView) {
          case 'open':      return !completed;
          case 'completed': return outcome === 'completed';
          case 'onhold':    return !completed && t.isOnHold;
          case 'overdue':
            return !completed && !!t.dueDate && new Date(t.dueDate).getTime() < Date.now();
          default:          return true;
        }
      });
    }

    return list;
  }, [allTickets, tab, activeKpi, search, priorityId, workflowFilterId, statusView, user, bookmarks, isWorkspaceWideViewer]);

  // Paginate the visible table (10 / page). The KPI counts still come from the
  // full `allTickets` set, so they stay accurate regardless of the page shown.
  const TABLE_PAGE_SIZE = 10;
  const tableTotalPages = Math.max(1, Math.ceil(filtered.length / TABLE_PAGE_SIZE));
  useEffect(() => {
    setTablePage(1);
  }, [activeKpi, search, priorityId, workflowFilterId, statusView, tab]);
  const pagedTickets = useMemo(
    () => filtered.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE),
    [filtered, tablePage],
  );

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
            case 'stage':      return t.flows[0]?.currentStages[0]?.name
                                 ?? (ticketOutcome(t) === 'rejected' ? 'Rejected'
                                   : ticketOutcome(t) === 'completed' ? 'Completed' : '—');
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

  const showCreate = canCreate;

  // Scope cards hidden while collapsed: the ones beyond the first 4. Module
  // performance KPIs (Active, Overdue, Closure rate, …) now live inside the
  // Overview analytics panel, so they're no longer duplicated here.
  const hiddenKpiCount = Math.max(0, KPI_DEFS.length - 4);

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

  // Shared controls reused by both the embedded compact bar and the full hero.
  const searchField = (
    <div className="relative w-60">
      <Search
        size={15}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
      />
      <Input
        placeholder="Search requests…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-10 !rounded-full"
      />
    </div>
  );

  const filterButton = (
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
  );

  const body = (
    <>
      {embedded ? (
        /* ── Embedded compact bar (e.g. Audit → My Tasks) ─────────────── */
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {searchField}
          </div>
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {filterButton}
            {(tab === 'workspace' || activeKpi) && tableToolbar}
          </div>
        </div>
      ) : (
        /* ── Full hero header card ─────────────────────────────────────── */
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-gold-500">
          <div className="px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Identity + tabs share the top row. */}
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <WorkflowIcon size={18} />
                </span>
                <h1 className="text-[15px] font-bold text-gray-900 tracking-tight truncate leading-none">
                  {moduleName}
                </h1>
                {codePrefix && (
                  <span className="text-[10px] font-mono font-bold text-gold-700 bg-gold-50 ring-1 ring-gold-200 px-1.5 py-0.5 rounded-md shrink-0">
                    {codePrefix}
                  </span>
                )}
                <div className="h-6 w-px bg-gray-200 shrink-0 hidden md:block" />
                <div className="w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -my-1">
                  <nav className="inline-flex gap-1.5 p-1 rounded-lg bg-gray-100/80 ring-1 ring-gray-200/60">
                    <TabButton
                      active={tab === 'dashboard'}
                      onClick={() => setTab('dashboard')}
                      icon={<LayoutDashboard size={14} />}
                      label="Overview"
                    />
                    <TabButton
                      active={tab === 'workspace'}
                      onClick={() => setTab('workspace')}
                      icon={<Briefcase size={14} />}
                      label="My Tasks"
                    />
                    {workflowType?.supportsFindings && canReadFindings && (
                      <TabButton
                        active={tab === 'findings'}
                        onClick={() => setTab('findings')}
                        icon={<AlertTriangle size={14} />}
                        label="Findings"
                      />
                    )}
                  </nav>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {searchField}
                {filterButton}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTab('dashboard');
                    setActiveKpi(null);
                    setSearchInput('');
                  }}
                >
                  <History size={14} />
                  <span className="ml-1.5">Recent Records</span>
                </Button>
                {/* Create lives on the My Tasks tab only — the Overview tab is
                    read-only reporting. */}
                {showCreate && tab === 'workspace' && (
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
                    <span className="ml-1.5">New {moduleName}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Overview tab: purely the module analytics panel ─────────────── */}
      {tab === 'dashboard' && (
        <div className="mt-4">
          <ModuleAnalytics tickets={allTickets} moduleName={moduleName} onDrill={handleDrill} />
        </div>
      )}

      {/* ── Findings register (findings-enabled modules) ────────────────── */}
      {tab === 'findings' && typeId && canReadFindings && (
        <ModuleFindingsRegister workflowTypeId={typeId} />
      )}

      {/* ── My Tasks tab: scope quick-filter cards above the ticket list ── */}
      {/* First 4 scopes on one row; Pending / Saved revealed by "Show more".
          Clicking a card filters the table below. */}
      {tab === 'workspace' && !embedded && (
        <div className="mt-4">
          <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
            {(showAllKpis ? KPI_DEFS : KPI_DEFS.slice(0, 4)).map((k) => (
              <div key={k.id} className="flex-1 min-w-[168px]">
                <KpiCard
                  label={k.label}
                  value={kpiCounts[k.id]}
                  icon={k.icon}
                  accent={k.accent}
                  selected={activeKpi === k.id}
                  onClick={() => setActiveKpi((prev) => (prev === k.id ? null : k.id))}
                />
              </div>
            ))}
            {hiddenKpiCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllKpis((v) => !v)}
                className="shrink-0 inline-flex flex-col items-center justify-center gap-1 w-[92px] rounded-xl border border-dashed border-gray-300 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                {showAllKpis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span className="text-[11px] font-medium">
                  {showAllKpis ? 'Show less' : `+${hiddenKpiCount} more`}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Toolbar (Download + Customize Columns) — own row on the full page;
           embedded mode renders these in the header row above instead. ──── */}
      {!embedded && tab === 'workspace' && (
        <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
          {tableToolbar}
        </div>
      )}

      <Modal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={`Filter ${moduleName}`}
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasFilter}
              onClick={() => {
                setPriorityId('');
                setWorkflowFilterId('');
              }}
            >
              <X size={13} />
              <span className="ml-1">Clear</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
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
        </div>
      </Modal>

      {/* Drill-through indicator — set when an Overview KPI card was clicked. */}
      {tab === 'workspace' && statusView && (
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 border border-gold-200 px-3 py-1 text-[12px] font-medium text-gold-800">
            Showing: {STATUS_VIEW_LABEL[statusView]}
            <button
              type="button"
              onClick={() => setStatusView(null)}
              className="ml-0.5 text-gold-500 hover:text-gold-800"
              aria-label="Clear filter"
            >
              <X size={13} />
            </button>
          </span>
        </div>
      )}

      {/* ── Table (My Tasks tab) ────────────────────────────────────────── */}
      {tab === 'workspace' && (
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
                  ? showCreate
                    ? `Create the first ${moduleName} to get started.`
                    : `No ${moduleName} tickets yet.`
                  : 'Try clearing filters or switching tabs.'
              }
              actionLabel={
                allTickets.length === 0 && showCreate
                  ? `New ${moduleName}`
                  : 'Clear filters'
              }
              onAction={() => {
                if (allTickets.length === 0 && showCreate) {
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
            tickets={pagedTickets}
            moduleName={moduleName}
            visibleCols={visibleCols}
            isBookmarked={(id) => bookmarks.isBookmarked(id)}
            onToggleBookmark={(id) => bookmarks.toggle(id)}
            onView={(t) => navigate(`/tickets/${t.id}`)}
            onDelete={canDelete ? handleDelete : undefined}
            footer={
              filtered.length > TABLE_PAGE_SIZE ? (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-surface-secondary">
                  <p className="text-xs text-gray-500">
                    Showing {(tablePage - 1) * TABLE_PAGE_SIZE + 1}–
                    {Math.min(tablePage * TABLE_PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage === 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                    >
                      Prev
                    </button>
                    {Array.from({ length: tableTotalPages }, (_, i) => i + 1)
                      .slice(Math.max(0, tablePage - 3), Math.max(0, tablePage - 3) + 5)
                      .map((p) => (
                        <button
                          key={p}
                          onClick={() => setTablePage(p)}
                          className={cn(
                            'w-7 h-7 text-xs rounded border transition-colors',
                            p === tablePage
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 hover:bg-gray-100',
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    <button
                      onClick={() => setTablePage((p) => Math.min(tableTotalPages, p + 1))}
                      disabled={tablePage >= tableTotalPages}
                      className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null
            }
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
        'inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-semibold rounded-lg transition-all duration-150',
        active
          ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
          : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
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
  footer?: ReactNode;
}

function TicketTable({
  tickets,
  moduleName,
  visibleCols,
  isBookmarked,
  onToggleBookmark,
  onView,
  onDelete,
  footer,
}: TicketTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Ticket id currently being rendered to a PDF report (drives the row spinner
  // and prevents double-clicks).
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const handleDownloadReport = async (t: TicketSummary) => {
    if (downloadingId) return;
    setDownloadingId(t.id);
    const toastId = toast.loading(`Preparing ${t.uniqueId} report…`);
    try {
      await downloadTicketReport(t.id, t.uniqueId);
      toast.success('Report downloaded', { id: toastId });
    } catch (err) {
      console.error('Report generation failed', err);
      toast.error('Could not generate the report.', { id: toastId });
    } finally {
      setDownloadingId(null);
    }
  };

  const colSpan = visibleCols.size;
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
              const completed = isCompletedSuccessfully(t);
              const rejected = ticketOutcome(t) === 'rejected';
              const stageName = flow?.currentStages[0]?.name;
              const bookmarked = isBookmarked(t.id);
              const hasChildren = (t.childCount ?? 0) > 0;
              const isExpanded = expanded.has(t.id);
              return (
                <Fragment key={t.id}>
                <tr
                  onClick={() => onView(t)}
                  className={cn(
                    'border-b border-gray-100 cursor-pointer transition-colors',
                    rejected
                      ? 'bg-red-50/40 hover:bg-red-50/70'
                      : completed
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
                      <div className="flex items-center gap-1">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(t.id);
                            }}
                            className="p-0.5 -ml-1 rounded hover:bg-gray-200 text-gray-500"
                            title={isExpanded ? 'Hide child tickets' : `Show ${t.childCount} child ticket(s)`}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        ) : (
                          <span className="w-[18px]" />
                        )}
                        <span className="text-[12px] font-mono text-gray-700">{t.uniqueId}</span>
                      </div>
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
                      {rejected ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                          <XCircle size={11} />
                          Rejected
                        </span>
                      ) : completed ? (
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
                        {/* Report download is offered only once the ticket is
                            completed — an in-progress ticket has no final report. */}
                        {completed && (
                          <IconAction
                            icon={
                              downloadingId === t.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Download size={14} />
                              )
                            }
                            title="Download PDF report"
                            onClick={() => handleDownloadReport(t)}
                            subtle
                          />
                        )}
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
                {hasChildren && isExpanded && (
                  <ChildTicketRows parentId={t.id} colSpan={colSpan} />
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </Card>
  );
}

// Lazily-loaded child ticket rows shown indented under an expanded parent.
// Children may be a different workflow type (e.g. a CAPA under a Change Control
// ticket), so they aren't in the module's own list query.
function ChildTicketRows({ parentId, colSpan }: { parentId: string; colSpan: number }) {
  const navigate = useNavigate();
  const { data, isLoading } = useTicketChildren(parentId);
  const children = data?.data ?? [];

  if (isLoading) {
    return (
      <tr className="bg-gray-50/60">
        <td colSpan={colSpan} className="px-4 py-2 pl-12 text-[12px] text-gray-400">
          Loading child tickets…
        </td>
      </tr>
    );
  }
  if (children.length === 0) return null;
  return (
    <>
      {children.map((c) => (
        <tr
          key={c.id}
          onClick={() => navigate(c.capa_id ? `/audit/capa/${c.capa_id}` : `/tickets/${c.id}`)}
          className="border-b border-gray-100 bg-gray-50/60 cursor-pointer hover:bg-gray-100/70"
        >
          <td colSpan={colSpan} className="px-4 py-2">
            <div className="flex items-center gap-2 pl-8">
              <GitBranch size={13} className="text-emerald-500 shrink-0" />
              <span className="text-[12px] font-mono text-emerald-700">
                {c.capa_number ?? c.unique_id}
              </span>
              <span className="text-sm text-gray-800 truncate">{c.title}</span>
              {c.module && (
                <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  {c.module}
                </span>
              )}
              {c.stage && <span className="text-[11px] text-gray-500">· {c.stage}</span>}
            </div>
          </td>
        </tr>
      ))}
    </>
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
