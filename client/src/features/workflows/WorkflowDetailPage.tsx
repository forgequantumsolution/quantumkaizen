import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronUp, Clock, User,
  CheckCircle2, Circle, AlertCircle, Loader2, ExternalLink,
  Play, Check, Ban, StickyNote, Plus, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  WORKFLOWS, ACTIVE_INSTANCES, MODULE_CONFIG, INDUSTRY_CONFIG,
  COMPLEXITY_CONFIG, STATUS_CONFIG,
} from './data';
import type { Workflow, ActiveInstance, InstanceStatus } from './data';

// ─── Step status types ────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

const STEP_STATUS_CONFIG: Record<StepStatus, {
  label: string; ring: string; fill: string; text: string; icon: React.ElementType;
}> = {
  pending:     { label: 'Pending',     ring: 'ring-gray-200',   fill: 'bg-gray-100',    text: 'text-gray-400',   icon: Circle       },
  in_progress: { label: 'In Progress', ring: 'ring-amber-300',  fill: 'bg-amber-50',    text: 'text-amber-600',  icon: Loader2      },
  completed:   { label: 'Completed',   ring: 'ring-emerald-300',fill: 'bg-emerald-50',  text: 'text-emerald-600',icon: CheckCircle2 },
  blocked:     { label: 'Blocked',     ring: 'ring-red-300',    fill: 'bg-red-50',      text: 'text-red-600',    icon: AlertCircle  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function IndustryPill({ industry }: { industry: 'pharma' | 'chemical' | 'food' }) {
  const cfg = INDUSTRY_CONFIG[industry];
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.pill)}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function InstanceCard({ inst }: { inst: ActiveInstance }) {
  const st = STATUS_CONFIG[inst.status];
  const pct = Math.round((inst.currentStep / inst.totalSteps) * 100);
  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="font-mono text-[10px] text-gray-400">{inst.id}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: INDUSTRY_CONFIG[inst.industry].color + '15', color: INDUSTRY_CONFIG[inst.industry].color }}>
              {inst.entityRef}
            </span>
          </div>
        </div>
        <span className={cn('px-2 py-0.5 rounded-lg text-[10px] font-semibold', st.bg, st.text)}>
          {inst.status}
        </span>
      </div>
      <div className="text-xs text-gray-700 font-medium mb-1">Step {inst.currentStep}/{inst.totalSteps} · {inst.currentStepLabel}</div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div className={cn('h-full rounded-full', st.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-1">
          <User size={10} />
          {inst.assignee}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={10} />
          Due {inst.dueDate}
        </div>
      </div>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────
interface StepCardProps {
  wf: Workflow;
  stepIndex: number;
  status: StepStatus;
  expanded: boolean;
  note: string;
  onToggle: () => void;
  onStatusChange: (s: StepStatus) => void;
  onNoteChange: (n: string) => void;
}

function StepCard({ wf, stepIndex, status, expanded, note, onToggle, onStatusChange, onNoteChange }: StepCardProps) {
  const step = wf.steps[stepIndex];
  const mod = MODULE_CONFIG[step.module];
  const sc = STEP_STATUS_CONFIG[status];
  const ModIcon = mod.icon;
  const StatusIcon = sc.icon;
  const [showNoteInput, setShowNoteInput] = useState(false);
  const navigate = useNavigate();

  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === wf.steps.length - 1;

  return (
    <div className="flex gap-4">
      {/* Left rail — step number + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <button
          onClick={onToggle}
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center ring-2 transition-all duration-200 shrink-0',
            sc.ring, sc.fill,
            expanded ? 'scale-110 shadow-md' : 'hover:scale-105'
          )}
        >
          {status === 'completed' ? (
            <Check size={15} className="text-emerald-600" />
          ) : status === 'in_progress' ? (
            <span className="text-[11px] font-bold text-amber-600">{stepIndex + 1}</span>
          ) : status === 'blocked' ? (
            <Ban size={13} className="text-red-500" />
          ) : (
            <span className="text-[11px] font-medium text-gray-400">{stepIndex + 1}</span>
          )}
        </button>
        {!isLast && (
          <div className={cn(
            'w-0.5 flex-1 min-h-[20px] mt-1 rounded-full transition-colors duration-300',
            status === 'completed' ? 'bg-emerald-300' : 'bg-gray-150 bg-gray-200'
          )} />
        )}
      </div>

      {/* Right — step content */}
      <div className={cn(
        'flex-1 mb-3 rounded-xl border transition-all duration-200 overflow-hidden',
        expanded ? 'border-gray-300 shadow-md' : 'border-gray-200 hover:border-gray-300',
        status === 'completed' ? 'bg-gray-50/70' : 'bg-white',
      )}>
        {/* Header row — always visible */}
        <button className="w-full text-left px-4 py-3.5 flex items-center gap-3" onClick={onToggle}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: mod.color + '15' }}>
            <ModIcon size={14} style={{ color: mod.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'text-sm font-semibold',
                status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
              )}>
                {step.label}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: mod.color + '12', color: mod.color }}>
                {mod.label}
              </span>
              {status !== 'pending' && (
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', sc.fill, sc.text)}>
                  {sc.label}
                </span>
              )}
            </div>
            {!expanded && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{step.desc}</p>
            )}
          </div>
          {expanded ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
        </button>

        {/* Expanded body */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Full description */}
            <p className="text-sm text-gray-600 leading-relaxed mt-3 mb-4">{step.desc}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Typical Inputs */}
              <div className="bg-blue-50/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">Inputs Required</p>
                <ul className="space-y-1">
                  {mod.inputs.map((inp, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <ArrowRight size={10} className="text-blue-400 mt-0.5 shrink-0" />
                      {inp}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Outputs Produced */}
              <div className="bg-emerald-50/60 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Outputs Produced</p>
                <ul className="space-y-1">
                  {mod.outputs.map((out, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <Check size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                      {out}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Owner */}
            <div className="flex items-center gap-2 mb-4">
              <User size={12} className="text-gray-400" />
              <span className="text-xs text-gray-500">Typical owner:</span>
              <span className="text-xs font-medium text-gray-700">{mod.owner}</span>
            </div>

            {/* Notes */}
            {(note || showNoteInput) && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <StickyNote size={11} className="text-gray-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Notes</span>
                </div>
                <textarea
                  className="w-full text-xs border border-gray-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900/30 text-gray-700 bg-gray-50"
                  rows={3}
                  placeholder="Add notes, observations, or instructions for this step…"
                  value={note}
                  onChange={e => onNoteChange(e.target.value)}
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {status !== 'in_progress' && status !== 'completed' && (
                <button
                  onClick={() => onStatusChange('in_progress')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <Play size={11} /> Set In Progress
                </button>
              )}
              {status !== 'completed' && (
                <button
                  onClick={() => onStatusChange('completed')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                >
                  <Check size={11} /> Mark Complete
                </button>
              )}
              {status === 'completed' && (
                <button
                  onClick={() => onStatusChange('pending')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <Circle size={11} /> Reopen
                </button>
              )}
              {status !== 'blocked' && status !== 'completed' && (
                <button
                  onClick={() => onStatusChange('blocked')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <Ban size={11} /> Mark Blocked
                </button>
              )}
              {!showNoteInput && !note && (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  <StickyNote size={11} /> Add Note
                </button>
              )}
              {mod.link && (
                <button
                  onClick={() => navigate(mod.link!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900/5 text-slate-900 border border-slate-900/15 hover:bg-slate-900/10 transition-colors ml-auto"
                >
                  Open {mod.label} <ExternalLink size={11} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wf = WORKFLOWS.find(w => w.id === id);

  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>(() =>
    (wf?.steps ?? []).map(() => 'pending')
  );
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [localInstances, setLocalInstances] = useState<ActiveInstance[]>([]);
  const [showNewInstanceModal, setShowNewInstanceModal] = useState(false);
  const [newEntityRef, setNewEntityRef] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const entityRefInput = useRef<HTMLInputElement>(null);

  if (!wf) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500 text-sm">Workflow not found.</p>
        <Button variant="outline" onClick={() => navigate('/workflows')}>← Back to Workflows</Button>
      </div>
    );
  }

  const currentWf = wf;
  const instances = [...ACTIVE_INSTANCES.filter(i => i.workflowId === currentWf.id), ...localInstances];

  function handleStartInstance() {
    if (!newEntityRef.trim()) return;
    const inst: ActiveInstance = {
      id: `INST-${Date.now()}`,
      workflowId: currentWf.id,
      name: currentWf.name,
      industry: currentWf.industry,
      entityRef: newEntityRef.trim(),
      currentStep: 1,
      totalSteps: currentWf.steps.length,
      currentStepLabel: currentWf.steps[0]?.label ?? 'Step 1',
      assignee: newAssignee.trim() || 'Unassigned',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'On Track',
    };
    setLocalInstances(prev => [...prev, inst]);
    setShowNewInstanceModal(false);
    setNewEntityRef('');
    setNewAssignee('');
  }
  const ind = INDUSTRY_CONFIG[wf.industry];
  const completedCount = stepStatuses.filter(s => s === 'completed').length;
  const inProgressCount = stepStatuses.filter(s => s === 'in_progress').length;
  const blockedCount = stepStatuses.filter(s => s === 'blocked').length;
  const pct = Math.round((completedCount / wf.steps.length) * 100);

  function setStatus(i: number, s: StepStatus) {
    setStepStatuses(prev => { const n = [...prev]; n[i] = s; return n; });
  }

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate('/workflows')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back to Workflows
      </button>

      {/* Workflow header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <IndustryPill industry={wf.industry} />
              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', COMPLEXITY_CONFIG[wf.complexity])}>
                {wf.complexity} Complexity
              </span>
              <span className="text-xs text-gray-400 font-medium">{wf.steps.length} steps</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{wf.name}</h1>
            <p className="text-xs font-mono text-gray-400 mb-3">{wf.regulation}</p>
            <p className="text-sm text-gray-600 leading-relaxed">{wf.description}</p>
          </div>
          {/* Progress summary */}
          <div className="shrink-0 lg:w-56 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700">Template Progress</span>
              <span className="text-xs font-mono font-bold" style={{ color: ind.color }}>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Done',       value: completedCount,  color: 'text-emerald-600' },
                { label: 'Active',     value: inProgressCount, color: 'text-amber-600'   },
                { label: 'Blocked',    value: blockedCount,    color: 'text-red-500'      },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={cn('text-lg font-bold', color)}>{value}</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={11} />Avg cycle: <span className="font-medium text-gray-700">{wf.avgCycleTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* Left — interactive stepper */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Workflow Steps</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setStepStatuses(wf.steps.map(() => 'pending')); setNotes({}); }}
                className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
              >
                Reset all
              </button>
              <button
                onClick={() => setStepStatuses(wf.steps.map(() => 'completed'))}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                Complete all
              </button>
            </div>
          </div>

          <div>
            {wf.steps.map((_, i) => (
              <StepCard
                key={i}
                wf={wf}
                stepIndex={i}
                status={stepStatuses[i]}
                expanded={expandedStep === i}
                note={notes[i] ?? ''}
                onToggle={() => setExpandedStep(prev => prev === i ? null : i)}
                onStatusChange={s => setStatus(i, s)}
                onNoteChange={n => setNotes(prev => ({ ...prev, [i]: n }))}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar — active instances */}
        <div className="lg:w-72 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active Instances</h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {instances.length}
            </span>
          </div>

          {instances.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">No active instances for this workflow.</p>
            </div>
          ) : (
            instances.map(inst => <InstanceCard key={inst.id} inst={inst} />)
          )}

          <button
            onClick={() => { setShowNewInstanceModal(true); setTimeout(() => entityRefInput.current?.focus(), 50); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-colors"
          >
            <Plus size={14} /> Start New Instance
          </button>

          {/* New Instance Modal */}
          {showNewInstanceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Start New Instance</h3>
                <p className="text-xs text-gray-500 mb-5">Launching workflow: <span className="font-medium text-gray-700">{currentWf.name}</span></p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Entity / Batch Reference <span className="text-red-500">*</span></label>
                    <input
                      ref={entityRefInput}
                      value={newEntityRef}
                      onChange={e => setNewEntityRef(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleStartInstance(); if (e.key === 'Escape') setShowNewInstanceModal(false); }}
                      placeholder="e.g. B26-PA-0155, NC-2026-0050"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Assignee</label>
                    <input
                      value={newAssignee}
                      onChange={e => setNewAssignee(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleStartInstance(); if (e.key === 'Escape') setShowNewInstanceModal(false); }}
                      placeholder="e.g. Dr. Priya Sharma"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setShowNewInstanceModal(false); setNewEntityRef(''); setNewAssignee(''); }}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartInstance}
                    disabled={!newEntityRef.trim()}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                    style={{ background: newEntityRef.trim() ? '#0D0E17' : '#94A3B8', cursor: newEntityRef.trim() ? 'pointer' : 'not-allowed' }}
                  >
                    Start Instance
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Module legend */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Module Legend</p>
            <div className="space-y-1.5">
              {(Object.entries(MODULE_CONFIG) as [string, typeof MODULE_CONFIG[keyof typeof MODULE_CONFIG]][])
                .filter(([, cfg]) => wf.steps.some(s => s.module === (MODULE_CONFIG as any) || true)
                  && wf.steps.some(s => MODULE_CONFIG[s.module as keyof typeof MODULE_CONFIG] === cfg))
                .slice(0, 8)
                .map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const usedInWf = wf.steps.some(s => s.module === key);
                  if (!usedInWf) return null;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ backgroundColor: cfg.color + '18' }}>
                        <Icon size={11} style={{ color: cfg.color }} />
                      </div>
                      <span className="text-xs text-gray-600">{cfg.label}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
