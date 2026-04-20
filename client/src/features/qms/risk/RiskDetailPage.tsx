import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Download,
  User,
  Calendar,
  Building2,
  Clock,
  Shield,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import ApprovalTimeline from '@/components/ui/ApprovalTimeline';
import { cn, formatDate, formatDateTime, daysSince } from '@/lib/utils';
import { useRisk, riskLevelBadge, calcRiskLevel } from './hooks';
import type { RiskLevel, ControlHierarchy } from './hooks';

// ── Helpers ─────────────────────────────────────────────────────────────────

function heatmapCellColor(l: number, c: number): string {
  const score = l * c;
  if (score >= 15) return 'bg-red-500 text-white';
  if (score >= 10) return 'bg-orange-400 text-white';
  if (score >= 5) return 'bg-yellow-300 text-yellow-900';
  return 'bg-emerald-400 text-white';
}

function levelBadgeColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'LOW': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}

const hierarchyBadge: Record<ControlHierarchy, { variant: 'success' | 'info' | 'purple' | 'warning' | 'danger'; label: string }> = {
  ELIMINATION: { variant: 'success', label: 'Elimination' },
  SUBSTITUTION: { variant: 'info', label: 'Substitution' },
  ENGINEERING: { variant: 'purple', label: 'Engineering' },
  ADMINISTRATIVE: { variant: 'warning', label: 'Administrative' },
  PPE: { variant: 'danger', label: 'PPE' },
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'controls', label: 'Controls' },
  { id: 'comparison', label: 'Before / After' },
  { id: 'history', label: 'History' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function RiskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: risk, isLoading } = useRisk(id!);
  const [activeTab, setActiveTab] = useState('overview');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Risk not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/risks')}>
          Back to Register
        </Button>
      </div>
    );
  }

  // ── Risk Matrix Mini (highlight this risk's cell) ──────────────────────

  const MiniRiskMatrix = ({
    likelihood,
    consequence,
    label,
  }: {
    likelihood: number;
    consequence: number;
    label: string;
  }) => (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2">{label}</p>
      <div className="grid grid-cols-6 gap-px">
        <div />
        {[1, 2, 3, 4, 5].map((c) => (
          <div key={c} className="text-center text-[10px] font-semibold text-slate-400 py-0.5">
            {c}
          </div>
        ))}
        {[5, 4, 3, 2, 1].map((l) => (
          <>
            <div
              key={`l-${l}`}
              className="flex items-center justify-center text-[10px] font-semibold text-slate-400"
            >
              {l}
            </div>
            {[1, 2, 3, 4, 5].map((c) => {
              const isHighlight = l === likelihood && c === consequence;
              return (
                <div
                  key={`${l}-${c}`}
                  className={cn(
                    'h-6 rounded-sm flex items-center justify-center text-[9px] font-bold',
                    heatmapCellColor(l, c),
                    isHighlight && 'ring-2 ring-slate-900 ring-offset-1 scale-110 z-10',
                  )}
                >
                  {isHighlight ? l * c : ''}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/qms/risks')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors mt-0.5"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-semibold text-navy-700">
                {risk.riskNumber}
              </span>
              <Badge variant={riskLevelBadge(risk.riskLevel)}>{risk.riskLevel}</Badge>
              <Badge variant="default">{risk.category}</Badge>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{risk.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      {/* Main + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Matrix Position</CardTitle>
            </CardHeader>
            <MiniRiskMatrix
              likelihood={risk.likelihood}
              consequence={risk.consequence}
              label={`Initial Risk: L=${risk.likelihood} x C=${risk.consequence} = ${risk.riskScore}`}
            />
          </Card>

          {/* Tabs */}
          <Card noPadding>
            <div className="px-6 pt-4">
              <Tabs
                tabs={TABS.map((t) => ({
                  ...t,
                  count: t.id === 'controls' ? risk.controls.length : undefined,
                }))}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>
            <div className="p-6">
              {/* Overview */}
              {activeTab === 'overview' && (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div className="md:col-span-2">
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Description
                    </dt>
                    <dd className="text-slate-700 leading-relaxed">{risk.description}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Category
                    </dt>
                    <dd>
                      <Badge variant="default">{risk.category}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Department
                    </dt>
                    <dd className="text-slate-800 font-medium">{risk.department}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Likelihood
                    </dt>
                    <dd className="text-slate-800 font-medium">{risk.likelihood} / 5</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Consequence
                    </dt>
                    <dd className="text-slate-800 font-medium">{risk.consequence} / 5</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Risk Score
                    </dt>
                    <dd className="text-2xl font-bold text-slate-900">{risk.riskScore}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      Risk Level
                    </dt>
                    <dd>
                      <span
                        className={cn(
                          'inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border',
                          levelBadgeColor(risk.riskLevel),
                        )}
                      >
                        {risk.riskLevel}
                      </span>
                    </dd>
                  </div>
                </dl>
              )}

              {/* Controls */}
              {activeTab === 'controls' && (
                <div className="space-y-3">
                  {risk.controls.length > 0 ? (
                    risk.controls.map((ctrl, idx) => {
                      const meta = hierarchyBadge[ctrl.hierarchy] ?? {
                        variant: 'default' as const,
                        label: String(ctrl.hierarchy ?? '—'),
                      };
                      return (
                        <div
                          key={ctrl.id}
                          className="border border-slate-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={meta.variant}>{meta.label}</Badge>
                              <Badge
                                variant={
                                  ctrl.status === 'VERIFIED'
                                    ? 'success'
                                    : ctrl.status === 'IMPLEMENTED'
                                      ? 'info'
                                      : 'default'
                                }
                              >
                                {ctrl.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700">{ctrl.description}</p>
                          <p className="text-xs text-slate-500 mt-2">Owner: {ctrl.owner}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10">
                      <Shield className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No control measures defined</p>
                    </div>
                  )}
                </div>
              )}

              {/* Before / After Comparison */}
              {activeTab === 'comparison' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Initial Risk */}
                  <div className="border border-slate-200 rounded-lg p-5">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      Initial Risk
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Likelihood</span>
                        <span className="font-bold text-slate-900">{risk.likelihood}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Consequence</span>
                        <span className="font-bold text-slate-900">{risk.consequence}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-100 pt-2">
                        <span className="text-slate-500">Score</span>
                        <span className="text-xl font-bold text-slate-900">{risk.riskScore}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Level</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-bold border',
                            levelBadgeColor(risk.riskLevel),
                          )}
                        >
                          {risk.riskLevel}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <MiniRiskMatrix
                        likelihood={risk.likelihood}
                        consequence={risk.consequence}
                        label=""
                      />
                    </div>
                  </div>

                  {/* Residual Risk */}
                  <div className="border border-emerald-200 rounded-lg p-5 bg-emerald-50/30">
                    <h4 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      Residual Risk
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Likelihood</span>
                        <span className="font-bold text-slate-900">
                          {risk.residualLikelihood}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Consequence</span>
                        <span className="font-bold text-slate-900">
                          {risk.residualConsequence}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-emerald-100 pt-2">
                        <span className="text-slate-500">Score</span>
                        <span className="text-xl font-bold text-slate-900">
                          {risk.residualScore}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Level</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-xs font-bold border',
                            levelBadgeColor(risk.residualLevel),
                          )}
                        >
                          {risk.residualLevel}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <MiniRiskMatrix
                        likelihood={risk.residualLikelihood}
                        consequence={risk.residualConsequence}
                        label=""
                      />
                    </div>
                  </div>

                  {/* Reduction Summary */}
                  <div className="md:col-span-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-slate-500">Risk Reduction:</span>{' '}
                        <span className="font-bold text-emerald-600">
                          {Math.round(((risk.riskScore - risk.residualScore) / risk.riskScore) * 100)}%
                        </span>
                      </div>
                      <div className="text-sm text-slate-500">
                        Score reduced from{' '}
                        <span className="font-bold text-slate-900">{risk.riskScore}</span> to{' '}
                        <span className="font-bold text-emerald-600">{risk.residualScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History */}
              {activeTab === 'history' && (
                <div>
                  {risk.history.length > 0 ? (
                    <ApprovalTimeline
                      stages={risk.history.map((h, idx) => ({
                        name: h.action,
                        status: idx === risk.history.length - 1 ? 'active' : 'completed',
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

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h4 className="text-sm font-semibold text-slate-800 mb-4">Metadata</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 text-sm">
                <User className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Owner</p>
                  <p className="font-medium text-slate-800">{risk.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="font-medium text-slate-800">{risk.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Next Review</p>
                  <p className="font-medium text-slate-800">{formatDate(risk.reviewDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs text-slate-500">Age</p>
                  <p className="font-medium text-slate-800">{daysSince(risk.createdAt)} days</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Key Dates</h4>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-800 font-medium">{formatDate(risk.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Updated</span>
                <span className="text-slate-800 font-medium">{formatDate(risk.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Review Due</span>
                <span className="text-slate-800 font-medium">{formatDate(risk.reviewDate)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-semibold text-slate-800 mb-3">Quick Summary</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <span className="text-xs text-slate-500">Controls</span>
                <span className="text-sm font-bold text-slate-900">{risk.controls.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <span className="text-xs text-slate-500">Implemented</span>
                <span className="text-sm font-bold text-emerald-600">
                  {risk.controls.filter((c) => c.status !== 'PLANNED').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                <span className="text-xs text-slate-500">Planned</span>
                <span className="text-sm font-bold text-amber-600">
                  {risk.controls.filter((c) => c.status === 'PLANNED').length}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
