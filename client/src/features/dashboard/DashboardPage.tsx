import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ClipboardList, Clock, FileText,
  GraduationCap, Plus, CalendarCheck, ArrowRight,
  ShieldCheck, MessageSquare, Activity, TrendingDown,
  BarChart2, Beaker, Wrench, Target, AlertCircle,
} from 'lucide-react';
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, StatsCard, Button, DataTable } from '@/components/ui';
import type { Column } from '@/components/ui';
import type { AuditLogEntry } from '@/types';
import { formatDateTime, cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardData } from './hooks';

// ── Chart palette — new design system ────────────────────────────────────────
const C = {
  navy:      '#0D0E17',
  pharma:    '#F59E0B',   // amber primary
  compliant: '#22C55E',   // success green
  caution:   '#F59E0B',   // warning amber
  critical:  '#EF4444',   // danger red
  slate:     '#64748B',
  muted:     '#E5E7EB',
  bg:        '#F9FAFB',
};

// Chart tooltip style
const TT_STYLE = {
  borderRadius: '8px',
  border: `1px solid ${C.muted}`,
  fontSize: '11px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  padding: '6px 10px',
  backgroundColor: '#fff',
};

// Severity colors
const SEV_COLORS = { Critical: C.critical, Major: C.caution, Minor: C.slate };
const FINDING_COLORS = { Major: C.critical, Minor: C.caution, OFI: C.pharma };

const RISK_COLORS: Record<string, string> = {
  Low: C.compliant, Medium: C.caution, High: '#F97316', Critical: C.critical,
};

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon size={13} className="shrink-0" style={{ color: C.pharma }} strokeWidth={2} />
      <span className="text-xxs font-semibold uppercase tracking-widest text-ink-tertiary">{label}</span>
      <div className="flex-1 h-px bg-surface-border" />
    </div>
  );
}

function RiskDot(props: any) {
  const { cx, cy, payload } = props;
  const color = RISK_COLORS[payload.label] ?? C.slate;
  const r = payload.z * 2.5 + 5;
  return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.65} stroke={color} strokeWidth={1} />;
}

// Date range button labels
const RANGE_LABELS: Record<string, string> = {
  '7d': '7D', '30d': '1M', '90d': '3M', '1y': '12M',
};

// Sparkline data per KPI (7 data points — weekly trend)
const SPARKLINES = {
  openNCs:    [22, 19, 24, 17, 21, 18, 33],
  openCAPAs:  [14, 16, 15, 18, 17, 16, 18],
  pending:    [8, 11, 9, 12, 13, 11, 12],
  expiring:   [5, 7, 6, 8, 9, 7, 8],
  overdue:    [4, 6, 5, 8, 7, 6, 6],
  training:   [88, 90, 91, 89, 92, 93, 93],
  supplier:   [82, 84, 85, 83, 86, 85, 86],
  audit:      [88, 89, 90, 90, 91, 90, 91],
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [dateRange, setDateRange] = useState('30d');

  const d = useDashboardData(dateRange);

  const activityColumns: Column<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Action',
      render: row => (
        <span className="text-xs font-medium text-ink">{row.action.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'entityType',
      header: 'Record',
      render: row => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-secondary">{row.entityType.replace(/_/g, ' ')}</span>
          <span className="record-id">{row.entityId}</span>
        </div>
      ),
    },
    { key: 'userName', header: 'User',
      render: row => <span className="text-xs text-ink-secondary">{row.userName}</span>
    },
    {
      key: 'timestamp',
      header: 'Timestamp (IST)',
      render: row => (
        <span className="timestamp">{formatDateTime(row.timestamp)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Executive Dashboard Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0D0E17', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
            Executive Dashboard
          </h1>
          <p className="text-xs text-ink-tertiary mt-1 flex items-center gap-1.5">
            <span>Quality Management</span>
            <span className="text-surface-border">·</span>
            <span>GMP Compliance</span>
            <span className="text-surface-border">·</span>
            <span>Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
          {(Object.entries(RANGE_LABELS) as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              style={
                dateRange === key
                  ? { backgroundColor: '#F59E0B', color: '#fff', fontWeight: 700 }
                  : { backgroundColor: 'transparent', color: '#6B7280' }
              }
              className="px-3.5 h-8 text-xs font-semibold transition-all border-r last:border-r-0 border-gray-200 rounded-none"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Alert Banner (when overdue actions exist) ── */}
      {d.stats.overdueActions > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderLeft: '4px solid #EF4444' }}
        >
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-red-700">
              {d.stats.overdueActions} actions overdue
            </span>
            <span className="text-xs text-red-500 ml-2">
              — Immediate attention required — overdue CAPAs and NCs may affect GMP compliance status.
            </span>
          </div>
        </div>
      )}

      {/* ── Top KPI trio ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          className="bg-white rounded-xl p-5 flex items-center justify-between"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '4px solid #F59E0B' }}
        >
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>CAPA Closure Rate</p>
            <p style={{ fontSize: '42px', fontWeight: 800, color: '#0D0E17', lineHeight: 1, letterSpacing: '-0.03em' }}>87</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>% closed this period</p>
          </div>
          <div style={{ backgroundColor: '#FFFBEB', borderRadius: '12px', padding: '12px' }}>
            <BarChart2 size={28} style={{ color: '#F59E0B' }} />
          </div>
        </div>

        <div
          className="bg-white rounded-xl p-5 flex items-center justify-between"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '4px solid #22C55E' }}
        >
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>Training Compliance</p>
            <p style={{ fontSize: '42px', fontWeight: 800, color: '#0D0E17', lineHeight: 1, letterSpacing: '-0.03em' }}>{d.stats.trainingCompliance}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>% departments on target</p>
          </div>
          <div style={{ backgroundColor: '#F0FDF4', borderRadius: '12px', padding: '12px' }}>
            <GraduationCap size={28} style={{ color: '#22C55E' }} />
          </div>
        </div>

        <div
          className="bg-white rounded-xl p-5 flex items-center justify-between"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderLeft: '4px solid #3B82F6' }}
        >
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9CA3AF' }}>Audit Compliance</p>
            <p style={{ fontSize: '42px', fontWeight: 800, color: '#0D0E17', lineHeight: 1, letterSpacing: '-0.03em' }}>{d.stats.auditCompliance}</p>
            <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>% — {d.rangeLabel.split('—')[1]?.trim() ?? 'this period'}</p>
          </div>
          <div style={{ backgroundColor: '#EFF6FF', borderRadius: '12px', padding: '12px' }}>
            <ShieldCheck size={28} style={{ color: '#3B82F6' }} />
          </div>
        </div>
      </div>

      {/* ── KPI tiles (2×4 grid) with sparklines ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <StatsCard title="Open NCs"           value={d.stats.openNCs}               icon={AlertTriangle}   alert={d.stats.openNCs > 10}
          trend={{ value: 8, label: 'vs prior' }} sparkline={SPARKLINES.openNCs} sparklineInvert
          onClick={() => navigate('/qms/non-conformances')} />
        <StatsCard title="Open CAPAs"         value={d.stats.openCAPAs}             icon={ClipboardList}
          accent="#F59E0B" trend={{ value: -12, label: 'vs prior' }} sparkline={SPARKLINES.openCAPAs} sparklineInvert
          onClick={() => navigate('/qms/capa')} />
        <StatsCard title="Pending Approvals"  value={d.stats.pendingApprovals}      icon={Clock}
          accent="#8B5CF6" sparkline={SPARKLINES.pending}
          onClick={() => navigate('/qms/change-control')} />
        <StatsCard title="Expiring Docs"      value={d.stats.expiringDocuments}     icon={FileText}
          accent="#F97316" sparkline={SPARKLINES.expiring} sparklineInvert
          onClick={() => navigate('/dms')} />
        <StatsCard title="Overdue Actions"    value={d.stats.overdueActions}        icon={TrendingDown}    alert={d.stats.overdueActions > 5}
          sparkline={SPARKLINES.overdue} sparklineInvert
          onClick={() => navigate('/qms/capa')} />
        <StatsCard title="Training"           value={`${d.stats.trainingCompliance}%`} icon={GraduationCap}
          accent="#22C55E" trend={{ value: 3, label: 'vs prior' }} sparkline={SPARKLINES.training}
          onClick={() => navigate('/lms/training')} />
        <StatsCard title="Supplier Score"     value={`${d.stats.supplierScore}%`}   icon={ShieldCheck}
          accent="#06B6D4" subtitle="Avg quality rating" sparkline={SPARKLINES.supplier}
          onClick={() => navigate('/qms/suppliers')} />
        <StatsCard title="Audit Compliance"   value={`${d.stats.auditCompliance}%`} icon={BarChart2}
          accent="#3B82F6" subtitle="This period" sparkline={SPARKLINES.audit}
          onClick={() => navigate('/qms/audits')} />
      </div>

      {/* ── Non-Conformance section ── */}
      <SectionLabel icon={AlertTriangle} label="Non-Conformance" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* NC Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>NC Trend — {d.rangeLabel}</CardTitle>
          </CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.ncTrends} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="ncGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={C.pharma} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={C.pharma} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={{ stroke: C.muted }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="count" stroke={C.pharma} strokeWidth={1.5}
                  fill="url(#ncGrad)" dot={{ r: 3, fill: C.pharma, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: C.pharma, strokeWidth: 1, fill: '#fff' }}
                  name="NCs Reported" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* NC by Type — donut (max 3 visible segments) */}
        <Card>
          <CardHeader><CardTitle>NC by Type</CardTitle></CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.ncByType.filter(x => x.count > 0).slice(0, 4)}
                  cx="50%" cy="44%" innerRadius={44} outerRadius={68}
                  dataKey="count" nameKey="type" paddingAngle={2} strokeWidth={0}>
                  {[C.navy, C.pharma, C.caution, C.slate].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#718096', paddingTop: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* NC Severity stacked bar */}
      <Card>
        <CardHeader><CardTitle>NC Severity Breakdown</CardTitle></CardHeader>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.severityTrend} barSize={24} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                axisLine={{ stroke: C.muted }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} />
              <Legend iconType="circle" iconSize={7}
                wrapperStyle={{ fontSize: '10px', color: '#718096' }} />
              <Bar dataKey="Critical" stackId="a" fill={SEV_COLORS.Critical} />
              <Bar dataKey="Major"    stackId="a" fill={SEV_COLORS.Major} />
              <Bar dataKey="Minor"    stackId="a" fill={SEV_COLORS.Minor} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── CAPA & Complaints ── */}
      <SectionLabel icon={ClipboardList} label="CAPA & Complaints" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* CAPA by Stage — horizontal bar */}
        <Card>
          <CardHeader><CardTitle>CAPA by Stage</CardTitle></CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.capaByStage} layout="vertical" barSize={13}
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage"
                  tick={{ fontSize: 10, fill: '#4A5568' }} axisLine={false} tickLine={false} width={100} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="count" name="CAPAs" radius={[0, 2, 2, 0]}>
                  {d.capaByStage.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.stage === 'Closed' ? C.compliant : entry.count >= 5 ? C.caution : C.pharma} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Complaint trend */}
        <Card>
          <CardHeader><CardTitle>Complaints — Received vs Resolved</CardTitle></CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.complaintTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.critical} stopOpacity={0.10} />
                    <stop offset="100%" stopColor={C.critical} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.compliant} stopOpacity={0.10} />
                    <stop offset="100%" stopColor={C.compliant} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={{ stroke: C.muted }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#718096' }} />
                <Area type="monotone" dataKey="received" stroke={C.critical} strokeWidth={1.5}
                  fill="url(#recGrad)" name="Received" dot={{ r: 2.5, fill: C.critical, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="resolved" stroke={C.compliant} strokeWidth={1.5}
                  fill="url(#resGrad)" name="Resolved" dot={{ r: 2.5, fill: C.compliant, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Audits & Risk ── */}
      <SectionLabel icon={ShieldCheck} label="Audits & Risk" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Audit Findings — grouped bar */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Audit Findings by Department</CardTitle></CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.auditFindings} barSize={11}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
                <XAxis dataKey="dept" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={{ stroke: C.muted }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Legend iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#718096' }} />
                <Bar dataKey="Major" fill={FINDING_COLORS.Major} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Minor" fill={FINDING_COLORS.Minor} radius={[2, 2, 0, 0]} />
                <Bar dataKey="OFI"   fill={FINDING_COLORS.OFI}   radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Risk scatter matrix */}
        <Card>
          <CardHeader><CardTitle>Risk Matrix</CardTitle></CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, bottom: 12, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} />
                <XAxis type="number" dataKey="x" name="Likelihood" domain={[0, 6]}
                  tick={{ fontSize: 9, fill: '#718096' }} axisLine={{ stroke: C.muted }} tickLine={false}
                  label={{ value: 'Likelihood →', position: 'insideBottom', offset: -4, fontSize: 9, fill: '#718096' }} />
                <YAxis type="number" dataKey="y" name="Consequence" domain={[0, 6]}
                  tick={{ fontSize: 9, fill: '#718096' }} axisLine={false} tickLine={false}
                  label={{ value: 'Impact', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#718096' }} />
                <ZAxis type="number" dataKey="z" range={[40, 280]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={TT_STYLE}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const pt = payload[0]?.payload;
                    return (
                      <div className="bg-white border border-surface-border rounded p-2 text-xs shadow-panel">
                        <p className="font-semibold" style={{ color: RISK_COLORS[pt.label] }}>{pt.label} Risk</p>
                        <p className="text-ink-tertiary">Score: {pt.x * pt.y} · {pt.z} risks</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={d.riskMatrix} shape={<RiskDot />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 pt-2 border-t border-surface-border">
            {Object.entries(RISK_COLORS).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xxs text-ink-tertiary">{label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Documents & Suppliers ── */}
      <SectionLabel icon={FileText} label="Documents & Suppliers" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Document pipeline */}
        <Card>
          <CardHeader><CardTitle>Document Status Pipeline</CardTitle></CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.docPipeline} barSize={32}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={{ stroke: C.muted }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT_STYLE} />
                <Bar dataKey="count" name="Documents" radius={[2, 2, 0, 0]}>
                  {d.docPipeline.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Supplier radar */}
        <Card>
          <CardHeader><CardTitle>Supplier Performance</CardTitle></CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={d.supplierRadar} cx="50%" cy="50%" outerRadius="68%">
                <PolarGrid stroke={C.muted} />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#718096' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]}
                  tick={{ fontSize: 8, fill: '#718096' }} tickCount={3} />
                <Radar name="Score" dataKey="score" stroke={C.pharma} fill={C.pharma}
                  fillOpacity={0.12} strokeWidth={1.5}
                  dot={{ r: 3, fill: C.pharma, strokeWidth: 1, stroke: '#fff' }} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v}%`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Training Compliance ── */}
      <SectionLabel icon={GraduationCap} label="Training Compliance" />
      <Card>
        <CardHeader>
          <CardTitle>Compliance by Department</CardTitle>
          <span className="text-xxs text-ink-tertiary">Target: 90%</span>
        </CardHeader>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.trainingByDept} layout="vertical" barSize={16}
              margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={C.muted} horizontal={false} />
              <XAxis type="number" domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#718096' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="dept"
                tick={{ fontSize: 10, fill: '#4A5568' }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}%`, 'Compliance']} />
              <ReferenceLine x={90} stroke={C.caution} strokeDasharray="3 4" strokeWidth={1}
                label={{ value: '90%', position: 'top', fontSize: 9, fill: C.caution }} />
              <Bar dataKey="compliance" name="Compliance %" radius={[0, 2, 2, 0]}>
                {d.trainingByDept.map((entry, i) => (
                  <Cell key={i}
                    fill={entry.compliance >= 90 ? C.compliant : entry.compliance >= 80 ? C.caution : C.critical} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Inspection & Calibration ── */}
      <SectionLabel icon={Beaker} label="Inspection & Calibration" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Inspection pass rate trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inspection Pass Rate</CardTitle>
            <span className="text-xxs text-ink-tertiary">Target: 95%</span>
          </CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.inspectionPassRate} margin={{ top: 4, right: 24, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="passGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.compliant} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={C.compliant} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={C.muted} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={{ stroke: C.muted }} tickLine={false} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 10, fill: '#718096' }}
                  axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={TT_STYLE} formatter={v => [`${v}%`, 'Pass Rate']} />
                <ReferenceLine y={95} stroke={C.pharma} strokeDasharray="3 4" strokeWidth={1}
                  label={{ value: '95%', position: 'insideTopRight', fontSize: 9, fill: C.pharma }} />
                <Area type="monotone" dataKey="passRate" stroke={C.compliant} strokeWidth={1.5}
                  fill="url(#passGrad)" dot={{ r: 3, fill: C.compliant, strokeWidth: 0 }}
                  activeDot={{ r: 4, stroke: C.compliant, strokeWidth: 1, fill: '#fff' }}
                  name="Pass Rate %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Inspection result breakdown */}
        <Card>
          <CardHeader><CardTitle>Inspection Results</CardTitle></CardHeader>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.inspectionByResult} cx="50%" cy="42%" innerRadius={42} outerRadius={64}
                  dataKey="count" nameKey="result" paddingAngle={2} strokeWidth={0}>
                  {[C.compliant, C.critical, C.caution, C.slate].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#718096', paddingTop: '6px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Calibration + Quality KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Calibration status donut */}
        <Card>
          <CardHeader>
            <CardTitle>Calibration Status</CardTitle>
          </CardHeader>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.calibrationStatus} cx="50%" cy="42%" innerRadius={36} outerRadius={56}
                  dataKey="count" nameKey="status" paddingAngle={2} strokeWidth={0}>
                  {d.calibrationStatus.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={7}
                  wrapperStyle={{ fontSize: '10px', color: '#718096', paddingTop: '4px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quality KPIs grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Quality KPIs</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-2 gap-3 p-1">
            {d.qualityKPIs.map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-lg px-3 py-3 flex flex-col gap-1 border border-surface-border">
                <span className="text-xxs text-ink-tertiary font-semibold uppercase tracking-wider">{kpi.label}</span>
                <span className="text-2xl font-bold leading-none" style={{ color: kpi.color }}>{kpi.value}</span>
                <span className="text-xxs text-ink-tertiary">{kpi.sub}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Audit Trail ── */}
      <SectionLabel icon={Activity} label="Recent Activity" />
      <Card noPadding>
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
          <CardTitle>Audit Log</CardTitle>
          <button
            onClick={() => navigate('/audit-log')}
            className="flex items-center gap-1 text-xxs text-pharma-600 hover:text-pharma-700 font-medium transition-colors"
          >
            View full log <ArrowRight size={11} />
          </button>
        </div>
        <DataTable
          columns={activityColumns}
          data={d.recentActivity}
          isLoading={false}
          emptyMessage="No recent activity"
        />
      </Card>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-2 pb-4">
        <Button size="sm" onClick={() => navigate('/qms/non-conformances/new')}>
          <Plus className="h-3.5 w-3.5" />
          Report NC
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/dms/documents/new')}>
          <FileText className="h-3.5 w-3.5" />
          Create Document
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/qms/audits')}>
          <CalendarCheck className="h-3.5 w-3.5" />
          Schedule Audit
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/qms/capa/new')}>
          <ClipboardList className="h-3.5 w-3.5" />
          New CAPA
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/qms/complaints/new')}>
          <MessageSquare className="h-3.5 w-3.5" />
          Log Complaint
        </Button>
      </div>
    </div>
  );
}
