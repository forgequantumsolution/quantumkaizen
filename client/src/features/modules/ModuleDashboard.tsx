/**
 * Per-module dashboard — renders a chart/KPI layout tailored to the module
 * (CAPA, Change Control, Deviation, Complaint, OOS, Document Review, …) using
 * ONLY real data derived from the module's own tickets. There is no demo /
 * fallback data: sparse modules show honest empty states so every number on
 * screen is real and specific to that module.
 *
 * A module is matched to a "profile" by its name; unknown modules get a solid
 * generic profile. The profile decides the accent colour, which KPI chips are
 * shown, and which charts appear — so each module reads as a purpose-built
 * dashboard rather than a shared template.
 */
import { useMemo, useState } from 'react';
import { Select } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  CheckCircle2,
  TrendingUp,
  Activity as ActivityIcon,
  AlertTriangle,
  PauseCircle,
  Timer,
  ClipboardList,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import type { KpiAccent } from '@/components/ui';
import type { TicketSummary } from '@/lib/api/ticket';

interface Props {
  tickets: TicketSummary[];
  moduleName: string;
  /** Show the inline indicator strip. ModulePage sets this false because it
   * hoists the same indicators into its top KPI strip. Defaults to true. */
  showIndicators?: boolean;
}

const PALETTE = {
  open: '#3B82F6',
  inProgress: '#F59E0B',
  completed: '#22C55E',
  onHold: '#F97316',
  breached: '#EF4444',
  slate: '#64748B',
  gold: '#C9A84C',
  blue: '#3B82F6',
  emerald: '#10B981',
  pink: '#EC4899',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  rose: '#F43F5E',
  amber: '#F59E0B',
  indigo: '#6366F1',
};

const TT_STYLE = {
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '6px 10px',
  backgroundColor: '#fff',
};

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CLASSIFICATION_LABELS: Record<string, string> = {
  PRODUCT: 'Product',
  PROCESS: 'Process',
  SYSTEM: 'System',
  EQUIPMENT: 'Equipment',
  DOCUMENTATION: 'Documentation',
  TRAINING: 'Training',
  OTHER: 'Other',
};

// ─── Profiles ──────────────────────────────────────────────────────────────
type AccentKey = keyof typeof PALETTE;
type ChartKey =
  | 'status' | 'trend' | 'priority' | 'severity' | 'classification'
  | 'department' | 'site' | 'stage' | 'aging' | 'due';
type KpiKey =
  | 'active' | 'completed' | 'closureRate' | 'overdue' | 'onHold'
  | 'avgAge' | 'created6mo' | 'total';

interface Profile {
  accent: AccentKey;
  kpis: KpiKey[];
  charts: ChartKey[];
}

const DEFAULT_PROFILE: Profile = {
  accent: 'blue',
  kpis: ['active', 'closureRate', 'overdue', 'created6mo'],
  charts: ['status', 'trend', 'stage', 'priority', 'department', 'aging'],
};

// keyword → profile. First keyword found in the normalised module name wins.
const PROFILE_RULES: Array<{ match: string[]; profile: Profile }> = [
  {
    match: ['capa', 'correctiveaction', 'preventiveaction'],
    profile: {
      accent: 'emerald',
      kpis: ['active', 'overdue', 'closureRate', 'avgAge'],
      charts: ['status', 'trend', 'stage', 'severity', 'due', 'aging'],
    },
  },
  {
    match: ['changecontrol', 'changerequest', 'change'],
    profile: {
      accent: 'purple',
      kpis: ['active', 'overdue', 'closureRate', 'onHold'],
      charts: ['status', 'trend', 'stage', 'classification', 'priority', 'department'],
    },
  },
  {
    match: ['deviation', 'incident'],
    profile: {
      accent: 'rose',
      kpis: ['active', 'overdue', 'avgAge', 'onHold'],
      charts: ['status', 'trend', 'severity', 'classification', 'aging', 'department'],
    },
  },
  {
    match: ['complaint', 'grievance'],
    profile: {
      accent: 'pink',
      kpis: ['active', 'overdue', 'avgAge', 'closureRate'],
      charts: ['status', 'trend', 'severity', 'classification', 'aging', 'department'],
    },
  },
  {
    match: ['oos', 'outofspec', 'oot'],
    profile: {
      accent: 'amber',
      kpis: ['active', 'overdue', 'closureRate', 'avgAge'],
      charts: ['status', 'trend', 'severity', 'stage', 'aging', 'department'],
    },
  },
  {
    match: ['nonconform', 'ncr', 'scar'],
    profile: {
      accent: 'indigo',
      kpis: ['active', 'overdue', 'avgAge', 'closureRate'],
      charts: ['status', 'trend', 'severity', 'classification', 'stage', 'aging'],
    },
  },
  {
    match: ['documentreview', 'document', 'sop', 'dms'],
    profile: {
      accent: 'blue',
      kpis: ['active', 'overdue', 'closureRate', 'created6mo'],
      charts: ['status', 'trend', 'stage', 'department', 'due', 'aging'],
    },
  },
  {
    match: ['audit', 'inspection'],
    profile: {
      accent: 'gold',
      kpis: ['active', 'overdue', 'closureRate', 'avgAge'],
      charts: ['status', 'trend', 'severity', 'stage', 'department', 'aging'],
    },
  },
  {
    match: ['risk'],
    profile: {
      accent: 'rose',
      kpis: ['active', 'overdue', 'avgAge', 'onHold'],
      charts: ['status', 'trend', 'severity', 'classification', 'department', 'aging'],
    },
  },
  {
    match: ['supplier', 'vendor'],
    profile: {
      accent: 'cyan',
      kpis: ['active', 'overdue', 'closureRate', 'avgAge'],
      charts: ['status', 'trend', 'stage', 'department', 'aging', 'due'],
    },
  },
];

function profileFor(moduleName: string): Profile {
  const norm = moduleName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const rule of PROFILE_RULES) {
    if (rule.match.some((k) => norm.includes(k))) return rule.profile;
  }
  return DEFAULT_PROFILE;
}

// ─── Shared indicator computation ────────────────────────────────────────────
// Exposed so the parent (ModulePage) can hoist these summary KPIs into its top
// strip instead of rendering them separately below the filters. Computed from
// the full ticket list — nothing static.
export interface ModuleKpiChip {
  key: KpiKey;
  icon: LucideIcon;
  label: string;
  value: string;
  accent: KpiAccent;
}

export function computeModuleKpiChips(
  tickets: TicketSummary[],
  moduleName: string,
): ModuleKpiChip[] {
  const profile = profileFor(moduleName);
  const open = tickets.filter((t) => !isCompleted(t));
  const completedList = tickets.filter(isCompleted);
  const onHold = open.filter((t) => t.isOnHold).length;
  let overdue = 0;
  let ageSum = 0;
  for (const t of open) {
    ageSum += daysSince(t.createdAt);
    if (t.dueDate && daysSince(t.dueDate) > 0) overdue++;
  }
  const total = tickets.length;
  const closureRate = total === 0 ? 0 : Math.round((completedList.length / total) * 100);
  const avgAge = open.length === 0 ? 0 : Math.round(ageSum / open.length);
  const now = new Date();
  const created6mo = tickets.filter((t) => {
    const b =
      (now.getFullYear() - new Date(t.createdAt).getFullYear()) * 12 +
      (now.getMonth() - new Date(t.createdAt).getMonth());
    return b >= 0 && b < 6;
  }).length;

  const defs: Record<KpiKey, ModuleKpiChip> = {
    active:      { key: 'active',      icon: ActivityIcon,  label: 'Active',         value: `${open.length}`,          accent: 'blue'    },
    completed:   { key: 'completed',   icon: CheckCircle2,  label: 'Completed',      value: `${completedList.length}`, accent: 'emerald' },
    closureRate: { key: 'closureRate', icon: CheckCircle2,  label: 'Closure rate',   value: `${closureRate}%`,         accent: 'emerald' },
    overdue:     { key: 'overdue',     icon: AlertTriangle, label: 'Overdue',        value: `${overdue}`,              accent: 'red'     },
    onHold:      { key: 'onHold',      icon: PauseCircle,   label: 'On hold',        value: `${onHold}`,               accent: 'amber'   },
    avgAge:      { key: 'avgAge',      icon: Timer,         label: 'Avg age (open)', value: `${avgAge}d`,              accent: 'amber'   },
    created6mo:  { key: 'created6mo',  icon: TrendingUp,    label: 'Created (6mo)',  value: `${created6mo}`,           accent: 'blue'    },
    total:       { key: 'total',       icon: ClipboardList, label: 'Total records',  value: `${total}`,                accent: 'blue'    },
  };
  return profile.kpis.map((k) => defs[k]);
}

// ─── Metrics ────────────────────────────────────────────────────────────────
interface Slice { name: string; value: number; color?: string }

function isCompleted(t: TicketSummary): boolean {
  return !!t.flows[0]?.isCompleted;
}
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function ticketStatus(t: TicketSummary): 'Open' | 'In Progress' | 'On Hold' | 'Completed' {
  if (isCompleted(t)) return 'Completed';
  if (t.isOnHold) return 'On Hold';
  if (t.flows[0]?.currentStages.length) return 'In Progress';
  return 'Open';
}

interface Filters {
  status?: string;
  priority?: string;
  department?: string;
  site?: string;
  severity?: string;
}

export default function ModuleDashboard({ tickets, moduleName, showIndicators = true }: Props) {
  const profile = useMemo(() => profileFor(moduleName), [moduleName]);
  const accent = PALETTE[profile.accent];
  const [filters, setFilters] = useState<Filters>({});

  // Filter options — derived live from this module's own tickets.
  const options = useMemo(() => {
    const uniq = (vals: Array<string | null | undefined>) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      status: uniq(tickets.map(ticketStatus)),
      priority: uniq(tickets.map((t) => t.priority?.name)),
      department: uniq(tickets.map((t) => t.department?.name)),
      site: uniq(tickets.map((t) => t.site?.name)),
      severity: uniq(tickets.map((t) => t.severity?.name)),
    };
  }, [tickets]);

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!filters.status || ticketStatus(t) === filters.status) &&
          (!filters.priority || t.priority?.name === filters.priority) &&
          (!filters.department || t.department?.name === filters.department) &&
          (!filters.site || t.site?.name === filters.site) &&
          (!filters.severity || t.severity?.name === filters.severity),
      ),
    [tickets, filters],
  );

  const m = useMemo(() => {
    const open = filtered.filter((t) => !isCompleted(t));
    const completedList = filtered.filter(isCompleted);

    // Status donut
    let statusOpen = 0, inProg = 0, onHold = 0;
    for (const t of open) {
      if (t.isOnHold) onHold++;
      else if (t.flows[0]?.currentStages.length) inProg++;
      else statusOpen++;
    }
    const status: Slice[] = [
      { name: 'Open', value: statusOpen, color: PALETTE.open },
      { name: 'In Progress', value: inProg, color: PALETTE.inProgress },
      { name: 'On Hold', value: onHold, color: PALETTE.onHold },
      { name: 'Completed', value: completedList.length, color: PALETTE.completed },
    ].filter((d) => d.value > 0);

    // Trend — last 6 months, created vs completed
    const now = new Date();
    const trend = [] as Array<{ month: string; created: number; completed: number }>;
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      trend.push({ month: MONTH_LABELS[d.getMonth()]!, created: 0, completed: 0 });
    }
    const monthsBack = (iso: string) =>
      (now.getFullYear() - new Date(iso).getFullYear()) * 12 +
      (now.getMonth() - new Date(iso).getMonth());
    for (const t of filtered) {
      const ci = 5 - monthsBack(t.createdAt);
      if (ci >= 0 && ci < 6) trend[ci]!.created++;
      if (isCompleted(t)) {
        const ui = 5 - monthsBack(t.updatedAt);
        if (ui >= 0 && ui < 6) trend[ui]!.completed++;
      }
    }

    const countBy = (key: (t: TicketSummary) => string | null | undefined): Slice[] => {
      const counts = new Map<string, number>();
      for (const t of filtered) {
        const name = key(t);
        if (!name) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    const priority = countBy((t) => t.priority?.name);
    const severity = countBy((t) => t.severity?.name);
    const classification = countBy((t) =>
      t.classification ? CLASSIFICATION_LABELS[t.classification] ?? t.classification : null,
    );
    const department = countBy((t) => t.department?.name).slice(0, 6);
    const site = countBy((t) => t.site?.name).slice(0, 6);
    const stage = countBy((t) => t.flows[0]?.currentStages[0]?.name).slice(0, 6);

    // Aging — open tickets by age since creation
    const agingBuckets = [
      { name: '0-7 days', value: 0, color: PALETTE.emerald },
      { name: '8-30 days', value: 0, color: PALETTE.amber },
      { name: '31-90 days', value: 0, color: PALETTE.onHold },
      { name: '90+ days', value: 0, color: PALETTE.breached },
    ];
    let ageSum = 0;
    for (const t of open) {
      const days = daysSince(t.createdAt);
      ageSum += days;
      if (days <= 7) agingBuckets[0]!.value++;
      else if (days <= 30) agingBuckets[1]!.value++;
      else if (days <= 90) agingBuckets[2]!.value++;
      else agingBuckets[3]!.value++;
    }
    const aging = agingBuckets.filter((b) => b.value > 0);

    // Due-date posture for open tickets
    let overdue = 0, dueSoon = 0, onTrack = 0, noDue = 0;
    for (const t of open) {
      if (!t.dueDate) { noDue++; continue; }
      const d = daysSince(t.dueDate); // positive => past due
      if (d > 0) overdue++;
      else if (d > -7) dueSoon++;
      else onTrack++;
    }
    const due: Slice[] = [
      { name: 'Overdue', value: overdue, color: PALETTE.breached },
      { name: 'Due ≤ 7d', value: dueSoon, color: PALETTE.amber },
      { name: 'On track', value: onTrack, color: PALETTE.emerald },
      { name: 'No due date', value: noDue, color: PALETTE.slate },
    ].filter((d) => d.value > 0);

    const total = filtered.length;
    const closureRate = total === 0 ? 0 : Math.round((completedList.length / total) * 100);
    const avgAge = open.length === 0 ? 0 : Math.round(ageSum / open.length);
    const created6mo = trend.reduce((s, b) => s + b.created, 0);

    return {
      status, trend, priority, severity, classification, department, site, stage, aging, due,
      kpi: {
        active: open.length,
        completed: completedList.length,
        closureRate,
        overdue,
        onHold,
        avgAge,
        created6mo,
        total,
      },
    };
  }, [filtered]);

  const activeFilters = Object.values(filters).filter(Boolean).length;
  const set = (key: keyof Filters) => (v?: string) =>
    setFilters((f) => ({ ...f, [key]: v || undefined }));

  // ─── KPI chip definitions ──────────────────────────────────────────────
  const kpiDefs: Record<KpiKey, { icon: React.ReactNode; label: string; value: string; tone: ChipTone }> = {
    active:      { icon: <ActivityIcon size={14} />, label: 'Active',        value: `${m.kpi.active}`,         tone: 'blue' },
    completed:   { icon: <CheckCircle2 size={14} />, label: 'Completed',     value: `${m.kpi.completed}`,      tone: 'emerald' },
    closureRate: { icon: <CheckCircle2 size={14} />, label: 'Closure rate',  value: `${m.kpi.closureRate}%`,   tone: 'emerald' },
    overdue:     { icon: <AlertTriangle size={14} />, label: 'Overdue',      value: `${m.kpi.overdue}`,        tone: 'red' },
    onHold:      { icon: <PauseCircle size={14} />,  label: 'On hold',       value: `${m.kpi.onHold}`,         tone: 'amber' },
    avgAge:      { icon: <Timer size={14} />,        label: 'Avg age (open)', value: `${m.kpi.avgAge}d`,       tone: 'amber' },
    created6mo:  { icon: <TrendingUp size={14} />,   label: 'Created (6mo)',  value: `${m.kpi.created6mo}`,     tone: 'blue' },
    total:       { icon: <ClipboardList size={14} />, label: 'Total records', value: `${m.kpi.total}`,         tone: 'blue' },
  };

  const optsFor = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

  return (
    <div className="space-y-4">
      {/* Dynamic filter bar — options derived from this module's records */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500">
          <SlidersHorizontal size={13} /> Filters
        </span>
        <Select size="small" allowClear placeholder="Status" style={{ width: 130 }}
          value={filters.status} onChange={set('status')} options={optsFor(options.status)} />
        <Select size="small" allowClear placeholder="Priority" style={{ width: 130 }}
          value={filters.priority} onChange={set('priority')} options={optsFor(options.priority)} />
        {options.severity.length > 0 && (
          <Select size="small" allowClear placeholder="Severity" style={{ width: 130 }}
            value={filters.severity} onChange={set('severity')} options={optsFor(options.severity)} />
        )}
        <Select size="small" allowClear placeholder="Department" style={{ width: 150 }}
          value={filters.department} onChange={set('department')} options={optsFor(options.department)} />
        {options.site.length > 1 && (
          <Select size="small" allowClear placeholder="Site" style={{ width: 140 }}
            value={filters.site} onChange={set('site')} options={optsFor(options.site)} />
        )}
        {activeFilters > 0 && (
          <button onClick={() => setFilters({})}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-2 py-1">
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {/* Indicator strip — suppressed when the parent hoists these into its
          own top KPI strip (ModulePage passes showIndicators={false}). */}
      {showIndicators && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {profile.kpis.map((k) => (
            <IndicatorChip key={k} {...kpiDefs[k]} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {profile.charts.map((c) => (
          <ChartSlot key={c} chart={c} m={m} moduleName={moduleName} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// ─── Chart rendering ──────────────────────────────────────────────────────
interface ChartSlotProps {
  chart: ChartKey;
  m: any;
  moduleName: string;
  accent: string;
}

function ChartSlot({ chart, m, moduleName, accent }: ChartSlotProps) {
  switch (chart) {
    case 'status':
      return (
        <ChartCard title="Status distribution" subtitle={`All ${moduleName} records`}>
          <DonutOrEmpty data={m.status} />
        </ChartCard>
      );
    case 'due':
      return (
        <ChartCard title="Due-date posture" subtitle="Open records vs their due date">
          <DonutOrEmpty data={m.due} />
        </ChartCard>
      );
    case 'trend':
      return (
        <ChartCard title="Created vs Completed" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={m.trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.blue} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.completed} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={PALETTE.completed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconType="circle" iconSize={8} />
              <Area type="monotone" dataKey="created" name="Created" stroke={PALETTE.blue} fill="url(#gCreated)" strokeWidth={2} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke={PALETTE.completed} fill="url(#gCompleted)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      );
    case 'stage':
      return (
        <ChartCard title="Stage workload" subtitle="Records currently parked at each stage">
          <HBarOrEmpty data={m.stage} color={PALETTE.purple} width={120} />
        </ChartCard>
      );
    case 'priority':
      return (
        <ChartCard title="By priority">
          <VBarOrEmpty data={m.priority} color={accent} />
        </ChartCard>
      );
    case 'severity':
      return (
        <ChartCard title="By severity">
          <VBarOrEmpty data={m.severity} color={PALETTE.rose} />
        </ChartCard>
      );
    case 'classification':
      return (
        <ChartCard title="By classification" subtitle="Product / Process / System …">
          <HBarOrEmpty data={m.classification} color={PALETTE.indigo} width={120} />
        </ChartCard>
      );
    case 'department':
      return (
        <ChartCard title="By department" subtitle="Top 6">
          <HBarOrEmpty data={m.department} color={PALETTE.cyan} width={140} />
        </ChartCard>
      );
    case 'site':
      return (
        <ChartCard title="By site" subtitle="Top 6">
          <HBarOrEmpty data={m.site} color={PALETTE.emerald} width={140} />
        </ChartCard>
      );
    case 'aging':
      return (
        <ChartCard title="Aging — open records" subtitle="Days since creation">
          <ColorBarOrEmpty data={m.aging} />
        </ChartCard>
      );
    default:
      return null;
  }
}

// ─── Chart primitives (each with an honest empty state) ────────────────────
function EmptyChart({ label = 'No data yet' }: { label?: string }) {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-2">
        <ClipboardList size={18} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function DonutOrEmpty({ data }: { data: Slice[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={entry.color ?? Object.values(PALETTE)[i % 12]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TT_STYLE} />
        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function VBarOrEmpty({ data, color }: { data: Slice[]; color: string }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Records" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function HBarOrEmpty({ data, color, width }: { data: Slice[]; color: string; width: number }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={width} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Records" fill={color} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ColorBarOrEmpty({ data }: { data: Slice[] }) {
  if (data.length === 0) return <EmptyChart label="No open records" />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="value" name="Open records" radius={[6, 6, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color ?? PALETTE.blue} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
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

type ChipTone = 'blue' | 'emerald' | 'red' | 'amber';
interface IndicatorChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: ChipTone;
}

function IndicatorChip({ icon, label, value, tone }: IndicatorChipProps) {
  const tones = {
    blue:    'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red:     'border-red-200 bg-red-50 text-red-700',
    amber:   'border-amber-200 bg-amber-50 text-amber-700',
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
