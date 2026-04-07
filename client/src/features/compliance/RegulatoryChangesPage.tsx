// ============================================================
// REGULATORY CHANGES PAGE
// Track regulatory updates, impact assessments, and action items
// FDA / EMA / OSHA / ECHA / ICH / EU Commission
// ============================================================

import React, { useState } from 'react';
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight,
  FileText, Activity, GraduationCap, ExternalLink, Calendar, Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  regulatoryChanges,
  type RegulatoryChange,
  type SystemType,
  type ImpactLevel,
  type Industry,
} from './hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<ImpactLevel, { label: string; color: string; bg: string; border: string }> = {
  HIGH: { label: 'High Impact', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  MEDIUM: { label: 'Medium Impact', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  LOW: { label: 'Low Impact', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  MONITORING: { label: 'Monitoring', color: 'text-gray-600', bg: 'bg-gray-100' },
  ASSESSMENT: { label: 'Assessment', color: 'text-sky-700', bg: 'bg-sky-50' },
  ACTION: { label: 'Action Required', color: 'text-amber-700', bg: 'bg-amber-50' },
  CLOSED: { label: 'Closed', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const ACTION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-600' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-sky-600' },
  COMPLETED: { label: 'Done', color: 'text-emerald-600' },
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

const BODY_COLORS: Record<string, string> = {
  'FDA': '#0a1628',
  'EMA / EU Commission': '#8b5cf6',
  'European Commission': '#8b5cf6',
  'ECHA': '#10b981',
  'ICH': '#0ea5e9',
  'OSHA': '#ef4444',
};

function ChangeCard({ change }: { change: RegulatoryChange }) {
  const [expanded, setExpanded] = useState(false);
  const impact = IMPACT_CONFIG[change.impactLevel];
  const status = STATUS_CONFIG[change.status];
  const bodyColor = BODY_COLORS[change.regulatoryBody] ?? '#64748b';

  const completedActions = change.actionItems.filter((a) => a.status === 'COMPLETED').length;
  const totalActions = change.actionItems.length;

  return (
    <Card className={cn('p-5 border-l-4', impact.border)}>
      <div className="flex items-start gap-4">
        {/* Body badge */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 text-center leading-tight"
          style={{ backgroundColor: bodyColor }}
        >
          {change.regulatoryBody.split(' ')[0]}
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-1.5">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', impact.color, impact.bg)}>
                  {impact.label}
                </span>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded', status.color, status.bg)}>
                  {status.label}
                </span>
                {change.affectedSystems.map((sys) => {
                  const Icon = SYSTEM_ICONS[sys];
                  return (
                    <span
                      key={sys}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-white px-2 py-0.5 rounded"
                      style={{ backgroundColor: SYSTEM_COLORS[sys] }}
                    >
                      <Icon size={9} /> {sys}
                    </span>
                  );
                })}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 leading-snug">{change.title}</h3>
              <p className="text-[11px] font-mono text-gray-400 mt-0.5">{change.regulation} · {change.regulatoryBody}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-gray-500">Effective</p>
              <p className="text-xs font-semibold text-gray-800">{change.effectiveDate}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Published {change.publishedDate}</p>
            </div>
          </div>

          {/* Summary */}
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{change.summary}</p>

          {/* Action progress */}
          {totalActions > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${(completedActions / totalActions) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {completedActions}/{totalActions} actions done
              </span>
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-600-hover font-medium transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {expanded ? 'Hide' : 'Show'} action items ({totalActions})
          </button>

          {/* Action items */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {change.actionItems.map((action) => {
                const Icon = SYSTEM_ICONS[action.system];
                const actionStatus = ACTION_STATUS_CONFIG[action.status];
                return (
                  <div key={action.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: SYSTEM_COLORS[action.system] }}
                    >
                      <Icon size={11} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{action.system}</span>
                        <span className={cn('text-[10px] font-medium', actionStatus.color)}>{actionStatus.label}</span>
                      </div>
                      <p className="text-xs text-gray-700">{action.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                        <span>{action.owner}</span>
                        <span>Due: {action.dueDate}</span>
                      </div>
                    </div>
                    {action.status === 'COMPLETED' && (
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegulatoryChangesPage() {
  const [filterImpact, setFilterImpact] = useState<ImpactLevel | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterSystem, setFilterSystem] = useState<SystemType | 'ALL'>('ALL');

  const filtered = regulatoryChanges.filter((c) => {
    if (filterImpact !== 'ALL' && c.impactLevel !== filterImpact) return false;
    if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;
    if (filterSystem !== 'ALL' && !c.affectedSystems.includes(filterSystem)) return false;
    return true;
  });

  const actionRequired = regulatoryChanges.filter((c) => c.status === 'ACTION').length;
  const highImpact = regulatoryChanges.filter((c) => c.impactLevel === 'HIGH').length;
  const pendingActions = regulatoryChanges.flatMap((c) => c.actionItems).filter((a) => a.status === 'PENDING').length;

  // Upcoming effective dates (next 12 months)
  const upcoming = regulatoryChanges
    .filter((c) => c.status !== 'CLOSED')
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Regulatory Changes</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and respond to regulatory updates · Impact assessment across QMS · DMS · LMS
          </p>
        </div>
        <Button variant="outline" onClick={() => window.alert('Syncing regulatory change feed...')}>
          <RefreshCw size={14} />
          Sync Feed
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-400">Action Required</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{actionRequired}</p>
          <p className="text-xs text-gray-500">changes need action</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-400">High Impact Changes</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{highImpact}</p>
          <p className="text-xs text-gray-500">across all industries</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-400">Pending Action Items</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{pendingActions}</p>
          <p className="text-xs text-gray-500">across QMS / DMS / LMS</p>
        </Card>
      </div>

      {/* Upcoming calendar */}
      <Card>
        <CardHeader>
          <CardTitle>Regulatory Effective Date Calendar</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcoming.map((change) => {
            const impact = IMPACT_CONFIG[change.impactLevel];
            const bodyColor = BODY_COLORS[change.regulatoryBody] ?? '#64748b';
            const isOverdue = new Date(change.effectiveDate) < new Date();

            return (
              <div
                key={change.id}
                className={cn('p-3 rounded-lg border', impact.border, impact.bg)}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: bodyColor }}
                  >
                    {change.regulatoryBody.split('/')[0].trim()}
                  </span>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">IN EFFECT</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-gray-800 leading-tight">{change.title.split('—')[0].trim()}</p>
                <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar size={10} />
                  Effective: <strong>{change.effectiveDate}</strong>
                </p>
                <p className={cn('text-[10px] font-semibold mt-1', impact.color)}>{impact.label}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs text-gray-500 flex items-center gap-1"><Filter size={12} /> Filter:</span>

        <div className="flex gap-1">
          {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterImpact(v)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                filterImpact === v ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {v === 'ALL' ? 'All Impact' : v}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['ALL', 'ACTION', 'ASSESSMENT', 'MONITORING', 'CLOSED'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterStatus(v)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                filterStatus === v ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {v === 'ALL' ? 'All Status' : STATUS_CONFIG[v]?.label ?? v}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['ALL', 'QMS', 'DMS', 'LMS'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilterSystem(v as SystemType | 'ALL')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors duration-175',
                filterSystem === v ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {v === 'ALL' ? 'All Systems' : v}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {regulatoryChanges.length} changes</span>
      </div>

      {/* Change cards */}
      <div className="space-y-4">
        {filtered.map((change) => (
          <ChangeCard key={change.id} change={change} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <RefreshCw size={32} className="mx-auto mb-2 opacity-30" />
            <p>No regulatory changes match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
