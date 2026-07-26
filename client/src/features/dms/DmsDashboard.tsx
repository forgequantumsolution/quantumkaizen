/**
 * DMS dashboard — a real, document-driven overview of the controlled-document
 * library. Every figure is derived from live documents (no demo data); when the
 * library is empty the charts show honest empty states.
 */
import { useMemo, useState } from 'react';
import { Select } from 'antd';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, ClipboardList,
  SlidersHorizontal, RotateCcw,
} from 'lucide-react';
import { Card, KpiCard } from '@/components/ui';
import {
  useDocuments, DOC_TYPE_LABELS,
  type DocSummary, type DocumentStatus, type DocumentType,
} from '@/lib/api/dms';

const PALETTE = {
  draft: '#94A3B8',
  inReview: '#F59E0B',
  approved: '#6366F1',
  effective: '#22C55E',
  superseded: '#64748B',
  retired: '#EF4444',
  blue: '#3B82F6',
  gold: '#C9A84C',
  cyan: '#06B6D4',
  breached: '#EF4444',
  amber: '#F59E0B',
  emerald: '#10B981',
  slate: '#64748B',
};

const TT_STYLE = {
  borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '6px 10px', backgroundColor: '#fff',
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const STATUS_META: Record<DocumentStatus, { label: string; color: string }> = {
  DRAFT:      { label: 'Draft',      color: PALETTE.draft },
  IN_REVIEW:  { label: 'In Review',  color: PALETTE.inReview },
  APPROVED:   { label: 'Approved',   color: PALETTE.approved },
  EFFECTIVE:  { label: 'Effective',  color: PALETTE.effective },
  SUPERSEDED: { label: 'Superseded', color: PALETTE.superseded },
  RETIRED:    { label: 'Retired',    color: PALETTE.retired },
};

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

interface Slice { name: string; value: number; color?: string }

interface Filters { status?: DocumentStatus; type?: DocumentType; department?: string }

export default function DmsDashboard() {
  // Pull the whole library for aggregation (dashboard-scale, not paginated view).
  const { data, isLoading } = useDocuments({ page_size: 500 });
  const allDocs = data?.data ?? [];
  const [filters, setFilters] = useState<Filters>({});

  // Filter options — derived live from the document library.
  const options = useMemo(() => {
    const uniq = (vals: Array<string | null | undefined>) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      statuses: uniq(allDocs.map((d) => d.status)) as DocumentStatus[],
      types: uniq(allDocs.map((d) => d.type)) as DocumentType[],
      departments: uniq(allDocs.map((d) => d.department_name)),
    };
  }, [allDocs]);

  const docs = useMemo(
    () =>
      allDocs.filter(
        (d) =>
          (!filters.status || d.status === filters.status) &&
          (!filters.type || d.type === filters.type) &&
          (!filters.department || d.department_name === filters.department),
      ),
    [allDocs, filters],
  );

  const activeFilters = Object.values(filters).filter(Boolean).length;

  const m = useMemo(() => {
    // Status donut
    const statusCounts = new Map<DocumentStatus, number>();
    for (const d of docs) statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
    const status: Slice[] = (Object.keys(STATUS_META) as DocumentStatus[])
      .map((s) => ({ name: STATUS_META[s].label, value: statusCounts.get(s) ?? 0, color: STATUS_META[s].color }))
      .filter((d) => d.value > 0);

    // By type
    const typeCounts = new Map<string, number>();
    for (const d of docs) {
      const label = DOC_TYPE_LABELS[d.type] ?? d.type;
      typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
    }
    const byType: Slice[] = Array.from(typeCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // By department (top 6)
    const deptCounts = new Map<string, number>();
    for (const d of docs) {
      const name = d.department_name ?? 'Unassigned';
      deptCounts.set(name, (deptCounts.get(name) ?? 0) + 1);
    }
    const byDept: Slice[] = Array.from(deptCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // Periodic-review posture (effective docs with a review_due_date)
    let overdue = 0, dueSoon = 0, scheduled = 0, noDate = 0;
    for (const d of docs) {
      if (d.status !== 'EFFECTIVE') continue;
      if (!d.review_due_date) { noDate++; continue; }
      const days = daysSince(d.review_due_date); // >0 => past due
      if (days > 0) overdue++;
      else if (days > -30) dueSoon++;
      else scheduled++;
    }
    const review: Slice[] = [
      { name: 'Overdue', value: overdue, color: PALETTE.breached },
      { name: 'Due ≤ 30d', value: dueSoon, color: PALETTE.amber },
      { name: 'Scheduled', value: scheduled, color: PALETTE.emerald },
      { name: 'No review date', value: noDate, color: PALETTE.slate },
    ].filter((d) => d.value > 0);

    // Authoring trend — docs created per month (last 6mo)
    const now = new Date();
    const trend = [] as Array<{ month: string; created: number }>;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({ month: MONTHS[d.getMonth()]!, created: 0 });
    }
    for (const d of docs) {
      const mb = (now.getFullYear() - new Date(d.created_at).getFullYear()) * 12 +
        (now.getMonth() - new Date(d.created_at).getMonth());
      const idx = 5 - mb;
      if (idx >= 0 && idx < 6) trend[idx]!.created++;
    }

    const effective = statusCounts.get('EFFECTIVE') ?? 0;
    const inReview = statusCounts.get('IN_REVIEW') ?? 0;

    return {
      status, byType, byDept, review, trend,
      kpi: { total: docs.length, effective, inReview, overdue },
    };
  }, [docs]);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-gray-400">Loading document library…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Dynamic filter bar — options derived from the document library */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
          <SlidersHorizontal size={13} /> Filters
        </span>
        <Select size="small" allowClear placeholder="Status" style={{ width: 150 }}
          value={filters.status} onChange={(v?: DocumentStatus) => setFilters((f) => ({ ...f, status: v }))}
          options={options.statuses.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
        <Select size="small" allowClear placeholder="Type" style={{ width: 160 }}
          value={filters.type} onChange={(v?: DocumentType) => setFilters((f) => ({ ...f, type: v }))}
          options={options.types.map((t) => ({ value: t, label: DOC_TYPE_LABELS[t] ?? t }))} />
        <Select size="small" allowClear placeholder="Department" style={{ width: 160 }}
          value={filters.department} onChange={(v?: string) => setFilters((f) => ({ ...f, department: v }))}
          options={options.departments.map((d) => ({ value: d, label: d }))} />
        {activeFilters > 0 && (
          <button onClick={() => setFilters({})}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1">
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={FileText} label="Total documents" value={`${m.kpi.total}`} accent="blue" />
        <KpiCard icon={CheckCircle2} label="Effective" value={`${m.kpi.effective}`} accent="emerald" />
        <KpiCard icon={Clock} label="In review" value={`${m.kpi.inReview}`} accent="amber" />
        <KpiCard icon={AlertTriangle} label="Review overdue" value={`${m.kpi.overdue}`} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Lifecycle status" subtitle="Whole controlled-document library">
          <Donut data={m.status} />
        </ChartCard>

        <ChartCard title="Periodic review posture" subtitle="Effective documents vs their review-due date">
          <Donut data={m.review} />
        </ChartCard>

        <ChartCard title="By document type">
          <VBar data={m.byType} color={PALETTE.gold} />
        </ChartCard>

        <ChartCard title="By department" subtitle="Top 6">
          <HBar data={m.byDept} color={PALETTE.cyan} />
        </ChartCard>

        <ChartCard title="Authoring activity" subtitle="Documents created — last 6 months">
          {m.trend.some((t) => t.created > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={m.trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gDoc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="created" name="Created" stroke={PALETTE.blue} fill="url(#gDoc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Primitives ────────────────────────────────────────────────────────────
function Empty({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <ClipboardList size={18} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function Donut({ data }: { data: Slice[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color ?? PALETTE.blue} />)}
        </Pie>
        <Tooltip contentStyle={TT_STYLE} />
        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function VBar({ data, color }: { data: Slice[]; color: string }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Documents" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HBar({ data, color }: { data: Slice[]; color: string }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={140} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Documents" fill={color} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="!p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function Chip({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'blue' | 'emerald' | 'red' | 'amber' }) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${tones[tone]}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide font-medium opacity-80">{label}</div>
        <div className="text-lg font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
}
