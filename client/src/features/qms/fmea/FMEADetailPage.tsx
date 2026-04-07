import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Edit,
  AlertTriangle,
  BarChart3,
  TrendingDown,
  Clock,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatusBadge,
  StatsCard,
} from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useFMEA } from './hooks';
import type { FMEAFailureMode } from './hooks';

function getRPNColor(rpn: number): string {
  if (rpn > 200) return 'bg-red-100 text-red-700 border-red-200';
  if (rpn >= 100) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}

function getActionPriorityBadge(priority: string) {
  const map: Record<string, { variant: 'danger' | 'warning' | 'success'; label: string }> = {
    HIGH: { variant: 'danger', label: 'High' },
    MEDIUM: { variant: 'warning', label: 'Medium' },
    LOW: { variant: 'success', label: 'Low' },
  };
  const config = map[priority] || { variant: 'success' as const, label: priority };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default function FMEADetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: fmea, isLoading } = useFMEA(id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!fmea) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">FMEA not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/fmea')}>
          Back to List
        </Button>
      </div>
    );
  }

  const failureModes = fmea.failureModes;
  const totalFMs = failureModes.length;
  const highPriorityCount = failureModes.filter((fm) => fm.actionPriority === 'HIGH').length;
  const avgRPN = totalFMs > 0 ? Math.round(failureModes.reduce((sum, fm) => sum + fm.rpn, 0) / totalFMs) : 0;
  const maxRPN = totalFMs > 0 ? Math.max(...failureModes.map((fm) => fm.rpn)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/qms/fmea')}
            className="mt-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-semibold text-slate-500">
                {fmea.fmeaNumber}
              </span>
              <Badge variant={fmea.type === 'DFMEA' ? 'info' : 'purple'}>
                {fmea.type}
              </Badge>
              <StatusBadge status={fmea.status} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{fmea.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {fmea.productProcess} | Owner: {fmea.owner} | Team: {fmea.teamMembers.join(', ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button size="sm">
            <Edit className="h-4 w-4" />
            Edit FMEA
          </Button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Failure Modes"
          value={totalFMs}
          icon={BarChart3}
          iconColor="bg-sky-50 text-sky-600"
        />
        <StatsCard
          title="High Priority"
          value={highPriorityCount}
          icon={AlertTriangle}
          iconColor="bg-red-50 text-red-600"
        />
        <StatsCard
          title="Average RPN"
          value={avgRPN}
          icon={TrendingDown}
          iconColor="bg-amber-50 text-amber-600"
        />
        <StatsCard
          title="Max RPN"
          value={maxRPN}
          icon={AlertTriangle}
          iconColor={maxRPN > 200 ? 'bg-red-50 text-red-600' : maxRPN > 100 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}
        />
      </div>

      {/* FMEA Worksheet Table */}
      <Card noPadding>
        <div className="p-5 border-b border-surface-border">
          <h2 className="text-h3 text-gray-900">FMEA Worksheet</h2>
          <p className="text-xs text-slate-500 mt-1">AIAG-VDA FMEA Format</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-surface-border bg-surface-secondary/50">
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[160px]">Function / Requirement</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Potential Failure Mode</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Potential Effect</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-12">S</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Potential Cause</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-12">O</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Prevention Controls</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Detection Controls</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-12">D</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-14">RPN</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-16">AP</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Recommended Action</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[100px]">Responsible</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap w-24">Target Date</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap min-w-[140px]">Action Taken</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-10">S'</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-10">O'</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-10">D'</th>
                <th className="px-3 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap text-center w-14">RPN'</th>
              </tr>
            </thead>
            <tbody>
              {failureModes.map((fm: FMEAFailureMode) => (
                <tr
                  key={fm.id}
                  className="border-b border-surface-border-light last:border-0 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-3 py-3 text-slate-700">{fm.function}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{fm.failureMode}</td>
                  <td className="px-3 py-3 text-slate-700">{fm.effect}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded font-bold text-xs',
                      fm.severity >= 9 ? 'bg-red-100 text-red-700' : fm.severity >= 7 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700',
                    )}>
                      {fm.severity}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{fm.cause}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded font-bold text-xs',
                      fm.occurrence >= 7 ? 'bg-red-100 text-red-700' : fm.occurrence >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700',
                    )}>
                      {fm.occurrence}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{fm.preventionControl}</td>
                  <td className="px-3 py-3 text-slate-700">{fm.detectionControl}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded font-bold text-xs',
                      fm.detection >= 7 ? 'bg-red-100 text-red-700' : fm.detection >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700',
                    )}>
                      {fm.detection}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn(
                      'inline-flex items-center rounded-md border px-2 py-0.5 font-bold text-xs',
                      getRPNColor(fm.rpn),
                    )}>
                      {fm.rpn}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getActionPriorityBadge(fm.actionPriority)}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{fm.recommendedAction}</td>
                  <td className="px-3 py-3 text-slate-600">{fm.responsible}</td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(fm.targetDate)}</td>
                  <td className="px-3 py-3 text-slate-700">
                    {fm.actionTaken || <span className="text-slate-400 italic">Pending</span>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {fm.newSeverity !== null ? (
                      <span className="font-bold text-xs text-emerald-700">{fm.newSeverity}</span>
                    ) : (
                      <span className="text-slate-300">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {fm.newOccurrence !== null ? (
                      <span className="font-bold text-xs text-emerald-700">{fm.newOccurrence}</span>
                    ) : (
                      <span className="text-slate-300">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {fm.newDetection !== null ? (
                      <span className="font-bold text-xs text-emerald-700">{fm.newDetection}</span>
                    ) : (
                      <span className="text-slate-300">--</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {fm.newRPN !== null ? (
                      <span className={cn(
                        'inline-flex items-center rounded-md border px-2 py-0.5 font-bold text-xs',
                        getRPNColor(fm.newRPN),
                      )}>
                        {fm.newRPN}
                      </span>
                    ) : (
                      <span className="text-slate-300">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Scope */}
      <Card>
        <CardHeader>
          <CardTitle>FMEA Scope</CardTitle>
        </CardHeader>
        <p className="text-sm text-slate-700">{fmea.scope}</p>
      </Card>

      {/* Revision History */}
      <Card>
        <CardHeader>
          <CardTitle>Revision History</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Version</th>
                <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Author</th>
                <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Changes</th>
              </tr>
            </thead>
            <tbody>
              {fmea.revisionHistory.map((rev, idx) => (
                <tr key={idx} className="border-b border-surface-border-light last:border-0">
                  <td className="px-4 py-3">
                    <Badge variant="outline">v{rev.version}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(rev.date)}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{rev.author}</td>
                  <td className="px-4 py-3 text-slate-600">{rev.changes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
