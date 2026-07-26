/**
 * DMS dashboard — a real, document-driven overview of the controlled-document
 * library. Every figure is derived from live documents (no demo data); when the
 * library is empty the charts show honest empty states.
 */
import { useEffect, useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, ClipboardList,
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

/** Display labels for every document status, so callers rendering a status
 *  picker (the page's header Filter) don't reinvent the wording. */
export const DOC_STATUS_LABELS: Record<DocumentStatus, string> = Object.fromEntries(
  (Object.keys(STATUS_META) as DocumentStatus[]).map((s) => [s, STATUS_META[s].label]),
) as Record<DocumentStatus, string>;

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/** Server-enforced maximum for `page_size` on /dms/documents — see the request
 *  schema in backend/src/modules/dms/dms.schema.ts. Requesting more is a 400,
 *  not a clamp, so this must not drift above the server's limit. */
const DASHBOARD_PAGE_SIZE = 200;

interface Slice { name: string; value: number; color?: string }

export interface DmsDashboardFilters {
  status?: DocumentStatus;
  type?: DocumentType;
  department?: string;
}

/** Facet values present in the library — the page renders the filter controls
 *  in the module header, so it needs the options this component derives. */
export interface DmsDashboardOptions {
  statuses: DocumentStatus[];
  types: DocumentType[];
  departments: string[];
}

interface Props {
  /** Controlled by the page so the controls can live in the module header. */
  filters: DmsDashboardFilters;
  /** Fired when the derived facet lists change, so the header can offer them. */
  onOptionsChange?: (options: DmsDashboardOptions) => void;
}

export default function DmsDashboard({ filters, onOptionsChange }: Props) {
  // Pull the library for aggregation (dashboard-scale, not paginated view).
  // 200 is the server's hard cap on page_size (dms.schema.ts) — asking for more
  // fails validation with a 400 and the whole dashboard renders empty.
  const { data, isLoading } = useDocuments({ page_size: DASHBOARD_PAGE_SIZE });
  const allDocs = data?.data ?? [];
  // Aggregations below cover the first 200 documents only. Say so rather than
  // presenting a truncated count as if it were the whole library.
  const truncated = (data?.total ?? 0) > allDocs.length;

  // Filter options — derived live from the document library.
  const options = useMemo<DmsDashboardOptions>(() => {
    const uniq = (vals: Array<string | null | undefined>) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      statuses: uniq(allDocs.map((d) => d.status)) as DocumentStatus[],
      types: uniq(allDocs.map((d) => d.type)) as DocumentType[],
      departments: uniq(allDocs.map((d) => d.department_name)),
    };
  }, [allDocs]);

  // Hand the facets up once they settle. Keyed on the memo, so this fires only
  // when the library actually changes — not on every filter keystroke.
  useEffect(() => {
    onOptionsChange?.(options);
  }, [options, onOptionsChange]);

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

    // ── Review-due horizon — when the periodic-review workload actually lands.
    // The posture donut says how many are late; this says which months are
    // about to get busy, which is the question a QA lead plans against.
    const horizon: Array<{ month: string; due: number }> = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      horizon.push({ month: `${MONTHS[d.getMonth()]!} ${String(d.getFullYear()).slice(2)}`, due: 0 });
    }
    let horizonOverdue = 0;
    for (const d of docs) {
      if (d.status !== 'EFFECTIVE' || !d.review_due_date) continue;
      const due = new Date(d.review_due_date);
      const mb =
        (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth());
      if (mb < 0) horizonOverdue++;
      else if (mb < 12) horizon[mb]!.due++;
    }

    // ── Status mix per department — where drafts and reviews are piling up.
    const deptNames = byDept.map((d) => d.name);
    const statusByDept = deptNames.map((name) => {
      const row: Record<string, string | number> = { name };
      for (const s of Object.keys(STATUS_META) as DocumentStatus[]) row[STATUS_META[s].label] = 0;
      for (const d of docs) {
        if ((d.department_name ?? 'Unassigned') !== name) continue;
        const label = STATUS_META[d.status].label;
        row[label] = (row[label] as number) + 1;
      }
      return row;
    });
    // Only chart the statuses that actually occur, or the legend fills with zeros.
    const statusSeries = (Object.keys(STATUS_META) as DocumentStatus[])
      .filter((s) => (statusCounts.get(s) ?? 0) > 0)
      .map((s) => ({ key: STATUS_META[s].label, color: STATUS_META[s].color }));

    // ── Age of the in-force library. A shelf of documents effective for years
    // without revision is a finding waiting to happen.
    const ageBuckets = [
      { name: '< 6 mo', value: 0 },
      { name: '6–12 mo', value: 0 },
      { name: '1–2 yr', value: 0 },
      { name: '> 2 yr', value: 0 },
    ];
    for (const d of docs) {
      if (d.status !== 'EFFECTIVE' || !d.effective_date) continue;
      const days = daysSince(d.effective_date);
      if (days < 182) ageBuckets[0]!.value++;
      else if (days < 365) ageBuckets[1]!.value++;
      else if (days < 730) ageBuckets[2]!.value++;
      else ageBuckets[3]!.value++;
    }
    const age: Slice[] = ageBuckets.filter((b) => b.value > 0);

    // ── Revision depth — how much churn the library carries.
    const revBuckets = [
      { name: 'Rev 1', value: 0 },
      { name: 'Rev 2', value: 0 },
      { name: 'Rev 3', value: 0 },
      { name: 'Rev 4+', value: 0 },
    ];
    for (const d of docs) {
      const v = d.version_count || 1;
      revBuckets[Math.min(v, 4) - 1]!.value++;
    }
    const revisions: Slice[] = revBuckets.filter((b) => b.value > 0);

    // ── Ownership concentration — a single owner holding most of the library
    // is a continuity risk.
    const ownerCounts = new Map<string, number>();
    for (const d of docs) {
      const name = d.owner_name ?? 'Unassigned';
      ownerCounts.set(name, (ownerCounts.get(name) ?? 0) + 1);
    }
    const byOwner: Slice[] = Array.from(ownerCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const effective = statusCounts.get('EFFECTIVE') ?? 0;
    const inReview = statusCounts.get('IN_REVIEW') ?? 0;

    return {
      status, byType, byDept, review, trend,
      horizon, horizonOverdue, statusByDept, statusSeries, age, revisions, byOwner,
      kpi: { total: docs.length, effective, inReview, overdue },
    };
  }, [docs]);

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-gray-400">Loading document library…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Dynamic filter bar — options derived from the document library */}
      {/* No filter row here — Status / Type / Department are rendered by the
          page's header Filter button, right-aligned with every other module. */}

      {truncated && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle size={12} className="shrink-0" />
          Showing the first {allDocs.length} of {data?.total} documents — figures
          below cover that subset, not the whole library.
        </div>
      )}

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

        <ChartCard
          title="Review-due horizon"
          subtitle={
            m.horizonOverdue > 0
              ? `Next 12 months · ${m.horizonOverdue} already overdue and not counted below`
              : 'Effective documents by the month their review falls due — next 12 months'
          }
        >
          {m.horizon.some((h) => h.due > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.horizon} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-35} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="due" name="Reviews due" fill={PALETTE.amber} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty label="No reviews scheduled in the next 12 months" />}
        </ChartCard>

        <ChartCard title="Status mix by department" subtitle="Where drafts and reviews are accumulating — top 6">
          {m.statusByDept.length > 0 && m.statusSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.statusByDept} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={140} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconType="circle" iconSize={8} />
                {m.statusSeries.map((s) => (
                  <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </ChartCard>

        <ChartCard title="Age of in-force documents" subtitle="Time since each effective document took force">
          <VBar data={m.age} color={PALETTE.emerald} />
        </ChartCard>

        <ChartCard title="Revision depth" subtitle="How many versions each document has been through">
          <VBar data={m.revisions} color={PALETTE.blue} />
        </ChartCard>

        <ChartCard title="By owner" subtitle="Ownership concentration — top 6">
          <HBar data={m.byOwner} color={PALETTE.gold} />
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

