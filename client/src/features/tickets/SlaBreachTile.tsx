/**
 * Dashboard-level SLA snapshot tile for the /tickets page.
 *
 * Shows live counts of:
 *   - BREACHED timers (past deadline, escalation either fired or pending)
 *   - RUNNING timers that have consumed ≥ 80% of their budget ("at risk")
 *
 * Auto-refetches every 60s. Returns `null` when there are no timers at all so
 * we don't clutter the page for tenants that don't use SLA yet.
 */
import { useMemo } from 'react';
import { AlertTriangle, TimerReset } from 'lucide-react';
import { Card } from '@/components/ui';
import { useSlaTimers, type SlaTimer } from '@/lib/api/sla';

const computeElapsedSec = (timer: SlaTimer, now = Date.now()): number => {
  if (timer.status === 'PAUSED' || !timer.lastResumedAt) {
    return timer.elapsedBeforePauseSec;
  }
  const running = Math.max(
    0,
    Math.floor((now - new Date(timer.lastResumedAt).getTime()) / 1000),
  );
  return timer.elapsedBeforePauseSec + running;
};

const isAtRisk = (timer: SlaTimer): boolean => {
  if (timer.status !== 'RUNNING' && timer.status !== 'EXTENDED') return false;
  const total = timer.policy.duration;
  if (total <= 0) return false;
  return computeElapsedSec(timer) / total >= 0.8;
};

export default function SlaBreachTile() {
  const breached = useSlaTimers({ status: 'BREACHED', pageSize: 1 });
  const running = useSlaTimers({ status: 'RUNNING', pageSize: 100 });

  const breachedCount = breached.data?.total ?? 0;
  const atRiskCount = useMemo(
    () => (running.data?.items ?? []).filter(isAtRisk).length,
    [running.data],
  );

  const totalAcrossStatuses =
    (breached.data?.total ?? 0) + (running.data?.total ?? 0);

  if (breached.isLoading || running.isLoading) return null;
  if (totalAcrossStatuses === 0) return null;
  if (breachedCount === 0 && atRiskCount === 0) return null;

  return (
    <Card className="!p-4">
      <div className="flex items-center gap-4">
        {breachedCount > 0 && (
          <div className="flex items-center gap-3 pr-4 border-r border-gray-200">
            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900">
                {breachedCount}
              </div>
              <div className="text-xs text-gray-500">Breached SLA</div>
            </div>
          </div>
        )}

        {atRiskCount > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <TimerReset size={18} className="text-amber-600" />
            </div>
            <div>
              <div className="text-xl font-semibold text-gray-900">
                {atRiskCount}
              </div>
              <div className="text-xs text-gray-500">At risk (≥ 80% consumed)</div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
