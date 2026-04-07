// ============================================================
// INSPECTION READINESS PAGE
// Pre-audit preparation dashboard for FDA / EMA / IATF / OSHA / GFSI
// ============================================================

import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2,
  ChevronDown, ChevronRight, FileText, Download,
  Calendar, Clock, User, TrendingUp, TrendingDown,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { inspectionFrameworks, type InspectionFramework, type ChecklistItem, type ReadinessStatus } from './hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  PASS: { icon: CheckCircle2, label: 'Pass', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  PARTIAL: { icon: AlertTriangle, label: 'Partial', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  FAIL: { icon: XCircle, label: 'Fail', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  NA: { icon: ShieldCheck, label: 'N/A', color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
};

const READINESS_CONFIG: Record<ReadinessStatus, { label: string; color: string; ring: string }> = {
  GREEN: { label: 'Ready', color: 'text-emerald-600', ring: 'ring-emerald-200' },
  AMBER: { label: 'Needs Attention', color: 'text-amber-600', ring: 'ring-amber-200' },
  RED: { label: 'Not Ready', color: 'text-red-600', ring: 'ring-red-200' },
};

const BODY_COLORS: Record<string, string> = {
  'FDA': '#0a1628',
  'EMA / National CA': '#8b5cf6',
  'IATF Certification Body': '#0ea5e9',
  'OSHA / Third Party': '#ef4444',
  'Certification Body': '#10b981',
};

function ReadinessMeter({ score, status }: { score: number; status: ReadinessStatus }) {
  const cfg = READINESS_CONFIG[status];
  const color = status === 'GREEN' ? '#10b981' : status === 'AMBER' ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
          <span className="text-sm font-bold text-gray-900">{score}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;

  return (
    <div className={cn('flex items-start gap-3 py-2.5 px-3 rounded-lg border mb-1.5', cfg.bg)}>
      <Icon size={14} className={cn('shrink-0 mt-0.5', cfg.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wide">{item.category}</span>
          {item.criticalForInspection && (
            <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 rounded-full uppercase">Critical</span>
          )}
        </div>
        <p className="text-xs text-gray-800 font-medium">{item.requirement}</p>
        {item.evidence && (
          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
            <FileText size={9} /> {item.evidence}
          </p>
        )}
      </div>
      <span className={cn('text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded', cfg.color)}>{cfg.label}</span>
    </div>
  );
}

function FrameworkCard({ fw, isSelected, onSelect }: { fw: InspectionFramework; isSelected: boolean; onSelect: () => void }) {
  const cfg = READINESS_CONFIG[fw.status];
  const bodyColor = BODY_COLORS[fw.body] ?? '#64748b';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-xl border-2 transition-all duration-175',
        isSelected ? 'border-slate-900 bg-slate-900/5' : 'border-gray-100 hover:border-gray-200'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <span
            className="text-[10px] font-bold text-white px-2 py-0.5 rounded"
            style={{ backgroundColor: bodyColor }}
          >
            {fw.body}
          </span>
          <p className="text-sm font-semibold text-gray-900 mt-1.5 leading-tight">{fw.name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{fw.standard}</p>
        </div>
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold ring-4',
          cfg.ring,
          cfg.color
        )}>
          {fw.readinessScore}%
        </div>
      </div>

      <ReadinessMeter score={fw.readinessScore} status={fw.status} />

      <div className="flex gap-4 mt-3 text-[11px]">
        {fw.criticalOpenItems > 0 && (
          <span className="text-red-600 flex items-center gap-0.5">
            <XCircle size={10} /> {fw.criticalOpenItems} critical
          </span>
        )}
        {fw.majorOpenItems > 0 && (
          <span className="text-amber-600 flex items-center gap-0.5">
            <AlertTriangle size={10} /> {fw.majorOpenItems} major
          </span>
        )}
        {fw.minorOpenItems > 0 && (
          <span className="text-gray-500">{fw.minorOpenItems} minor</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400">
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          Next: {fw.nextExpectedDate}
        </span>
        {fw.lastInspectionDate && (
          <span>Last: {fw.lastInspectionDate}</span>
        )}
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InspectionReadinessPage() {
  const [selectedId, setSelectedId] = useState<string>(inspectionFrameworks[0].id);
  const selected = inspectionFrameworks.find((f) => f.id === selectedId)!;

  const passCount = selected.checklistItems.filter((i) => i.status === 'PASS').length;
  const failCount = selected.checklistItems.filter((i) => i.status === 'FAIL').length;
  const partialCount = selected.checklistItems.filter((i) => i.status === 'PARTIAL').length;
  const total = selected.checklistItems.length;

  // Group checklist by category
  const categories = [...new Set(selected.checklistItems.map((i) => i.category))];

  const summaryChartData = inspectionFrameworks.map((f) => ({
    name: f.body.split('/')[0].trim(),
    score: f.readinessScore,
    status: f.status,
  }));

  const tooltipStyle = { borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px', boxShadow: '0 4px 16px -4px rgba(0,0,0,0.12)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Inspection Readiness</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pre-audit preparation · FDA · EMA · IATF CB · OSHA · GFSI certification body
          </p>
        </div>
        <Button variant="outline" onClick={() => window.alert('Generating inspection readiness report...')}>
          <Download size={14} />
          Export Report
        </Button>
      </div>

      {/* Overview bar */}
      <Card>
        <CardHeader>
          <CardTitle>Readiness Overview — All Inspection Frameworks</CardTitle>
        </CardHeader>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summaryChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Readiness']} />
              <Bar dataKey="score" name="Readiness" radius={[4, 4, 0, 0]}>
                {summaryChartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.status === 'GREEN' ? '#10b981' : entry.status === 'AMBER' ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Framework selector + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Framework list */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 px-1">Inspection Frameworks</h2>
          {inspectionFrameworks.map((fw) => (
            <FrameworkCard
              key={fw.id}
              fw={fw}
              isSelected={selectedId === fw.id}
              onSelect={() => setSelectedId(fw.id)}
            />
          ))}
        </div>

        {/* Checklist detail */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <Card className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold text-white px-2 py-0.5 rounded"
                    style={{ backgroundColor: BODY_COLORS[selected.body] ?? '#64748b' }}
                  >
                    {selected.body}
                  </span>
                  <span className="text-xs text-gray-400">{selected.standard}</span>
                </div>
                <h2 className="text-base font-semibold text-gray-900">{selected.name}</h2>
              </div>
              <div className="text-right">
                <div className={cn('text-3xl font-bold', READINESS_CONFIG[selected.status].color)}>
                  {selected.readinessScore}%
                </div>
                <div className={cn('text-xs font-medium', READINESS_CONFIG[selected.status].color)}>
                  {READINESS_CONFIG[selected.status].label}
                </div>
              </div>
            </div>

            {/* Checklist summary */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{passCount}</p>
                <p className="text-xs text-emerald-700">Pass</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{partialCount}</p>
                <p className="text-xs text-amber-700">Partial</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{failCount}</p>
                <p className="text-xs text-red-700">Fail</p>
              </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Calendar size={11} /> Next expected: <strong className="text-gray-700">{selected.nextExpectedDate}</strong></span>
              {selected.lastInspectionDate && (
                <span className="flex items-center gap-1"><Clock size={11} /> Last: <strong className="text-gray-700">{selected.lastInspectionDate}</strong></span>
              )}
            </div>
          </Card>

          {/* Checklist by category */}
          {categories.map((cat) => {
            const items = selected.checklistItems.filter((i) => i.category === cat);
            const catFails = items.filter((i) => i.status === 'FAIL').length;
            const catPartials = items.filter((i) => i.status === 'PARTIAL').length;

            return (
              <Card key={cat} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{cat}</h3>
                  <div className="flex gap-2 text-xs">
                    {catFails > 0 && <span className="text-red-600 font-medium">{catFails} fail</span>}
                    {catPartials > 0 && <span className="text-amber-600 font-medium">{catPartials} partial</span>}
                  </div>
                </div>
                <div>
                  {items.map((item) => (
                    <ChecklistRow key={item.id} item={item} />
                  ))}
                </div>
              </Card>
            );
          })}

          {/* Action required for FAIL items */}
          {failCount > 0 && (
            <Card className="p-4 border-red-200 bg-red-50/50">
              <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                <XCircle size={14} /> Critical Actions Required Before Inspection
              </h3>
              <div className="space-y-2">
                {selected.checklistItems.filter((i) => i.status === 'FAIL').map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-xs">
                    <span className="text-red-500 shrink-0 mt-0.5">•</span>
                    <div>
                      <p className="font-medium text-red-800">[{item.category}] {item.requirement}</p>
                      {item.evidence && <p className="text-red-600 mt-0.5">Current state: {item.evidence}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                className="mt-3"
                onClick={() => window.alert('Creating CAPA for inspection critical items...')}
              >
                <AlertTriangle size={13} />
                Create CAPAs for Critical Items
              </Button>
            </Card>
          )}

          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.alert('Generating inspection checklist PDF...')}>
              <Download size={13} /> Inspection Checklist
            </Button>
            <Button variant="outline" onClick={() => window.alert('Generating gap analysis report...')}>
              <FileText size={13} /> Gap Analysis Report
            </Button>
            <Button variant="outline" onClick={() => window.alert('Generating training compliance evidence...')}>
              <FileText size={13} /> Training Evidence Package
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
