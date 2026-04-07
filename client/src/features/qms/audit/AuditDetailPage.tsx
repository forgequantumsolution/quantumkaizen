import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, Lightbulb, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAudit, useUpdateAuditStatus, type AuditStatus, type AuditFinding } from './hooks';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<AuditStatus, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const FINDING_CONFIG = {
  MAJOR: { label: 'Major NC', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle },
  MINOR: { label: 'Minor NC', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: AlertTriangle },
  OFI: { label: 'OFI', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Lightbulb },
};

// ── Checklist Types ─────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  clause: string;
  question: string;
  response: 'yes' | 'no' | 'na' | '';
  notes: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: '1', clause: '4.1', question: 'Has the organization determined external and internal issues relevant to its purpose?', response: '', notes: '' },
  { id: '2', clause: '4.2', question: 'Have interested parties and their requirements been identified?', response: '', notes: '' },
  { id: '3', clause: '5.1', question: 'Does top management demonstrate leadership and commitment to the QMS?', response: '', notes: '' },
  { id: '4', clause: '6.1', question: 'Have risks and opportunities been determined and addressed?', response: '', notes: '' },
  { id: '5', clause: '7.1', question: 'Are the necessary resources for the QMS determined and provided?', response: '', notes: '' },
  { id: '6', clause: '8.1', question: 'Are operational planning and control processes implemented?', response: '', notes: '' },
  { id: '7', clause: '9.1', question: 'Is performance monitoring and measurement being conducted?', response: '', notes: '' },
  { id: '8', clause: '10.2', question: 'Are nonconformities identified and corrective actions taken?', response: '', notes: '' },
];

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: audit, isLoading } = useAudit(id!);
  const updateStatus = useUpdateAuditStatus();
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'checklist' | 'team'>('overview');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [newFinding, setNewFinding] = useState({ type: 'MINOR' as 'MAJOR' | 'MINOR' | 'OFI', clause: '', description: '' });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!audit) return null;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'findings', label: `Findings (${audit.findings.length})` },
    { key: 'checklist', label: `Checklist${checklist.length > 0 ? ` (${checklist.length})` : ''}` },
    { key: 'team', label: 'Audit Team' },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-mono-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {audit.auditNumber}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[audit.status]}`}>
                {audit.status.replace('_', ' ')}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900/10 text-slate-900 font-medium">
                {audit.type}
              </span>
            </div>
            <h1 className="text-h1 text-gray-900">{audit.title}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          {audit.status === 'PLANNED' && (
            <Button variant="primary" size="sm"
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutateAsync({ id: audit.id, status: 'IN_PROGRESS' })}>
              Start Audit
            </Button>
          )}
          {audit.status === 'IN_PROGRESS' && (
            <Button variant="primary" size="sm"
              disabled={updateStatus.isPending}
              onClick={() => updateStatus.mutateAsync({ id: audit.id, status: 'COMPLETED' })}>
              <CheckCircle2 size={14} />
              Complete Audit
            </Button>
          )}
        </div>
      </div>

      {/* Findings summary pills */}
      {(audit.majorFindings > 0 || audit.minorFindings > 0 || audit.ofiCount > 0) && (
        <div className="flex gap-2">
          {audit.majorFindings > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              {audit.majorFindings} Major NC
            </span>
          )}
          {audit.minorFindings > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
              {audit.minorFindings} Minor NC
            </span>
          )}
          {audit.ofiCount > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
              {audit.ofiCount} OFI
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-175 ${
                activeTab === tab.key
                  ? 'border-blue-500 text-slate-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-h3 text-gray-900">Audit Scope</h2>
            <p className="text-body text-gray-600 leading-relaxed">{audit.scope}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-h3 text-gray-900">Details</h2>
            <dl className="space-y-2.5 text-sm">
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide">Standard</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{audit.standard}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide">Department</dt>
                <dd className="text-gray-700 mt-0.5">{audit.department}</dd>
              </div>
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide">Planned Dates</dt>
                <dd className="text-gray-700 mt-0.5">
                  {new Date(audit.plannedStart).toLocaleDateString()} –{' '}
                  {new Date(audit.plannedEnd).toLocaleDateString()}
                </dd>
              </div>
              {audit.actualStart && (
                <div>
                  <dt className="text-gray-400 text-xs uppercase tracking-wide">Actual Dates</dt>
                  <dd className="text-gray-700 mt-0.5">
                    {new Date(audit.actualStart).toLocaleDateString()} –{' '}
                    {audit.actualEnd ? new Date(audit.actualEnd).toLocaleDateString() : 'Ongoing'}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-gray-400 text-xs uppercase tracking-wide">Lead Auditor</dt>
                <dd className="text-gray-900 font-medium mt-0.5">{audit.leadAuditor}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="space-y-3">
          {audit.findings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <CheckCircle2 size={32} className="text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No findings recorded yet</p>
            </div>
          ) : (
            audit.findings.map((f: AuditFinding) => {
              const cfg = FINDING_CONFIG[f.type];
              const Icon = cfg.icon;
              return (
                <div key={f.id} className={`flex gap-3 p-4 rounded-xl border ${cfg.color}`}>
                  <Icon size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold">{cfg.label}</span>
                      <span className="text-xs font-mono opacity-70">Clause {f.clause}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          f.status === 'CLOSED' ? 'bg-green-100 text-green-700' : 'bg-white/60 text-current'
                        }`}
                      >
                        {f.status}
                      </span>
                      {(f.type === 'MAJOR' || f.type === 'MINOR') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            navigate('/qms/capa/new', {
                              state: {
                                fromAudit: audit?.auditNumber,
                                findingClause: f.clause,
                                title: `CAPA for Audit ${audit?.auditNumber} - Clause ${f.clause}`,
                              },
                            })
                          }
                        >
                          Create CAPA
                        </Button>
                      )}
                    </div>
                    <p className="text-sm">{f.description}</p>
                  </div>
                </div>
              );
            })
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAddFinding(true)}>
            <AlertTriangle size={14} />
            Add Finding
          </Button>
          {showAddFinding && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-900">New Finding</p>
              <div className="flex gap-3">
                <select value={newFinding.type} onChange={e => setNewFinding(p => ({ ...p, type: e.target.value as 'MAJOR' | 'MINOR' | 'OFI' }))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                  <option value="MAJOR">Major NC</option>
                  <option value="MINOR">Minor NC</option>
                  <option value="OFI">OFI</option>
                </select>
                <input value={newFinding.clause} onChange={e => setNewFinding(p => ({ ...p, clause: e.target.value }))} placeholder="Clause (e.g. 8.5.1)" className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <textarea value={newFinding.description} onChange={e => setNewFinding(p => ({ ...p, description: e.target.value }))} placeholder="Finding description..." rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddFinding(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
                <button onClick={() => { setShowAddFinding(false); setNewFinding({ type: 'MINOR', clause: '', description: '' }); }} disabled={!newFinding.clause.trim() || !newFinding.description.trim()} className="text-sm bg-slate-900 text-white px-4 py-1.5 rounded-lg hover:bg-slate-900/90 disabled:opacity-50">Save Finding</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'checklist' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                {checklist.filter((c) => c.response === 'yes').length} Yes
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                {checklist.filter((c) => c.response === 'no').length} No
              </span>
              <span className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                {checklist.filter((c) => c.response === 'na').length} N/A
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setChecklist(DEFAULT_CHECKLIST)}>
              Load ISO 9001 Template
            </Button>
          </div>

          {checklist.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">
              No checklist loaded. Click "Load ISO 9001 Template" or add questions manually.
            </div>
          )}

          {checklist.map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                'bg-white rounded-lg border p-4 transition-colors',
                item.response === 'yes'
                  ? 'border-green-200 bg-green-50/30'
                  : item.response === 'no'
                    ? 'border-red-200 bg-red-50/30'
                    : 'border-gray-200',
              )}
            >
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {item.clause}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 mb-2">{item.question}</p>
                  <div className="flex items-center gap-2">
                    {(['yes', 'no', 'na'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() =>
                          setChecklist((c) =>
                            c.map((x, i) => (i === idx ? { ...x, response: r } : x)),
                          )
                        }
                        className={cn(
                          'text-xs px-3 py-1 rounded-full border font-medium transition-colors uppercase',
                          item.response === r
                            ? r === 'yes'
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : r === 'no'
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : 'bg-gray-200 text-gray-600 border-gray-300'
                            : 'border-gray-200 text-gray-400 hover:bg-gray-50',
                        )}
                      >
                        {r === 'na' ? 'N/A' : r}
                      </button>
                    ))}
                  </div>
                  {item.response === 'no' && (
                    <input
                      value={item.notes}
                      onChange={(e) =>
                        setChecklist((c) =>
                          c.map((x, i) => (i === idx ? { ...x, notes: e.target.value } : x)),
                        )
                      }
                      placeholder="Note the nonconformity or observation..."
                      className="input-base mt-2 text-sm"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setChecklist((c) => [
                ...c,
                { id: Date.now().toString(), clause: '', question: '', response: '', notes: '' },
              ])
            }
          >
            <Plus size={13} />
            Add Question
          </Button>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-h3 text-gray-900 mb-4">Audit Team</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 py-2 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center">
                <span className="text-white text-xs font-medium">
                  {audit.leadAuditor.split(' ').map((n: string) => n[0]).join('')}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{audit.leadAuditor}</p>
                <p className="text-xs text-gray-400">Lead Auditor</p>
              </div>
            </div>
            {audit.auditTeam.map((member: string) => (
              <div key={member} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-600 text-xs font-medium">
                    {member.split(' ').map((n: string) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">{member}</p>
                  <p className="text-xs text-gray-400">Auditor</p>
                </div>
              </div>
            ))}
            {audit.auditTeam.length === 0 && (
              <p className="text-sm text-gray-400">No additional team members assigned</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
