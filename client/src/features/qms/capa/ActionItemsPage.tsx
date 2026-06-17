import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ListChecks, Clock, CheckCircle2, Loader2, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import {
  Card,
  Button,
  DataTable,
  StatsCard,
  StatusBadge,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useAllActionItems } from './hooks';
import type { CAPAActionItem } from './hooks';

const STATUSES = ['', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'];
const TYPES = ['', 'CORRECTIVE', 'PREVENTIVE'];

export default function ActionItemsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { items, isLoading } = useAllActionItems();

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.description.toLowerCase().includes(q) &&
          !a.owner.toLowerCase().includes(q) &&
          !a.capaNumber.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [items, statusFilter, typeFilter, search]);

  const total = items.length;
  const pending = items.filter((a) => a.status === 'PENDING').length;
  const inProgress = items.filter((a) => a.status === 'IN_PROGRESS').length;
  const completed = items.filter((a) => a.status === 'COMPLETED' || a.status === 'VERIFIED').length;
  const overdue = items.filter(
    (a) => new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED' && a.status !== 'VERIFIED',
  ).length;

  // Clicking an action item routes to its parent CAPA and asks the detail page
  // to open the Actions tab with this action's modal already open.
  const openAction = (a: CAPAActionItem) =>
    navigate(`/qms/capa/${a.capaId}`, { state: { openActionId: a.id } });

  const columns: Column<CAPAActionItem>[] = [
    {
      key: 'capaNumber',
      header: 'CAPA',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.capaNumber}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.type === 'CORRECTIVE' ? 'info' : 'purple'}>{row.type}</Badge>
      ),
    },
    {
      key: 'description',
      header: 'Action',
      render: (row) => (
        <span className="block max-w-md truncate text-slate-700">{row.description}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => <span className="text-slate-600">{row.owner}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const isOverdue =
          new Date(row.dueDate) < new Date() &&
          row.status !== 'COMPLETED' &&
          row.status !== 'VERIFIED';
        return (
          <span className={cn('text-sm', isOverdue && 'text-red-600 font-semibold')}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Action Items</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every corrective &amp; preventive action across all CAPAs in one place
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToCSV(
              'action-items',
              ['CAPA', 'Type', 'Action', 'Owner', 'Due Date', 'Status'],
              filtered.map((a) => [a.capaNumber, a.type, a.description, a.owner, a.dueDate?.slice(0, 10) || '', a.status]),
            )
          }
        >
          <Download size={14} />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Actions"
          value={total}
          icon={ListChecks}
          iconColor="bg-navy-50 text-navy-600"
          onClick={() => { setStatusFilter(''); setTypeFilter(''); }}
        />
        <StatsCard
          title="In Progress"
          value={inProgress}
          icon={Loader2}
          iconColor="bg-sky-50 text-sky-600"
          onClick={() => setStatusFilter('IN_PROGRESS')}
        />
        <StatsCard
          title="Overdue"
          value={overdue}
          icon={Clock}
          iconColor="bg-red-50 text-red-600"
          onClick={() => setStatusFilter('PENDING')}
        />
        <StatsCard
          title="Completed"
          value={completed}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          onClick={() => setStatusFilter('COMPLETED')}
        />
      </div>

      {/* Filters + Table */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, owner or CAPA…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>{t || 'All Types'}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'All Statuses'}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : filtered.length > 0 ? (
          <DataTable columns={columns} data={filtered} onRowClick={openAction} />
        ) : (
          <div className="py-16 text-center">
            <ListChecks className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No action items match your filters</p>
          </div>
        )}
      </Card>
    </div>
  );
}
