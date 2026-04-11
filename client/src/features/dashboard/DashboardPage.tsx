import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ClipboardList, Clock, FileText,
  GraduationCap, Plus, CalendarCheck, ArrowRight,
  ShieldCheck, MessageSquare, Activity, TrendingDown,
  BarChart2, Beaker,
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
  navy:      '#1A1A2E',
  pharma:    '#C9A84C',   // gold primary
  compliant: '#22C55E',   // success green
  caution:   '#F59E0B',   // warning amber
  critical:  '#EF4444',   // danger red
  slate:     '#64748B',
  muted:     '#E8ECF2',
  bg:        '#F4F6FA',
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
  '7d': '7D', '30d': '30D', '90d': '90D', '1y': '1Y',
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">QMS Dashboard</h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            Welcome, <span className="font-medium text-ink-secondary">{user?.name ?? 'User'}</span>
            <span className="mx-1.5 text-surface-border">·</span>
            {user?.role?.replace(/_/g, ' ')}
          </p>
        </div>

        {/* Date range selector */}
        <div className="flex items-center border border-surface-border rounded overflow-hidden">
          {(Object.entries(RANGE_LABELS) as [string, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              style={dateRange === key ? { backgroundColor: '#C9A84C', color: '#fff' } : { backgroundColor: '#fff', color: '#4A5568' }}
              className="px-3 h-7 text-xs font-medium transition-colors border-r last:border-r-0"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI tiles (2×4 grid) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <StatsCard title="Open NCs"           value={d.stats.openNCs}               icon={AlertTriangle}   alert={d.stats.openNCs > 10}
          iconColor="bg-critical-50 text-critical-600" trend={{ value: 8, label: 'vs prior' }}
          onClick={() => navigate('/qms/non-conformances')} />
        <StatsCard title="Open CAPAs"         value={d.stats.openCAPAs}             icon={ClipboardList}
          iconColor="bg-caution-50 text-caution-600"   trend={{ value: -12, label: 'vs prior' }}
          onClick={() => navigate('/qms/capa')} />
        <StatsCard title="Pending Approvals"  value={d.stats.pendingApprovals}      icon={Clock}
          iconColor="bg-pharma-50 text-pharma-500"
          onClick={() => navigate('/qms/change-control')} />
        <StatsCard title="Expiring Docs"      value={d.stats.expiringDocuments}     icon={FileText}
          iconColor="bg-caution-50 text-caution-600"
          onClick={() => navigate('/dms')} />
        <StatsCard title="Overdue Actions"    value={d.stats.overdueActions}        icon={TrendingDown}    alert={d.stats.overdueActions > 5}
          iconColor="bg-critical-50 text-critical-600"
          onClick={() => navigate('/qms/capa')} />
        <StatsCard title="Training"           value={`${d.stats.trainingCompliance}%`} icon={GraduationCap}
          iconColor="bg-compliant-50 text-compliant-600" trend={{ value: 3, label: 'vs prior' }}
          onClick={() => navigate('/lms/training')} />
        <StatsCard title="Supplier Score"     value={`${d.stats.supplierScore}%`}   icon={ShieldCheck}
          iconColor="bg-pharma-50 text-pharma-500" subtitle="Avg quality rating"
          onClick={() => navigate('/qms/suppliers')} />
        <StatsCard title="Audit Compliance"   value={`${d.stats.auditCompliance}%`} icon={BarChart2}
          iconColor="bg-compliant-50 text-compliant-600" subtitle="This period"
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
