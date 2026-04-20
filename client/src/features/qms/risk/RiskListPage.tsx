import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, ChevronDown } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  DataTable,
  StatsCard,
} from '@/components/ui';
import { Shield, AlertOctagon, TrendingUp, CalendarClock } from 'lucide-react';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useRisks, mockRisks, riskLevelBadge, calcRiskLevel } from './hooks';
import { useFiscalYearStore } from '@/stores/fiscalYearStore';
import type { RiskRecord, RiskLevel } from './hooks';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ── Constants ───────────────────────────────────────────────────────────────

const RISK_LEVELS: string[] = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DEPARTMENTS = ['', 'Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];
const CATEGORIES = ['', 'OPERATIONAL', 'SAFETY', 'QUALITY', 'ENVIRONMENTAL', 'FINANCIAL'];

const LIKELIHOOD_LABELS = ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare'];
const CONSEQUENCE_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'];

// ── Heat Map Helpers ────────────────────────────────────────────────────────

const getCellColor = (score: number) => {
  if (score >= 20) return 'bg-red-500 hover:bg-red-600 text-white';
  if (score >= 15) return 'bg-orange-400 hover:bg-orange-500 text-white';
  if (score >= 10) return 'bg-amber-400 hover:bg-amber-500 text-white';
  if (score >= 5) return 'bg-yellow-300 hover:bg-yellow-400 text-gray-800';
  return 'bg-green-400 hover:bg-green-500 text-white';
};

// ── Component ───────────────────────────────────────────────────────────────

export default function RiskListPage() {
  const navigate = useNavigate();
  const [levelFilter, setLevelFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [heatmapOpen, setHeatmapOpen] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ l: number; c: number } | null>(null);

  const filters = useMemo(
    () => ({
      riskLevel: levelFilter || undefined,
      department: deptFilter || undefined,
      category: catFilter || undefined,
      search: search || undefined,
    }),
    [levelFilter, deptFilter, catFilter, search],
  );

  const { year } = useFiscalYearStore();
  const { data: result, isLoading } = useRisks(filters);
  const risks = (result?.data ?? []).filter((r) => new Date((r as any).createdAt || '').getFullYear() === year);

  // ── Filtered risks (with heat map cell selection) ───────────────────────

  const filteredRisks = useMemo(
    () =>
      risks.filter(
        (r) => !selectedCell || (r.likelihood === selectedCell.l && r.consequence === selectedCell.c),
      ),
    [risks, selectedCell],
  );

  // ── Trend Data ──────────────────────────────────────────────────────────

  const trendData = [
    { month: 'Oct', open: 8, closed: 2, critical: 1 },
    { month: 'Nov', open: 10, closed: 4, critical: 2 },
    { month: 'Dec', open: 12, closed: 5, critical: 2 },
    { month: 'Jan', open: 9, closed: 7, critical: 1 },
    { month: 'Feb', open: 11, closed: 8, critical: 3 },
    {
      month: 'Mar',
      open: risks.length,
      closed: risks.filter((r: any) => r.status === 'CLOSED').length,
      critical: risks.filter((r: any) => r.riskScore >= 20).length,
    },
  ];

  // ── Table Columns ─────────────────────────────────────────────────────────

  const columns: Column<RiskRecord>[] = [
    {
      key: 'riskNumber',
      header: 'Risk Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.riskNumber}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => (
        <span className="block max-w-xs truncate font-medium text-slate-900">{row.title}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge variant="default">{row.category}</Badge>,
    },
    {
      key: 'likelihood',
      header: 'L',
      render: (row) => (
        <span className="font-mono text-xs font-medium text-slate-700">{row.likelihood}</span>
      ),
    },
    {
      key: 'consequence',
      header: 'C',
      render: (row) => (
        <span className="font-mono text-xs font-medium text-slate-700">{row.consequence}</span>
      ),
    },
    {
      key: 'riskScore',
      header: 'Score',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-900">{row.riskScore}</span>
      ),
    },
    {
      key: 'riskLevel',
      header: 'Risk Level',
      render: (row) => <Badge variant={riskLevelBadge(row.riskLevel)}>{row.riskLevel}</Badge>,
    },
    {
      key: 'controls',
      header: 'Controls',
      render: (row) => (
        <span className="text-sm text-slate-600">{row.controls.length}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => <span className="text-slate-600">{row.owner}</span>,
    },
    {
      key: 'reviewDate',
      header: 'Review Date',
      render: (row) => (
        <span className="text-sm text-slate-600">{formatDate(row.reviewDate)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Risk Register</h1>
          <p className="mt-1 text-sm text-slate-500">
            Identify, assess, and manage organizational risks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV('risks', ['Risk #', 'Title', 'Category', 'Likelihood', 'Consequence', 'RPN', 'Status'], risks.map(r => [r.riskNumber, r.title, r.category, r.likelihood, r.consequence, r.riskScore, r.riskLevel]))}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button onClick={() => navigate('/qms/risks/new')}>
            <Plus className="h-4 w-4" />
            Add Risk
          </Button>
        </div>
      </div>

      {/* Heat Map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setHeatmapOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-900">Risk Heat Map</span>
          <ChevronDown
            size={16}
            className={cn('text-gray-400 transition-transform duration-200', heatmapOpen && 'rotate-180')}
          />
        </button>
        {heatmapOpen && (
          <div className="px-5 pb-5">
            <div className="flex gap-1">
              {/* Y-axis label */}
              <div className="flex flex-col justify-center items-center w-6 gap-1">
                <span
                  className="text-[10px] text-gray-400"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  Likelihood →
                </span>
              </div>
              <div className="flex-1">
                {/* Column headers */}
                <div className="flex gap-1 mb-1 ml-16">
                  {CONSEQUENCE_LABELS.map((l, i) => (
                    <div key={i} className="flex-1 text-center text-[10px] text-gray-400 truncate">
                      {l}
                    </div>
                  ))}
                </div>
                {[5, 4, 3, 2, 1].map((likelihood, ri) => (
                  <div key={likelihood} className="flex items-center gap-1 mb-1">
                    <div className="w-16 text-right text-[10px] text-gray-400 pr-2 truncate">
                      {LIKELIHOOD_LABELS[ri]}
                    </div>
                    {[1, 2, 3, 4, 5].map((consequence) => {
                      const score = likelihood * consequence;
                      const count = risks.filter(
                        (r: any) => r.likelihood === likelihood && r.consequence === consequence,
                      ).length;
                      const isSelected =
                        selectedCell?.l === likelihood && selectedCell?.c === consequence;
                      return (
                        <button
                          key={consequence}
                          onClick={() =>
                            setSelectedCell(isSelected ? null : { l: likelihood, c: consequence })
                          }
                          className={cn(
                            'flex-1 h-10 rounded flex items-center justify-center text-sm font-bold transition-all duration-150 border-2',
                            getCellColor(score),
                            isSelected ? 'border-slate-900 scale-95' : 'border-transparent',
                          )}
                        >
                          {count > 0 ? count : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 justify-end flex-wrap">
              {[
                { color: 'bg-green-400', label: 'Low (1-4)' },
                { color: 'bg-yellow-300', label: 'Medium (5-9)' },
                { color: 'bg-amber-400', label: 'High (10-14)' },
                { color: 'bg-orange-400', label: 'Very High (15-19)' },
                { color: 'bg-red-500', label: 'Critical (20-25)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={cn('w-3 h-3 rounded', color)} />
                  <span className="text-[10px] text-gray-500">{label}</span>
                </div>
              ))}
            </div>
            {selectedCell && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                <span>
                  Showing risks with Likelihood = {selectedCell.l} and Consequence = {selectedCell.c}
                </span>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-slate-900 underline hover:no-underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Risk Trend Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Risk Trend (6 Months)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="open"
              stroke="#0a1628"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Open"
            />
            <Line
              type="monotone"
              dataKey="closed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Closed"
            />
            <Line
              type="monotone"
              dataKey="critical"
              stroke="#ef4444"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ r: 3 }}
              name="Critical"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search risks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Risk Levels</option>
            {RISK_LEVELS.filter(Boolean).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.filter(Boolean).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Categories</option>
            {CATEGORIES.filter(Boolean).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredRisks}
            onRowClick={(row) => navigate(`/qms/risks/${row.id}`)}
            emptyMessage="No risks match your filters"
          />
        )}
      </Card>
    </div>
  );
}
