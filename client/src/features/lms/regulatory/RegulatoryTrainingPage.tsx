// ============================================================
// REGULATORY TRAINING PAGE (LMS)
// Training requirements mapped to specific regulation clauses
// FDA / EU GMP / OSHA PSM / FSMA / IATF 16949
// ============================================================

import React, { useState } from 'react';
import {
  GraduationCap, CheckCircle2, AlertTriangle, XCircle,
  BookOpen, Users, Clock, Filter, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { regTrainingRequirements, type RegTrainingRequirement, type Industry, type ComplianceStatus } from '../../../features/compliance/hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const INDUSTRY_LABELS: Record<Industry, string> = {
  PHARMA: 'Pharma & Life Sciences',
  CHEMICAL: 'Chemical Manufacturing',
  FOOD: 'Food & Beverage',
  AUTOMOTIVE: 'Automotive & Machinery',
};

const INDUSTRY_COLORS: Record<Industry, string> = {
  PHARMA: '#0a1628',
  CHEMICAL: '#b8860b',
  FOOD: '#10b981',
  AUTOMOTIVE: '#0ea5e9',
};

const STATUS_CONFIG: Record<ComplianceStatus, { icon: React.ElementType; label: string; color: string; bg: string; border: string }> = {
  COMPLIANT: { icon: CheckCircle2, label: 'Compliant', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  PARTIAL: { icon: AlertTriangle, label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  NON_COMPLIANT: { icon: XCircle, label: 'Non-Compliant', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
};

function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border', cfg.color, cfg.bg, cfg.border)}>
      <Icon size={9} /> {cfg.label}
    </span>
  );
}

function RequirementCard({ req }: { req: RegTrainingRequirement }) {
  const StatusIcon = STATUS_CONFIG[req.complianceStatus].icon;
  const statusCfg = STATUS_CONFIG[req.complianceStatus];
  const industryColor = INDUSTRY_COLORS[req.industry];

  return (
    <Card className={cn('p-5 border-l-4', statusCfg.border)}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <span
              className="text-[10px] font-bold text-white px-2 py-0.5 rounded"
              style={{ backgroundColor: industryColor }}
            >
              {req.industry}
            </span>
            <span className="text-[10px] font-mono text-slate-900 bg-slate-900/10 px-2 py-0.5 rounded">
              {req.regulationClause}
            </span>
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{req.framework}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug">{req.requirement}</p>
        </div>
        <div className="text-right shrink-0">
          <ComplianceBadge status={req.complianceStatus} />
        </div>
      </div>

      {/* Completion rate bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Completion rate</span>
          <span className={cn(
            'font-semibold',
            req.completionRate >= 90 ? 'text-emerald-600' : req.completionRate >= 70 ? 'text-amber-600' : 'text-red-600'
          )}>
            {req.completionRate}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              req.completionRate >= 90 ? 'bg-emerald-500' : req.completionRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${req.completionRate}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <BookOpen size={9} /> Linked Training Programs
          </p>
          <ul className="space-y-0.5">
            {req.linkedTraining.map((t) => (
              <li key={t} className="flex items-center gap-1">
                <ChevronRight size={9} className="text-blue-600 shrink-0" />
                <span className="truncate">{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Users size={9} /> Affected Roles
          </p>
          <ul className="space-y-0.5">
            {req.affectedRoles.slice(0, 3).map((r) => (
              <li key={r} className="flex items-center gap-1">
                <ChevronRight size={9} className="text-gray-400 shrink-0" />
                <span className="truncate">{r}</span>
              </li>
            ))}
            {req.affectedRoles.length > 3 && (
              <li className="text-gray-400">+{req.affectedRoles.length - 3} more</li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Clock size={10} /> Frequency: <strong className="text-gray-700">{req.frequency}</strong>
        </span>
        <span>Retention: <strong className="text-gray-700">{req.retentionPeriod.split('(')[0].trim()}</strong></span>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegulatoryTrainingPage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<ComplianceStatus | 'ALL'>('ALL');

  const filtered = regTrainingRequirements.filter((r) => {
    if (selectedIndustry !== 'ALL' && r.industry !== selectedIndustry) return false;
    if (selectedStatus !== 'ALL' && r.complianceStatus !== selectedStatus) return false;
    return true;
  });

  const compliantCount = regTrainingRequirements.filter((r) => r.complianceStatus === 'COMPLIANT').length;
  const partialCount = regTrainingRequirements.filter((r) => r.complianceStatus === 'PARTIAL').length;
  const nonCompliantCount = regTrainingRequirements.filter((r) => r.complianceStatus === 'NON_COMPLIANT').length;

  const industryChartData = (['PHARMA', 'CHEMICAL', 'FOOD', 'AUTOMOTIVE'] as Industry[]).map((ind) => {
    const reqs = regTrainingRequirements.filter((r) => r.industry === ind);
    const avg = reqs.length ? Math.round(reqs.reduce((s, r) => s + r.completionRate, 0) / reqs.length) : 0;
    return { industry: INDUSTRY_LABELS[ind].split(' ')[0], completion: avg, color: INDUSTRY_COLORS[ind] };
  });

  const tooltipStyle = { borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Regulatory Training Requirements</h1>
          <p className="mt-1 text-sm text-gray-500">
            Training mapped to specific regulation clauses · 21 CFR · EU GMP · OSHA PSM · FSMA · IATF 16949
          </p>
        </div>
        <Button onClick={() => window.alert('Generating regulatory training gap report...')}>
          <GraduationCap size={14} />
          Gap Report
        </Button>
      </div>

      {/* KPI + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI summary */}
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-xs text-gray-400">Total Regulatory Requirements</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{regTrainingRequirements.length}</p>
            <p className="text-xs text-gray-500">across 4 industries · 8 frameworks</p>
          </Card>
          <Card className="p-4 bg-emerald-50 border-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-800">Compliant</p>
              <p className="text-2xl font-bold text-emerald-700 ml-auto">{compliantCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-amber-50 border-amber-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Partial</p>
              <p className="text-2xl font-bold text-amber-700 ml-auto">{partialCount}</p>
            </div>
          </Card>
          <Card className="p-4 bg-red-50 border-red-100">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-red-600" />
              <p className="text-sm font-semibold text-red-800">Non-Compliant</p>
              <p className="text-2xl font-bold text-red-700 ml-auto">{nonCompliantCount}</p>
            </div>
          </Card>
        </div>

        {/* Completion by industry */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Training Completion by Industry</CardTitle>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryChartData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="industry" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Avg Completion']} />
                <Bar dataKey="completion" name="Avg Completion" radius={[4, 4, 0, 0]}>
                  {industryChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Regulatory Training Requirements by Industry */}
      <div>
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <span className="text-xs text-gray-500 flex items-center gap-1"><Filter size={12} /> Filter:</span>
          <div className="flex gap-1">
            {(['ALL', 'PHARMA', 'CHEMICAL', 'FOOD', 'AUTOMOTIVE'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedIndustry(v)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                  selectedIndustry === v ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {v === 'ALL' ? 'All' : INDUSTRY_LABELS[v].split(' ')[0]}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(['ALL', 'COMPLIANT', 'PARTIAL', 'NON_COMPLIANT'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedStatus(v)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                  selectedStatus === v ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {v === 'ALL' ? 'All Status' : v === 'NON_COMPLIANT' ? 'Non-Compliant' : v.charAt(0) + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} requirements</span>
        </div>

        {/* Industry sections */}
        {selectedIndustry === 'ALL'
          ? (['PHARMA', 'CHEMICAL', 'FOOD', 'AUTOMOTIVE'] as Industry[]).map((ind) => {
              const indReqs = filtered.filter((r) => r.industry === ind);
              if (indReqs.length === 0) return null;
              return (
                <div key={ind} className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: INDUSTRY_COLORS[ind] }}
                    />
                    <h2 className="text-sm font-semibold text-gray-800">{INDUSTRY_LABELS[ind]}</h2>
                    <span className="text-xs text-gray-400">{indReqs.length} requirements</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {indReqs.map((req) => <RequirementCard key={req.id} req={req} />)}
                  </div>
                </div>
              );
            })
          : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((req) => <RequirementCard key={req.id} req={req} />)}
            </div>
          )
        }

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <GraduationCap size={32} className="mx-auto mb-2 opacity-30" />
            <p>No training requirements match the selected filters.</p>
          </div>
        )}
      </div>

      {/* GAMP 5 Validation notice */}
      <Card className="bg-slate-900/5 border-slate-900/20 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          GAMP 5 System Validation — Training Records as GxP Evidence
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed">
          All training records in this LMS are maintained as GxP evidence per GAMP 5 Category 4/5 system requirements.
          Records include: trainee name, trainer/facilitator, training date (contemporaneous), training content version (locked to DMS version in effect at time of training),
          assessment score, and electronic signature of completion. Records satisfy 21 CFR Part 11 §11.10 and EU GMP Annex 11 §4.8 requirements.
          Retention configured per regulatory requirement (ranging from 2 years / FSMA to 15 years / IATF safety roles).
        </p>
        <div className="flex gap-3 mt-3">
          <Button variant="outline" onClick={() => window.alert('Viewing LMS validation documentation...')}>
            View Validation Package
          </Button>
          <Button variant="outline" onClick={() => window.alert('Generating ALCOA+ training record report...')}>
            ALCOA+ Evidence Report
          </Button>
        </div>
      </Card>
    </div>
  );
}
