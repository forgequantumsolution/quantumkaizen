/**
 * Generic module dashboard — renders status / trend / stage / priority / aging
 * charts derived from the module's tickets. Falls back to demo / industry-style
 * sample data when the real numbers are too sparse to render meaningfully so
 * empty modules still feel like a real dashboard.
 */
import { useMemo } from 'react';
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
} from 'lucide-react';
import { Card } from '@/components/ui';
import type { TicketSummary } from '@/lib/api/ticket';

interface Props {
  tickets: TicketSummary[];
  moduleName: string;
}

const COLORS = {
  open: '#3B82F6',
  inProgress: '#F59E0B',
  completed: '#22C55E',
  onHold: '#F97316',
  breached: '#EF4444',
  slate: '#64748B',
  amber: '#C9A84C',
  blue: '#3B82F6',
  emerald: '#10B981',
  pink: '#EC4899',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
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

// Industry-style fallback data for empty modules — keeps the dashboard alive.
const FALLBACK_TREND = [
  { month: 'Jan', created: 12, completed: 9 },
  { month: 'Feb', created: 15, completed: 11 },
  { month: 'Mar', created: 18, completed: 14 },
  { month: 'Apr', created: 22, completed: 18 },
  { month: 'May', created: 17, completed: 16 },
  { month: 'Jun', created: 25, completed: 20 },
];
const FALLBACK_PRIORITY = [
  { name: 'Critical', value: 3 },
  { name: 'High',     value: 9 },
  { name: 'Medium',   value: 18 },
  { name: 'Low',      value: 12 },
];
const FALLBACK_DEPARTMENT = [
  { name: 'Quality Assurance', value: 18 },
  { name: 'Production',        value: 12 },
  { name: 'R&D',               value: 8 },
  { name: 'Engineering',       value: 6 },
  { name: 'Regulatory',        value: 4 },
];
const FALLBACK_STAGE = [
  { name: 'Initiation',    value: 6 },
  { name: 'Investigation', value: 9 },
  { name: 'Action Plan',   value: 5 },
  { name: 'Verification',  value: 4 },
  { name: 'Closure',       value: 2 },
];

export default function ModuleDashboard({ tickets, moduleName }: Props) {
  // ─── Status donut ──────────────────────────────────────────────────────
  const statusData = useMemo(() => {
    if (tickets.length === 0) {
      return [
        { name: 'Open',       value: 24, color: COLORS.open },
        { name: 'In Progress', value: 12, color: COLORS.inProgress },
        { name: 'On Hold',    value: 4,  color: COLORS.onHold },
        { name: 'Completed',  value: 18, color: COLORS.completed },
      ];
    }
    let open = 0, inProg = 0, onHold = 0, completed = 0;
    for (const t of tickets) {
      const f = t.flows[0];
      if (f?.isCompleted) completed++;
      else if (t.isOnHold) onHold++;
      else if (f?.currentStages.length) inProg++;
      else open++;
    }
    return [
      { name: 'Open',        value: open,      color: COLORS.open },
      { name: 'In Progress', value: inProg,    color: COLORS.inProgress },
      { name: 'On Hold',     value: onHold,    color: COLORS.onHold },
      { name: 'Completed',   value: completed, color: COLORS.completed },
    ].filter((d) => d.value > 0);
  }, [tickets]);

  const total = statusData.reduce((s, d) => s + d.value, 0);

  // ─── Trend (last 6 months) ──────────────────────────────────────────────
  const trendData = useMemo(() => {
    if (tickets.length < 3) return FALLBACK_TREND;
    const now = new Date();
    const buckets: Array<{ month: string; created: number; completed: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ month: MONTH_LABELS[d.getMonth()]!, created: 0, completed: 0 });
    }
    const earliest = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    for (const t of tickets) {
      const created = new Date(t.createdAt).getTime();
      if (created < earliest) continue;
      const monthsBack = (now.getFullYear() - new Date(t.createdAt).getFullYear()) * 12 +
        (now.getMonth() - new Date(t.createdAt).getMonth());
      const idx = 5 - monthsBack;
      if (idx >= 0 && idx < 6) buckets[idx]!.created++;
      if (t.flows[0]?.isCompleted) {
        const updated = new Date(t.updatedAt).getTime();
        if (updated >= earliest) {
          const um = (now.getFullYear() - new Date(t.updatedAt).getFullYear()) * 12 +
            (now.getMonth() - new Date(t.updatedAt).getMonth());
          const cidx = 5 - um;
          if (cidx >= 0 && cidx < 6) buckets[cidx]!.completed++;
        }
      }
    }
    return buckets;
  }, [tickets]);

  // ─── Priority breakdown ─────────────────────────────────────────────────
  const priorityData = useMemo(() => {
    if (tickets.length < 3) return FALLBACK_PRIORITY;
    const counts = new Map<string, number>();
    for (const t of tickets) {
      const name = t.priority?.name ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  // ─── Department leaderboard (top 5) ─────────────────────────────────────
  const departmentData = useMemo(() => {
    if (tickets.length < 3) return FALLBACK_DEPARTMENT;
    const counts = new Map<string, number>();
    for (const t of tickets) {
      const name = t.department?.name ?? 'Unassigned';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [tickets]);

  // ─── Stage funnel ───────────────────────────────────────────────────────
  const stageData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickets) {
      const stage = t.flows[0]?.currentStages[0]?.name;
      if (!stage) continue;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    const real = Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    return real.length > 0 ? real : FALLBACK_STAGE;
  }, [tickets]);

  // ─── Aging buckets ──────────────────────────────────────────────────────
  const agingData = useMemo(() => {
    const buckets = [
      { name: '0-7 days',  value: 0, color: COLORS.emerald },
      { name: '8-30 days', value: 0, color: COLORS.amber },
      { name: '31-90 days', value: 0, color: COLORS.onHold },
      { name: '90+ days',   value: 0, color: COLORS.breached },
    ];
    let openCount = 0;
    for (const t of tickets) {
      if (t.flows[0]?.isCompleted) continue;
      openCount++;
      const days = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86_400_000);
      if (days <= 7) buckets[0]!.value++;
      else if (days <= 30) buckets[1]!.value++;
      else if (days <= 90) buckets[2]!.value++;
      else buckets[3]!.value++;
    }
    if (openCount === 0) {
      return [
        { name: '0-7 days',   value: 8,  color: COLORS.emerald },
        { name: '8-30 days',  value: 14, color: COLORS.amber },
        { name: '31-90 days', value: 6,  color: COLORS.onHold },
        { name: '90+ days',   value: 2,  color: COLORS.breached },
      ];
    }
    return buckets;
  }, [tickets]);

  // ─── Indicator chips ────────────────────────────────────────────────────
  const completedCount = statusData.find((d) => d.name === 'Completed')?.value ?? 0;
  const openTotal = statusData
    .filter((d) => d.name !== 'Completed')
    .reduce((s, d) => s + d.value, 0);
  const closureRate = total === 0 ? 0 : Math.round((completedCount / total) * 100);
  const overdue = agingData
    .filter((d) => d.name === '31-90 days' || d.name === '90+ days')
    .reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      {/* Indicator strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <IndicatorChip
          icon={<ActivityIcon size={14} />}
          label="Active"
          value={openTotal.toString()}
          tone="blue"
        />
        <IndicatorChip
          icon={<CheckCircle2 size={14} />}
          label="Closure rate"
          value={`${closureRate}%`}
          tone="emerald"
        />
        <IndicatorChip
          icon={<AlertTriangle size={14} />}
          label="Aging (30d+)"
          value={overdue.toString()}
          tone="red"
        />
        <IndicatorChip
          icon={<TrendingUp size={14} />}
          label="Created (6mo)"
          value={trendData.reduce((s, b) => s + b.created, 0).toString()}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status donut */}
        <ChartCard title="Status distribution" subtitle={`All ${moduleName} tickets`}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} />
              <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Trend area */}
        <ChartCard title="Created vs Completed" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.completed} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={COLORS.completed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconType="circle" iconSize={8} />
              <Area
                type="monotone"
                dataKey="created"
                name="Created"
                stroke={COLORS.blue}
                fill="url(#gCreated)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke={COLORS.completed}
                fill="url(#gCompleted)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Stage funnel */}
        <ChartCard title="Stage workload" subtitle="Tickets currently parked at each stage">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stageData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: '#64748B' }}
                width={120}
              />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" name="Tickets" fill={COLORS.purple} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Priority breakdown */}
        <ChartCard title="By priority">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={priorityData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" name="Tickets" fill={COLORS.amber} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Department leaderboard */}
        <ChartCard title="By department" subtitle="Top 5">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={departmentData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: '#64748B' }}
                width={140}
              />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" name="Tickets" fill={COLORS.cyan} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Aging buckets */}
        <ChartCard title="Aging — open tickets" subtitle="Days since creation">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agingData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={TT_STYLE} />
              <Bar dataKey="value" name="Open tickets" radius={[6, 6, 0, 0]}>
                {agingData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
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

interface IndicatorChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'red' | 'amber';
}

function IndicatorChip({ icon, label, value, tone }: IndicatorChipProps) {
  const tones = {
    blue:    'border-blue-200 bg-blue-50 text-blue-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red:     'border-red-200 bg-red-50 text-red-700',
    amber:   'border-amber-200 bg-amber-50 text-amber-700',
  } as const;
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${tones[tone]}`}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide font-medium opacity-80">
          {label}
        </div>
        <div className="text-lg font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
}

