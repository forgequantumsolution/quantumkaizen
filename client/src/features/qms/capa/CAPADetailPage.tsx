import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Download,
  Clock,
  User,
  Calendar,
  Building2,
  Link2,
  Wrench,
  FileText,
  CheckCircle2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import TraceabilityChain from '@/components/shared/TraceabilityChain';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatusBadge,
  SeverityBadge,
  DataTable,
} from '@/components/ui';
import type { Column } from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import ApprovalTimeline from '@/components/ui/ApprovalTimeline';
import { cn, formatDate, formatDateTime, daysSince } from '@/lib/utils';
import { useCAPA } from './hooks';
import type { CAPARecord, CAPAAction, CAPALifecycle } from './hooks';

// ── Lifecycle Steps ─────────────────────────────────────────────────────────

const LIFECYCLE_STEPS: { key: CAPALifecycle; label: string }[] = [
  { key: 'INITIATED', label: 'Initiated' },
  { key: 'CONTAINMENT', label: 'Containment' },
  { key: 'ROOT_CAUSE_ANALYSIS', label: 'Root Cause' },
  { key: 'ACTION_DEFINITION', label: 'Actions' },
  { key: 'IMPLEMENTATION', label: 'Implementation' },
  { key: 'EFFECTIVENESS_VERIFICATION', label: 'Verification' },
  { key: 'CLOSED', label: 'Closed' },
];

const FISHBONE_LABELS: Record<string, { label: string; color: string }> = {
  man: { label: 'Man', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  machine: { label: 'Machine', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  material: { label: 'Material', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  method: { label: 'Method', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  measurement: { label: 'Measurement', color: 'bg-sky-100 text-sky-700 border-sky-200' },
  environment: { label: 'Environment', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

// ── Tab Definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'root-cause', label: 'Root Cause' },
  { id: 'actions', label: 'Actions' },
  { id: 'effectiveness', label: 'Effectiveness' },
  { id: 'history', label: 'History' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function CAPADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: capa, isLoading } = useCAPA(id!);
  const [activeTab, setActiveTab] = useState('details');
  const [checkIns, setCheckIns] = useState([
    { day: 30, label: '30-Day Check-in', status: 'pending' as 'pending'|'pass'|'fail', notes: '', dueDate: '' },
    { day: 60, label: '60-Day Check-in', status: 'pending' as 'pending'|'pass'|'fail', notes: '', dueDate: '' },
    { day: 90, label: '90-Day Verification', status: 'pending' as 'pending'|'pass'|'fail', notes: '', dueDate: '' },
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!capa) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">CAPA not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/capa')}>
          Back to List
        </Button>
      </div>
    );
  }

  const currentStepIdx = LIFECYCLE_STEPS.findIndex((s) => s.key === capa.status);

  // ── Action Columns ──────────────────────────────────────────────────────

  const actionColumns: Column<CAPAAction>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={row.type === 'CORRECTIVE' ? 'info' : 'purple'}>
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="block max-w-sm truncate text-slate-700">{row.description}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (row) => <span className="text-slate-600">{row.owner}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => {
        const overdue =
          new Date(row.dueDate) < new Date() && row.status !== 'COMPLETED' && row.status !== 'VERIFIED';
        return (
          <span className={cn('text-sm', overdue && 'text-red-600 font-semibold')}>
            {formatDate(row.dueDate)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/qms/capa')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-0.5"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-semibold text-navy-700">
                {capa.capaNumber}
              </span>
              <SeverityBadge severity={capa.severity} />
              <StatusBadge status={capa.status} />
            </div>
            <h1 className="text-xl font-bold text-slate-900">{capa.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate('/qms/risks', { state: { linkCapa: capa?.capaNumber } })}>
            <Shield size={14} />
            Link to Risk
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Lifecycle Progress Bar */}
      <Card>
        <div className="flex items-center justify-between gap-1">
          {LIFECYCLE_STEPS.map((step, idx) => {
            const isComplete = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            return (
              <div key={step.key} className="flex items-center gap-1 flex-1">
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div
                    className={cn(
                      'w-full h-2 rounded-full transition-colors',
                      isComplete
                        ? 'bg-emerald-500'
                        : isCurrent
                          ? 'bg-blue-600'
                          : 'bg-gray-200',
                    )}
                  />
                  <span
                    className={cn(
                      'mt-2 text-[10px] font-medium text-center leading-tight',
                      isComplete
                        ? 'text-emerald-600'
                        : isCurrent
                          ? 'text-blue-600'
                          : 'text-gray-400',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main Content + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card noPadding>
            <div className="px-6 pt-4">
              <Tabs
                tabs={TABS.map((t) => ({
                  ...t,
                  count:
                    t.id === 'actions'
                      ? capa.actions.length
                      : t.id === 'history'
                        ? capa.history.length
                        : undefined,
                }))}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
            <div className="p-6">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Description
                      </dt>
                      <dd className="text-slate-700 leading-relaxed">{capa.description}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Source
                      </dt>
                      <dd>
                        <Badge variant="info">{capa.source}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Department
                      </dt>
                      <dd className="text-slate-800 font-medium">{capa.department}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Product / Process
                      </dt>
                      <dd className="text-slate-800 font-medium">
                        {capa.productProcess || '---'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Owner
                      </dt>
                      <dd className="text-slate-800 font-medium">{capa.owner}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Due Date
                      </dt>
                      <dd
                        className={cn(
                          'font-medium',
                          new Date(capa.dueDate) < new Date() && capa.status !== 'CLOSED'
                            ? 'text-red-600'
                            : 'text-slate-800',
                        )}
                      >
                        {formatDate(capa.dueDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Severity
                      </dt>
                      <dd>
                        <SeverityBadge severity={capa.severity} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                        Status
                      </dt>
                      <dd>
                        <StatusBadge status={capa.status} />
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              {/* Root Cause Tab */}
              {activeTab === 'root-cause' && (
                <div className="space-y-6">
                  {/* 5-Whys */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">5-Why Analysis</h4>
                    {capa.fiveWhys.length > 0 ? (
                      <div className="space-y-3">
                        {capa.fiveWhys.map((w) => (
                          <div
                            key={w.whyNumber}
                            className="border border-slate-200 rounded-lg p-4 bg-slate-50/50"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/10 text-blue-600 text-sm font-bold shrink-0">
                                {w.whyNumber}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{w.question}</p>
                                <p className="text-sm text-slate-600 mt-1">{w.answer}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic py-4 text-center">
                        No 5-Why analysis recorded yet
                      </p>
                    )}
                  </div>

                  {/* Fishbone Diagram Visual */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-4">
                      Fishbone (Ishikawa) Diagram
                    </h4>
                    {Object.values(capa.fishbone).some((arr) => arr.length > 0) ? (
                      <div className="relative">
                        {/* SVG Fishbone */}
                        <svg
                          viewBox="0 0 800 400"
                          className="w-full h-auto"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {/* Main spine */}
                          <line
                            x1="50"
                            y1="200"
                            x2="720"
                            y2="200"
                            stroke="#94a3b8"
                            strokeWidth="3"
                          />
                          {/* Arrow head */}
                          <polygon points="720,200 700,188 700,212" fill="#94a3b8" />
                          {/* Effect box */}
                          <rect
                            x="720"
                            y="175"
                            width="70"
                            height="50"
                            rx="6"
                            fill="#0a1628"
                          />
                          <text
                            x="755"
                            y="197"
                            textAnchor="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="600"
                          >
                            Root
                          </text>
                          <text
                            x="755"
                            y="212"
                            textAnchor="middle"
                            fill="white"
                            fontSize="10"
                            fontWeight="600"
                          >
                            Cause
                          </text>

                          {/* Top branches: Man, Machine, Material */}
                          {/* Man */}
                          <line x1="180" y1="50" x2="250" y2="200" stroke="#3b82f6" strokeWidth="2" />
                          <text x="150" y="40" fill="#3b82f6" fontSize="12" fontWeight="700">
                            Man
                          </text>
                          {capa.fishbone.man.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={160 + i * 15}
                                y1={70 + i * 25}
                                x2={210 + i * 10}
                                y2={120 + i * 25}
                                stroke="#93c5fd"
                                strokeWidth="1.5"
                              />
                              <text
                                x={145 + i * 15}
                                y={68 + i * 25}
                                fill="#1e40af"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 30 ? c.text.slice(0, 30) + '...' : c.text}
                              </text>
                            </g>
                          ))}

                          {/* Machine */}
                          <line x1="370" y1="50" x2="420" y2="200" stroke="#8b5cf6" strokeWidth="2" />
                          <text x="340" y="40" fill="#8b5cf6" fontSize="12" fontWeight="700">
                            Machine
                          </text>
                          {capa.fishbone.machine.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={350 + i * 15}
                                y1={70 + i * 25}
                                x2={395 + i * 10}
                                y2={120 + i * 25}
                                stroke="#c4b5fd"
                                strokeWidth="1.5"
                              />
                              <text
                                x={335 + i * 15}
                                y={68 + i * 25}
                                fill="#5b21b6"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 30 ? c.text.slice(0, 30) + '...' : c.text}
                              </text>
                            </g>
                          ))}

                          {/* Material */}
                          <line x1="550" y1="50" x2="580" y2="200" stroke="#f59e0b" strokeWidth="2" />
                          <text x="520" y="40" fill="#f59e0b" fontSize="12" fontWeight="700">
                            Material
                          </text>
                          {capa.fishbone.material.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={530 + i * 15}
                                y1={70 + i * 25}
                                x2={565 + i * 10}
                                y2={120 + i * 25}
                                stroke="#fcd34d"
                                strokeWidth="1.5"
                              />
                              <text
                                x={515 + i * 15}
                                y={68 + i * 25}
                                fill="#92400e"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 30 ? c.text.slice(0, 30) + '...' : c.text}
                              </text>
                            </g>
                          ))}

                          {/* Bottom branches: Method, Measurement, Environment */}
                          {/* Method */}
                          <line x1="180" y1="350" x2="250" y2="200" stroke="#10b981" strokeWidth="2" />
                          <text x="150" y="370" fill="#10b981" fontSize="12" fontWeight="700">
                            Method
                          </text>
                          {capa.fishbone.method.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={160 + i * 15}
                                y1={330 - i * 25}
                                x2={210 + i * 10}
                                y2={280 - i * 25}
                                stroke="#6ee7b7"
                                strokeWidth="1.5"
                              />
                              <text
                                x={145 + i * 15}
                                y={335 - i * 25}
                                fill="#065f46"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 35 ? c.text.slice(0, 35) + '...' : c.text}
                              </text>
                            </g>
                          ))}

                          {/* Measurement */}
                          <line x1="370" y1="350" x2="420" y2="200" stroke="#0ea5e9" strokeWidth="2" />
                          <text x="330" y="370" fill="#0ea5e9" fontSize="12" fontWeight="700">
                            Measurement
                          </text>
                          {capa.fishbone.measurement.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={350 + i * 15}
                                y1={330 - i * 25}
                                x2={395 + i * 10}
                                y2={280 - i * 25}
                                stroke="#7dd3fc"
                                strokeWidth="1.5"
                              />
                              <text
                                x={335 + i * 15}
                                y={335 - i * 25}
                                fill="#0c4a6e"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 30 ? c.text.slice(0, 30) + '...' : c.text}
                              </text>
                            </g>
                          ))}

                          {/* Environment */}
                          <line x1="550" y1="350" x2="580" y2="200" stroke="#f97316" strokeWidth="2" />
                          <text x="510" y="370" fill="#f97316" fontSize="12" fontWeight="700">
                            Environment
                          </text>
                          {capa.fishbone.environment.map((c, i) => (
                            <g key={c.id}>
                              <line
                                x1={530 + i * 15}
                                y1={330 - i * 25}
                                x2={565 + i * 10}
                                y2={280 - i * 25}
                                stroke="#fdba74"
                                strokeWidth="1.5"
                              />
                              <text
                                x={515 + i * 15}
                                y={335 - i * 25}
                                fill="#9a3412"
                                fontSize="8"
                                textAnchor="end"
                              >
                                {c.text.length > 30 ? c.text.slice(0, 30) + '...' : c.text}
                              </text>
                            </g>
                          ))}
                        </svg>

                        {/* Detailed List Below SVG */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                          {Object.entries(FISHBONE_LABELS).map(([key, meta]) => {
                            const causes = capa.fishbone[key as keyof typeof capa.fishbone] || [];
                            if (causes.length === 0) return null;
                            return (
                              <div
                                key={key}
                                className={cn('border rounded-lg p-3', meta.color)}
                              >
                                <p className="text-xs font-semibold mb-2">{meta.label}</p>
                                <ul className="space-y-1">
                                  {causes.map((c) => (
                                    <li key={c.id} className="text-xs leading-snug">
                                      {c.text}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic py-4 text-center">
                        No fishbone data recorded yet
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions Tab */}
              {activeTab === 'actions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      {capa.actions.length} action{capa.actions.length !== 1 ? 's' : ''} defined
                    </p>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4" />
                      Add Action
                    </Button>
                  </div>
                  {capa.actions.length > 0 ? (
                    <>
                      <DataTable columns={actionColumns} data={capa.actions} />
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Timeline</p>
                        {(capa?.actions || []).map((action: any, idx: number) => {
                          const total = action.targetDate ? Math.max(1, Math.ceil((new Date(action.targetDate).getTime() - new Date(capa.createdAt).getTime()) / 86400000)) : 30;
                          const elapsed = Math.ceil((Date.now() - new Date(capa.createdAt).getTime()) / 86400000);
                          const pct = Math.min(100, Math.max(5, (elapsed / total) * 100));
                          const color = action.status === 'COMPLETED' ? 'bg-green-400' : pct > 90 ? 'bg-red-400' : 'bg-amber-400';
                          return (
                            <div key={idx} className="flex items-center gap-3 text-xs">
                              <span className="w-32 truncate text-gray-600">{action.title || `Action ${idx+1}`}</span>
                              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', color)} style={{width:`${pct}%`}} />
                              </div>
                              <span className="w-16 text-gray-400 text-right">{action.targetDate ? new Date(action.targetDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <Wrench className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No actions defined yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Effectiveness Tab */}
              {activeTab === 'effectiveness' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Verify that corrective actions remain effective over time. Each check-in assesses whether the root cause has been eliminated.</p>
                  {checkIns.map((ci, idx) => (
                    <div key={ci.day} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                            ci.status === 'pass' ? 'bg-green-100 text-green-700' :
                            ci.status === 'fail' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500')}>
                            {ci.day}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{ci.label}</span>
                        </div>
                        <div className="flex gap-2">
                          {(['pending','pass','fail'] as const).map(s => (
                            <button key={s} onClick={() => setCheckIns(c => c.map((x,i) => i===idx ? {...x,status:s} : x))}
                              className={cn('text-xs px-2 py-0.5 rounded-full border font-medium transition-colors',
                                ci.status===s ? (s==='pass'?'bg-green-100 text-green-700 border-green-300': s==='fail'?'bg-red-100 text-red-700 border-red-300':'bg-gray-200 text-gray-600 border-gray-300')
                                : 'border-gray-200 text-gray-400 hover:bg-gray-50')}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea value={ci.notes} onChange={e => setCheckIns(c => c.map((x,i) => i===idx ? {...x,notes:e.target.value} : x))}
                        placeholder="Notes on effectiveness verification..."
                        rows={2} className="input-base h-auto min-h-[56px] py-2 resize-none text-sm w-full" />
                    </div>
                  ))}
                  {checkIns.every(c => c.status === 'pass') && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 size={16} className="text-green-600" />
                      <p className="text-sm font-medium text-green-800">CAPA Verified Effective — All check-ins passed</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  {capa.history.length > 0 ? (
                    <ApprovalTimeline
                      stages={capa.history.map((h, idx) => ({
                        name: h.action,
                        status:
                          idx === capa.history.length - 1
                            ? 'active'
                            : ('completed' as const),
                        approver: h.user,
                        timestamp: formatDateTime(h.timestamp),
                        comment: h.details,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-slate-400 italic text-center py-8">
                      No history entries
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Metadata */}
          <Card>
            <h4 className="text-sm font-semibold text-slate-800 mb-4">Metadata</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Owner</p>
                  <p className="font-medium text-slate-800">{capa.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{capa.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="font-medium text-slate-800">{formatDate(capa.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Age</p>
                  <p className="font-medium text-slate-800">{daysSince(capa.createdAt)} days</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Created By</p>
                  <p className="font-medium text-slate-800">{capa.createdBy}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Linked Records */}
          {capa.linkedSourceRecord && (
            <Card>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Linked Records</h4>
              <div className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg bg-slate-50">
                <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-mono text-xs font-medium text-navy-700">
                  {capa.linkedSourceRecord}
                </span>
              </div>
            </Card>
          )}

          {/* Linked Records — Source NC + Risk */}
          <Card>
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Linked Records</p>
              <div className="space-y-2">
                {capa?.linkedSourceRecord && (
                  <button onClick={() => navigate(`/qms/non-conformances/${capa.linkedSourceRecord}`)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-left hover:bg-red-100 transition-colors">
                    <AlertTriangle size={13} className="text-red-600 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-800">Source NC</p>
                      <p className="text-xs text-red-600">{capa?.linkedSourceRecord}</p>
                    </div>
                  </button>
                )}
                <button onClick={() => navigate('/qms/risks', { state: { linkCapa: capa?.capaNumber } })}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 text-left hover:bg-orange-100 transition-colors">
                  <Shield size={13} className="text-orange-600 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-800">Risk Register</p>
                    <p className="text-xs text-orange-600">View associated risks</p>
                  </div>
                </button>
              </div>
            </div>
          </Card>

          {/* Key Dates */}
          <Card>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Key Dates</h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Initiated</span>
                <span className="text-slate-800 font-medium">{formatDate(capa.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date</span>
                <span
                  className={cn(
                    'font-medium',
                    new Date(capa.dueDate) < new Date() && capa.status !== 'CLOSED'
                      ? 'text-red-600'
                      : 'text-slate-800',
                  )}
                >
                  {formatDate(capa.dueDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Updated</span>
                <span className="text-slate-800 font-medium">{formatDate(capa.updatedAt)}</span>
              </div>
              {capa.closedAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Closed</span>
                  <span className="text-emerald-600 font-medium">
                    {formatDate(capa.closedAt)}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
