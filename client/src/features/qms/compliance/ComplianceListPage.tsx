import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  DataTable,
  StatsCard,
  Badge,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import { formatDate } from '@/lib/utils';
import { lookupBadge } from '@/lib/badgeMap';
import {
  useComplianceRequirements,
  mockRequirements,
  mockIATFRequirements,
  mockISO14001Requirements,
  mockISO45001Requirements,
} from './hooks';
import type { ComplianceRequirement, ComplianceStatus } from './hooks';

// Mock data kept only as an offline fallback in the hook.
// Tabs + metrics now come from live backend data (see the hook calls below).
const ALL_TAB_ID = 'ALL';

function getStatusBadge(status: ComplianceStatus | string) {
  const c = lookupBadge(
    {
      COMPLIANT: { variant: 'success', label: 'Compliant' },
      NON_COMPLIANT: { variant: 'danger', label: 'Non-Compliant' },
      PARTIAL: { variant: 'warning', label: 'Partial' },
      NOT_ASSESSED: { variant: 'default', label: 'Not Assessed' },
    },
    status,
  );
  return <Badge variant={c.variant as any}>{c.label}</Badge>;
}

function ComplianceProgressBar({ requirements }: { requirements: ComplianceRequirement[] }) {
  const total = requirements.length;
  if (total === 0) return null;
  const compliant = requirements.filter((r) => r.status === 'COMPLIANT').length;
  const partial = requirements.filter((r) => r.status === 'PARTIAL').length;
  const nonCompliant = requirements.filter((r) => r.status === 'NON_COMPLIANT').length;
  const percentage = Math.round(((compliant + partial * 0.5) / total) * 100);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">Overall Compliance</span>
        <span className="text-sm font-bold text-slate-900">{percentage}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(compliant / total) * 100}%` }}
        />
        <div
          className="h-full bg-amber-400 transition-all duration-500"
          style={{ width: `${(partial / total) * 100}%` }}
        />
        <div
          className="h-full bg-red-400 transition-all duration-500"
          style={{ width: `${(nonCompliant / total) * 100}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Compliant ({compliant})
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Partial ({partial})
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Non-Compliant ({nonCompliant})
        </span>
      </div>
    </div>
  );
}

export default function ComplianceListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB_ID);
  const [search, setSearch] = useState('');

  // Always fetch the full set for totals + tab counts. The per-tab filter is
  // applied client-side below so switching tabs is instant and counts stay
  // accurate even when the list is paginated server-side.
  const { data: result, isLoading } = useComplianceRequirements(undefined);
  const allRequirements: ComplianceRequirement[] = result?.data ?? [];

  const standardTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of allRequirements) counts.set(r.standard, (counts.get(r.standard) ?? 0) + 1);
    const perStandard = Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: id, count }));
    return [{ id: ALL_TAB_ID, label: 'All', count: allRequirements.length }, ...perStandard];
  }, [allRequirements]);

  const requirements =
    activeTab === ALL_TAB_ID
      ? allRequirements
      : allRequirements.filter((r) => r.standard === activeTab);

  const filteredRequirements = useMemo(() => {
    if (!search) return requirements;
    const q = search.toLowerCase();
    return requirements.filter(
      (r) =>
        r.clauseNumber.toLowerCase().includes(q) ||
        r.clauseTitle.toLowerCase().includes(q),
    );
  }, [requirements, search]);

  // Dashboard metrics (across all standards)
  const totalReqs = allRequirements.length || 1;
  const compliantCount = allRequirements.filter((r) => r.status === 'COMPLIANT').length;
  const compliantPct = Math.round((compliantCount / totalReqs) * 100);
  const nonCompliantCount = allRequirements.filter((r) => r.status === 'NON_COMPLIANT').length;
  const dueForReview = allRequirements.filter((r) => {
    if (!r.nextReview) return false;
    const next = new Date(r.nextReview);
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return next <= thirtyDays;
  }).length;

  const columns: Column<ComplianceRequirement>[] = [
    {
      key: 'clauseNumber',
      header: 'Clause',
      render: (row) => (
        <span className="font-mono text-sm font-semibold text-navy-700">{row.clauseNumber}</span>
      ),
    },
    {
      key: 'clauseTitle',
      header: 'Clause Title',
      render: (row) => (
        <span className="block max-w-xs truncate font-medium text-slate-900">{row.clauseTitle}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'linkedProcedures',
      header: 'Linked Procedures',
      render: (row) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.linkedProcedures.slice(0, 2).map((proc, i) => (
            <Badge key={i} variant="outline">{proc.split(' ')[0]}</Badge>
          ))}
          {row.linkedProcedures.length > 2 && (
            <Badge variant="default">+{row.linkedProcedures.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'lastAssessed',
      header: 'Last Assessed',
      render: (row) => <span className="text-sm text-slate-500">{formatDate(row.lastAssessed)}</span>,
    },
    {
      key: 'nextReview',
      header: 'Next Review',
      render: (row) => {
        const overdue = new Date(row.nextReview) < new Date();
        return (
          <span className={overdue ? 'text-sm font-semibold text-red-600' : 'text-sm text-slate-500'}>
            {formatDate(row.nextReview)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track regulatory and standards compliance across your quality management system
        </p>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Requirements"
          value={totalReqs}
          icon={Shield}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="Compliant"
          value={`${compliantPct}%`}
          icon={CheckCircle2}
          iconColor="bg-emerald-50 text-emerald-600"
          trend={{ value: 3, label: 'vs last quarter' }}
        />
        <StatsCard
          title="Non-Compliant"
          value={nonCompliantCount}
          icon={XCircle}
          iconColor="bg-red-50 text-red-600"
        />
        <StatsCard
          title="Due for Review"
          value={dueForReview}
          icon={Clock}
          iconColor="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Requirements Table */}
      <Card noPadding>
        <div className="px-5 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Tabs tabs={standardTabs} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="relative ml-4 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search clauses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              />
            </div>
          </div>

          <ComplianceProgressBar requirements={requirements} />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRequirements}
            onRowClick={(row) => navigate(`/qms/compliance/${row.id}`)}
            emptyMessage="No requirements found"
          />
        )}
      </Card>
    </div>
  );
}
