/**
 * SLA panel on the ticket detail page.
 *
 * Renders one card per active timer on the ticket:
 *   - SlaProgressRing (colour-banded)
 *   - Live countdown via `useCountdown` (1Hz, paused on document.hidden)
 *   - Deadline + last-fired threshold chip
 *   - "Request extension" button (opens SlaExtendModal)
 *
 * Auto-refetches every 30s via `useTicketSla` (FE.Q1). Returns null when the
 * ticket has no timers (engine never spawned one for any stage entered).
 */
import { useMemo, useState } from 'react';
import { AlarmClock, Timer, AlertTriangle } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { useTicketSla, type SlaTimerWithEvents } from '@/lib/api/sla';
import { useCountdown } from '@/hooks/useCountdown';
import SlaProgressRing from './SlaProgressRing';
import SlaExtendModal from './SlaExtendModal';

interface Props {
  ticketId: string;
}

const formatDeadline = (iso: string, tz?: string): string => {
  const d = new Date(iso);
  try {
    return d.toLocaleString(undefined, {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return d.toLocaleString();
  }
};

/** Find the most-recent THRESHOLD_HIT event for a timer, if any. */
const lastThresholdHit = (timer: SlaTimerWithEvents) => {
  const hits = timer.events.filter((e) => e.eventType === 'THRESHOLD_HIT');
  return hits.length === 0 ? null : hits[hits.length - 1] ?? null;
};

const computeElapsedSec = (timer: SlaTimerWithEvents, now = Date.now()): number => {
  if (timer.status === 'COMPLETED' || timer.status === 'BREACHED') {
    return timer.elapsedBeforePauseSec;
  }
  if (timer.status === 'PAUSED' || !timer.lastResumedAt) {
    return timer.elapsedBeforePauseSec;
  }
  const runningSec = Math.max(0, Math.floor((now - new Date(timer.lastResumedAt).getTime()) / 1000));
  return timer.elapsedBeforePauseSec + runningSec;
};

interface TimerRowProps {
  timer: SlaTimerWithEvents;
}

function TimerRow({ timer }: TimerRowProps) {
  const [extendOpen, setExtendOpen] = useState(false);

  // Recompute "live" percentage every 1s via the countdown hook (it ticks on
  // its own interval; we piggy-back by reading `Date.now()` inside the render).
  // The countdown also gives us the human-readable remaining-time label.
  const countdown = useCountdown(timer.deadline);

  // Elapsed % is computed from the timer's running-time accounting. Refreshes
  // each render which happens on every countdown tick, so the ring stays in sync.
  const { elapsedPct } = useMemo(() => {
    const elapsed = computeElapsedSec(timer);
    const total = timer.policy.duration + timer.totalExtensionsSec;
    const pct = total <= 0 ? 100 : (elapsed / total) * 100;
    return { elapsedPct: pct };
    // The deadline change re-mounts the countdown which re-renders us; that's
    // also the trigger for re-running this memo. We don't need a 1Hz tick here
    // because the parent re-renders from the countdown hook anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown?.secondsRemaining, timer]);

  const lastHit = lastThresholdHit(timer);
  const terminal = timer.status === 'COMPLETED' || timer.status === 'BREACHED';
  const canExtend = !terminal;

  return (
    <div className="flex items-start gap-4 p-3 rounded-lg border border-gray-200 bg-white">
      <SlaProgressRing percentage={elapsedPct} status={timer.status} size={72} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 uppercase tracking-wide">
          <Timer size={12} />
          <span>SLA — {timer.stage.name}</span>
          {timer.status === 'BREACHED' && (
            <span className="ml-auto inline-flex items-center gap-1 text-red-600">
              <AlertTriangle size={12} />
              Breached
            </span>
          )}
          {timer.status === 'PAUSED' && (
            <span className="ml-auto text-amber-600">Paused</span>
          )}
          {timer.status === 'EXTENDED' && (
            <span className="ml-auto text-blue-600">Extended ×{timer.extensionCount}</span>
          )}
        </div>

        <div className="mt-1 text-sm font-semibold text-gray-900">
          {countdown?.formatted ?? '—'}
          <span className="ml-2 text-xs font-normal text-gray-500">remaining</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Deadline: {formatDeadline(timer.deadline, timer.policy.calendar?.timezone)}
        </div>

        {lastHit && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-50 text-amber-800">
            <AlarmClock size={11} />
            <span>
              Last threshold: {lastHit.thresholdName} fired at{' '}
              {Math.round(lastHit.thresholdPercentage ?? 0)}%
            </span>
          </div>
        )}

        {canExtend && (
          <div className="mt-2">
            <Button variant="ghost" size="sm" onClick={() => setExtendOpen(true)}>
              Request extension
            </Button>
          </div>
        )}
      </div>

      <SlaExtendModal
        isOpen={extendOpen}
        onClose={() => setExtendOpen(false)}
        timerId={timer.id}
      />
    </div>
  );
}

export default function SlaPanel({ ticketId }: Props) {
  const { data, isLoading } = useTicketSla(ticketId);
  if (isLoading) return null;
  if (!data || data.timers.length === 0) return null;

  // Filter to non-terminal timers + the most recent terminal one (for context).
  const active = data.timers.filter(
    (t) => t.status === 'RUNNING' || t.status === 'PAUSED' || t.status === 'EXTENDED',
  );
  const visible = active.length > 0 ? active : data.timers.slice(-1);

  return (
    <Card className="!p-3 space-y-2">
      <h3 className="text-sm font-semibold text-gray-900">SLA</h3>
      <div className="space-y-2">
        {visible.map((t) => (
          <TimerRow key={t.id} timer={t} />
        ))}
      </div>
    </Card>
  );
}
