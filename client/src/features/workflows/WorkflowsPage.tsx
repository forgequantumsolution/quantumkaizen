import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Clock, User, Activity, Network, ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  WORKFLOWS, ACTIVE_INSTANCES,
  MODULE_CONFIG, INDUSTRY_CONFIG, COMPLEXITY_CONFIG, STATUS_CONFIG,
} from './data';
import type { Industry, IndustryFilter, Workflow, ActiveInstance } from './data';

// ─── Sub-components ───────────────────────────────────────────────────────────
function IndustryPill({ industry }: { industry: Industry }) {
  const cfg = INDUSTRY_CONFIG[industry];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border', cfg.pill)}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function StepFlow({ steps }: { steps: Workflow['steps'] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 scrollbar-none">
      {steps.map((step, i) => {
        const cfg = MODULE_CONFIG[step.module];
        return (
          <React.Fragment key={i}>
            <div
              className="relative flex flex-col items-center shrink-0"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-50 transition-colors">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                <span className="text-[11px] text-gray-600 whitespace-nowrap font-medium">{step.label}</span>
              </div>
              {hovered === i && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white text-[10px] rounded-lg p-2.5 leading-relaxed z-20 shadow-xl pointer-events-none">
                  <p className="font-semibold mb-1" style={{ color: cfg.color }}>{step.label}</p>
                  <p className="text-gray-300">{step.desc}</p>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                </div>
              )}
            </div>
            {i < steps.length - 1 && <ChevronRight size={11} className="text-gray-300 shrink-0 mx-0.5" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function WorkflowCard({ wf, onClick }: { wf: Workflow; onClick: () => void }) {
  const ind = INDUSTRY_CONFIG[wf.industry];
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <IndustryPill industry={wf.industry} />
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', COMPLEXITY_CONFIG[wf.complexity])}>
              {wf.complexity}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 leading-snug group-hover:text-slate-900 transition-colors">
            {wf.name}
          </h3>
          <p className="text-[10px] font-mono text-gray-400 mt-0.5">{wf.regulation}</p>
        </div>
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
          style={{ backgroundColor: ind.color + '12' }}>
          <Network size={16} style={{ color: ind.color }} />
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed -mt-1 line-clamp-2">{wf.description}</p>

      <div className="border-t border-gray-100 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
          {wf.steps.length} Steps — hover for detail
        </p>
        <StepFlow steps={wf.steps} />
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <Clock size={11} className="text-gray-400" />
          Avg: <span className="font-medium text-gray-700 ml-1">{wf.avgCycleTime}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-900 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Open workflow <ArrowRight size={11} />
        </div>
      </div>
    </div>
  );
}

function InstanceRow({ inst }: { inst: ActiveInstance }) {
  const ind = INDUSTRY_CONFIG[inst.industry];
  const st  = STATUS_CONFIG[inst.status];
  const pct = Math.round((inst.currentStep / inst.totalSteps) * 100);
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 px-2 -mx-2 rounded-lg transition-colors">
      <div className="w-64 shrink-0 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-[10px] text-gray-400">{inst.id}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold font-mono"
            style={{ backgroundColor: ind.color + '15', color: ind.color }}>
            {inst.entityRef}
          </span>
        </div>
        <p className="text-xs font-medium text-gray-800 truncate">{inst.name}</p>
        <IndustryPill industry={inst.industry} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-gray-700">
            Step {inst.currentStep}/{inst.totalSteps} · {inst.currentStepLabel}
          </span>
          <span className="text-[11px] text-gray-400 font-mono">{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', st.bar)} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center gap-0.5 mt-1.5 overflow-hidden">
          {Array.from({ length: inst.totalSteps }).map((_, i) => (
            <div key={i} className={cn(
              'h-1 rounded-full transition-all',
              i < inst.currentStep - 1 ? 'bg-gray-400 w-3' :
              i === inst.currentStep - 1 ? cn('w-5', st.bar) : 'bg-gray-200 w-3'
            )} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <div className="w-5 h-5 rounded-full bg-slate-900/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-slate-900">
                {inst.assignee.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <span className="text-[11px] text-gray-700 font-medium">{inst.assignee}</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 text-right">Due {inst.dueDate}</p>
        </div>
        <span className={cn('px-2 py-1 rounded-lg text-[10px] font-semibold', st.bg, st.text)}>
          {inst.status}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const navigate = useNavigate();
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>('all');

  const filtered = useMemo(
    () => industryFilter === 'all' ? WORKFLOWS : WORKFLOWS.filter(w => w.industry === industryFilter),
    [industryFilter],
  );

  const filteredInstances = useMemo(
    () => industryFilter === 'all' ? ACTIVE_INSTANCES : ACTIVE_INSTANCES.filter(i => i.industry === industryFilter),
    [industryFilter],
  );

  const stats = {
    total:   ACTIVE_INSTANCES.length,
    onTrack: ACTIVE_INSTANCES.filter(i => i.status === 'On Track').length,
    atRisk:  ACTIVE_INSTANCES.filter(i => i.status === 'At Risk').length,
    overdue: ACTIVE_INSTANCES.filter(i => i.status === 'Overdue').length,
  };

  const TABS: { label: string; value: IndustryFilter; color: string }[] = [
    { label: 'All Industries',      value: 'all',      color: '#0a1628' },
    { label: 'Pharma & Life Sciences', value: 'pharma',color: INDUSTRY_CONFIG.pharma.color },
    { label: 'Chemical',             value: 'chemical', color: INDUSTRY_CONFIG.chemical.color },
    { label: 'Food & Beverage',      value: 'food',     color: INDUSTRY_CONFIG.food.color },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">End-to-End Workflows</h1>
        <p className="mt-1 text-sm text-gray-500">
          Industry-specific QMS workflows — click a card to open the interactive step-by-step view
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Workflows', value: stats.total,   color: 'text-slate-900', bg: 'bg-slate-50'   },
          { label: 'On Track',         value: stats.onTrack, color: 'text-emerald-700',bg: 'bg-emerald-50' },
          { label: 'At Risk',          value: stats.atRisk,  color: 'text-amber-700',  bg: 'bg-amber-50'   },
          { label: 'Overdue',          value: stats.overdue, color: 'text-red-700',    bg: 'bg-red-50'     },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl border border-gray-200 p-4', bg)}>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Industry tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setIndustryFilter(tab.value)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-175',
              industryFilter === tab.value
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            )}
            style={industryFilter === tab.value ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
          >
            {tab.label}
            <span className={cn('ml-2 px-1.5 py-0.5 rounded text-[10px]',
              industryFilter === tab.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              {tab.value === 'all' ? WORKFLOWS.length : WORKFLOWS.filter(w => w.industry === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Workflow cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filtered.map(wf => (
          <WorkflowCard key={wf.id} wf={wf} onClick={() => navigate(`/workflows/${wf.id}`)} />
        ))}
      </div>

      {/* Active instances */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} className="text-blue-600" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Active Workflow Instances ({filteredInstances.length})
          </h2>
        </div>
        <Card noPadding>
          <div className="px-5 py-2">
            {filteredInstances.map(inst => <InstanceRow key={inst.id} inst={inst} />)}
            {filteredInstances.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">No active instances for this industry</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
