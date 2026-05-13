/**
 * Pure: compute elapsed working time + percentage consumed for an SLA timer.
 *
 * Matches the Django-aligned model from P3.1:
 *   - RUNNING/EXTENDED  → elapsedBeforePauseSec + (now − lastResumedAt)
 *   - PAUSED            → elapsedBeforePauseSec (frozen)
 *   - COMPLETED/BREACHED → elapsedBeforePauseSec (terminal-frozen)
 *
 * Calendar-aware variant lives in `engine/calendar.ts` (`elapsedBusinessSeconds`);
 * this helper assumes the timer's `lastResumedAt` and `elapsedBeforePauseSec`
 * already accounted for business hours when they were written. For the
 * threshold sweep we only need a *consumption ratio*, so wall-clock is fine.
 */
import type { SlaTimer, SlaPolicy } from '@prisma/client';

type TimerForElapsed = Pick<
  SlaTimer,
  'status' | 'elapsedBeforePauseSec' | 'lastResumedAt' | 'totalExtensionsSec'
>;

export const computeElapsedSec = (timer: TimerForElapsed, now: Date = new Date()): number => {
  if (timer.status === 'COMPLETED' || timer.status === 'BREACHED') {
    return timer.elapsedBeforePauseSec;
  }
  if (timer.status === 'PAUSED' || !timer.lastResumedAt) {
    return timer.elapsedBeforePauseSec;
  }
  // RUNNING / EXTENDED
  const runningSec = Math.max(
    0,
    Math.floor((now.getTime() - timer.lastResumedAt.getTime()) / 1000),
  );
  return timer.elapsedBeforePauseSec + runningSec;
};

export const computePercentageConsumed = (
  timer: TimerForElapsed,
  policy: Pick<SlaPolicy, 'duration'>,
  now: Date = new Date(),
): number => {
  const totalAllowed = policy.duration + timer.totalExtensionsSec;
  if (totalAllowed <= 0) return 100;
  return (computeElapsedSec(timer, now) / totalAllowed) * 100;
};
