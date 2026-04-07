// ============================================================
// COMPLIANCE HUB — Unified Regulatory Compliance Dashboard
// Covers ALCOA+, Cross-system integration, Industry frameworks
// FDA / EU GMP / OSHA PSM / FSMA / IATF 16949
// ============================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  ArrowRight, Activity, FileText, GraduationCap, Layers,
  ChevronRight, TrendingUp, TrendingDown, Minus,
  Database, Link, RefreshCw,
} from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  regulatoryFrameworks,
  alcoaMetrics,
  integrationTriggers,
  industryComplianceSummary,
  overallComplianceScore,
  type Industry,
  type SystemType,
  type IntegrationTrigger,
} from './hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const INDUSTRY_COLORS: Record<Industry, string> = {
  PHARMA: '#0a1628',
  CHEMICAL: '#b8860b',
  FOOD: '#10b981',
  AUTOMOTIVE: '#0ea5e9',
};

const INDUSTRY_LABELS: Record<Industry, string> = {
  PHARMA: 'Pharma & Life Sciences',
  CHEMICAL: 'Chemical Manufacturing',
  FOOD: 'Food & Beverage',
  AUTOMOTIVE: 'Automotive & Machinery',
};

const STATUS_COLORS: Record<string, string> = {
  COMPLIANT: 'text-emerald-600 bg-emerald-50',
  PARTIAL: 'text-amber-600 bg-amber-50',
  NON_COMPLIANT: 'text-red-600 bg-red-50',
};

const TRIGGER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-600 bg-amber-50' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-sky-600 bg-sky-50' },
  COMPLETED: { label: 'Done', color: 'text-emerald-600 bg-emerald-50' },
};

const SYSTEM_ICONS: Record<SystemType, React.ElementType> = {
  QMS: Activity,
  DMS: FileText,
  LMS: GraduationCap,
};

const SYSTEM_COLORS: Record<SystemType, string> = {
  QMS: '#0a1628',
  DMS: '#b8860b',
  LMS: '#0ea5e9',
};

function ScoreGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const radius = size === 'lg' ? 54 : size === 'md' ? 42 : 30;
  const stroke = size === 'lg' ? 8 : 6;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <div className={cn('relative inline-flex items-center justify-center', size === 'lg' ? 'w-32 h-32' : size === 'md' ? 'w-24 h-24' : 'w-16 h-16')}>
      <svg className="rotate-[-90deg]" width="100%" height="100%" viewBox={`0 0 ${(radius + stroke) * 2} ${(radius + stroke) * 2}`}>
        <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle
          cx={radius + stroke} cy={radius + stroke} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <p className={cn('font-bold leading-none', size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-xl' : 'text-sm')} style={{ color }}>
          {score}%
        </p>
      </div>
    </div>
  );
}

function SystemBadge({ system }: { system: SystemType }) {
  const Icon = SYSTEM_ICONS[system];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: SYSTEM_COLORS[system] }}
    >
      <Icon size={10} />
      {system}
    </span>
  );
}

function IntegrationTriggerRow({ trigger }: { trigger: IntegrationTrigger }) {
  const cfg = TRIGGER_STATUS_CONFIG[trigger.status];
  const FromIcon = SYSTEM_ICONS[trigger.from];
  const ToIcon = SYSTEM_ICONS[trigger.to];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <SystemBadge system={trigger.from} />
        <ArrowRight size={12} className="text-gray-400" />
        <SystemBadge system={trigger.to} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{trigger.sourceTitle}</p>
        <p className="text-xs text-gray-400">{trigger.triggerType} · {trigger.sourceId}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', cfg.color)}>{cfg.label}</span>
        <span className="text-xs text-gray-400">Due {trigger.dueDate}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ComplianceHubPage() {
  const navigate = useNavigate();
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'ALL'>('ALL');

  const filteredFrameworks = selectedIndustry === 'ALL'
    ? regulatoryFrameworks
    : regulatoryFrameworks.filter((f) => f.industry === selectedIndustry);

  const pendingTriggers = integrationTriggers.filter((t) => t.status !== 'COMPLETED').length;
  const alcoa_avg = Math.round(alcoaMetrics.reduce((s, m) => s + m.score, 0) / alcoaMetrics.length);
  const totalOpenGaps = industryComplianceSummary.reduce((s, i) => s + i.openGaps, 0);
  const totalCritical = industryComplianceSummary.reduce((s, i) => s + i.critical, 0);

  const radarData = alcoaMetrics.map((m) => ({ metric: m.letter, score: m.score }));

  const tooltipStyle = { borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Compliance Hub</h1>
          <p className="mt-1 text-sm text-gray-500">
            Unified regulatory compliance — QMS · DMS · LMS &nbsp;·&nbsp; 21 CFR Part 11 · EU GMP Annex 11 · ALCOA+
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/compliance/inspection-readiness')}>
            <ShieldCheck size={14} />
            Inspection Readiness
          </Button>
          <Button variant="outline" onClick={() => navigate('/compliance/regulatory-changes')}>
            <RefreshCw size={14} />
            Regulatory Changes
          </Button>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <ScoreGauge score={overallComplianceScore} size="md" />
          <div>
            <p className="text-sm font-medium text-gray-900">Overall Compliance</p>
            <p className="text-xs text-gray-400 mt-0.5">Across all industries & systems</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-xs text-emerald-600">+2% vs last quarter</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">ALCOA+ Score</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{alcoa_avg}%</p>
          <p className="text-xs text-gray-500 mt-1">Data integrity compliance</p>
          <p className="text-xs text-amber-600 mt-1">{alcoaMetrics.reduce((s, m) => s + m.openFindings, 0)} open findings</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Open Compliance Gaps</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{totalOpenGaps}</p>
          <p className="text-xs text-red-600 mt-1">{totalCritical} critical · across {regulatoryFrameworks.length} frameworks</p>
          <button onClick={() => {}} className="text-xs text-blue-600 mt-1 flex items-center gap-1">
            View all <ChevronRight size={10} />
          </button>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Integration Triggers</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{pendingTriggers}</p>
          <p className="text-xs text-gray-500 mt-1">pending cross-system actions</p>
          <p className="text-xs text-sky-600 mt-1">QMS ↔ DMS ↔ LMS</p>
        </Card>
      </div>

      {/* Industry compliance bar + ALCOA radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Industry Compliance Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Compliance by Industry & System</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryComplianceSummary} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="industry" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#64748b' }} />
                <Bar dataKey="qms" name="QMS" fill="#0a1628" radius={[3, 3, 0, 0]} />
                <Bar dataKey="dms" name="DMS" fill="#b8860b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lms" name="LMS" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ALCOA+ Radar */}
        <Card>
          <CardHeader>
            <CardTitle>ALCOA+ Data Integrity</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickCount={3} />
                <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 1.5, stroke: '#fff' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Score']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ALCOA+ Principle Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>ALCOA+ Principle Detail — 21 CFR Part 11 / EU GMP Annex 11 / PIC/S PI 041-1</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {alcoaMetrics.map((m) => (
            <div key={m.principle} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className={cn(
                'text-2xl font-bold leading-none mb-1',
                m.score >= 95 ? 'text-emerald-600' : m.score >= 85 ? 'text-amber-600' : 'text-red-600'
              )}>
                {m.score}%
              </div>
              <div className="text-xs font-semibold text-gray-700 mb-0.5">{m.letter}</div>
              <div className="text-[10px] text-gray-500 leading-tight">{m.principle}</div>
              {m.openFindings > 0 && (
                <div className="mt-1 text-[10px] text-red-500">{m.openFindings} finding{m.openFindings > 1 ? 's' : ''}</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Regulatory Frameworks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Regulatory Frameworks</h2>
          <div className="flex gap-2">
            {(['ALL', 'PHARMA', 'CHEMICAL', 'FOOD', 'AUTOMOTIVE'] as const).map((ind) => (
              <button
                key={ind}
                onClick={() => setSelectedIndustry(ind)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                  selectedIndustry === ind
                    ? 'bg-slate-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {ind === 'ALL' ? 'All' : INDUSTRY_LABELS[ind].split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFrameworks.map((fw) => (
            <Card key={fw.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: INDUSTRY_COLORS[fw.industry] }}
                    >
                      {fw.industry}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wide">{fw.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{fw.shortName}</p>
                  <p className="text-xs text-gray-500 truncate">{fw.name}</p>
                </div>
                <ScoreGauge score={fw.complianceScore} size="sm" />
              </div>

              {/* Gap counts */}
              <div className="flex gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  <span className="text-gray-600">{fw.criticalGaps} critical</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <span className="text-gray-600">{fw.openGaps - fw.criticalGaps} major/minor</span>
                </div>
                <div className="text-gray-400 ml-auto">Next review: {fw.nextReviewDate}</div>
              </div>

              {/* Clause status */}
              <div className="space-y-1.5">
                {fw.clauses.map((clause) => (
                  <div key={clause.id} className="flex items-center gap-2">
                    {clause.status === 'COMPLIANT' ? (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    ) : clause.status === 'PARTIAL' ? (
                      <AlertTriangle size={12} className="text-amber-500 shrink-0" />
                    ) : (
                      <XCircle size={12} className="text-red-500 shrink-0" />
                    )}
                    <span className="text-[11px] font-mono text-gray-400 shrink-0 w-32 truncate">{clause.ref}</span>
                    <span className="text-[11px] text-gray-600 truncate flex-1">{clause.title}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0', STATUS_COLORS[clause.status])}>
                      {clause.status === 'NON_COMPLIANT' ? 'NC' : clause.status === 'PARTIAL' ? 'Partial' : 'OK'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Cross-system Integration Triggers */}
      <Card>
        <CardHeader>
          <CardTitle>Cross-System Integration Triggers — QMS ↔ DMS ↔ LMS</CardTitle>
          <button
            onClick={() => {}}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-600-hover"
          >
            View all <ArrowRight size={12} />
          </button>
        </CardHeader>

        {/* Integration summary badges */}
        <div className="flex gap-6 mb-4 pb-4 border-b border-gray-100">
          {(['QMS', 'DMS', 'LMS'] as SystemType[]).map((sys) => {
            const pending = integrationTriggers.filter((t) => (t.from === sys || t.to === sys) && t.status === 'PENDING').length;
            const Icon = SYSTEM_ICONS[sys];
            return (
              <div key={sys} className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                  style={{ backgroundColor: SYSTEM_COLORS[sys] }}
                >
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{sys}</p>
                  <p className="text-[11px] text-amber-600">{pending} pending</p>
                </div>
              </div>
            );
          })}
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Total triggers</p>
            <p className="text-lg font-bold text-gray-900">{integrationTriggers.length}</p>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {integrationTriggers.map((t) => (
            <IntegrationTriggerRow key={t.id} trigger={t} />
          ))}
        </div>
      </Card>

      {/* Electronic Signature status — 21 CFR Part 11 */}
      <Card>
        <CardHeader>
          <CardTitle>Electronic Signature Framework — 21 CFR Part 11 / EU GMP Annex 11</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'System Validation (IQ/OQ/PQ)', status: 'COMPLIANT', detail: 'GAMP 5 Cat. 4 — VMP-2025' },
            { label: 'Unique User ID + Password Auth', status: 'COMPLIANT', detail: 'SSO + MFA enabled' },
            { label: 'Signature Manifestation (Name / Date / Meaning)', status: 'PARTIAL', detail: 'Meaning field pending rollout' },
            { label: 'Signature–Record Linking (Part 11.70)', status: 'COMPLIANT', detail: 'Cryptographic hash link' },
            { label: 'Audit Trail (Part 11.10(e))', status: 'PARTIAL', detail: 'Automatic; periodic review SOP draft' },
            { label: 'Record Integrity & Backup', status: 'COMPLIANT', detail: 'Daily encrypted backup; RTO 4hr' },
            { label: 'Quarterly Access Certification', status: 'PARTIAL', detail: 'Q1 2026 review overdue by 12 days' },
            { label: 'Biometric / Alternate Auth Option', status: 'NON_COMPLIANT', detail: 'Not yet implemented' },
          ].map((item) => (
            <div key={item.label} className={cn(
              'rounded-lg p-3 border',
              item.status === 'COMPLIANT' ? 'border-emerald-100 bg-emerald-50/50'
                : item.status === 'PARTIAL' ? 'border-amber-100 bg-amber-50/50'
                : 'border-red-100 bg-red-50/50'
            )}>
              <div className="flex items-center gap-2 mb-1">
                {item.status === 'COMPLIANT' ? <CheckCircle2 size={13} className="text-emerald-500" />
                  : item.status === 'PARTIAL' ? <AlertTriangle size={13} className="text-amber-500" />
                  : <XCircle size={13} className="text-red-500" />}
                <span className={cn(
                  'text-[10px] font-semibold',
                  item.status === 'COMPLIANT' ? 'text-emerald-700'
                    : item.status === 'PARTIAL' ? 'text-amber-700'
                    : 'text-red-700'
                )}>
                  {item.status === 'NON_COMPLIANT' ? 'Non-Compliant' : item.status === 'PARTIAL' ? 'Partial' : 'Compliant'}
                </span>
              </div>
              <p className="text-xs font-medium text-gray-800 leading-tight">{item.label}</p>
              <p className="text-[11px] text-gray-500 mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Regulatory Retention Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Record Retention Schedule by Regulation</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-4 text-gray-400 font-medium">Record Type</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-medium">Regulation</th>
                <th className="text-left py-2 pr-4 text-gray-400 font-medium">Retention Period</th>
                <th className="text-left py-2 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { record: 'Batch Manufacturing Records', regulation: '21 CFR 211.180 / EU GMP Ch. 4', period: '1 yr post expiry or 5 yrs post manufacture (greater)', status: 'COMPLIANT' },
                { record: 'GMP Training Records', regulation: 'EU GMP Chapter 2', period: '3 years post employee departure', status: 'COMPLIANT' },
                { record: 'GAMP 5 CSV Records', regulation: 'EU GMP Annex 11', period: 'Life of system + defined archival period', status: 'PARTIAL' },
                { record: 'Safety Data Sheets (SDS)', regulation: 'OSHA 29 CFR 1910.1020', period: '30 years (OSHA hazardous substances)', status: 'COMPLIANT' },
                { record: 'REACH Records', regulation: 'REACH Article 36', period: '10 years after last supply date', status: 'PARTIAL' },
                { record: 'PSM Process Safety Information', regulation: '29 CFR 1910.119(e)', period: 'Life of process', status: 'COMPLIANT' },
                { record: 'HARPC Food Safety Plan + Monitoring', regulation: 'FSMA 21 CFR Part 117', period: '2 years (or shelf life + 2 years)', status: 'COMPLIANT' },
                { record: 'FSVP Records', regulation: '21 CFR Part 1.510', period: '2 years beyond last use', status: 'COMPLIANT' },
                { record: 'Automotive Safety/Liability Records', regulation: 'IATF 16949 §7.5.3.2', period: 'Minimum 15 years (configure per OEM CSR)', status: 'COMPLIANT' },
                { record: 'EU Machinery Technical File', regulation: 'Machinery Regulation 2023/1230', period: '10 years after last date of manufacture', status: 'PARTIAL' },
                { record: 'PSM Training Records', regulation: '29 CFR 1910.119(g)(3)', period: 'Minimum 3 years', status: 'NON_COMPLIANT' },
              ].map((row) => (
                <tr key={row.record}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800">{row.record}</td>
                  <td className="py-2.5 pr-4 text-gray-500 font-mono">{row.regulation}</td>
                  <td className="py-2.5 pr-4 text-gray-600">{row.period}</td>
                  <td className="py-2.5">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_COLORS[row.status])}>
                      {row.status === 'NON_COMPLIANT' ? 'Non-Compliant' : row.status === 'PARTIAL' ? 'Partial' : 'Compliant'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
