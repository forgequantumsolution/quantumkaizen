/**
 * 1Hz countdown hook for SLA timers.
 *
 * Pauses on `document.hidden` so a backgrounded tab doesn't burn cycles.
 * Resyncs to the real deadline whenever the deadline reference changes (e.g.
 * after an extension is approved and the parent reloads the timer).
 *
 * Used by `SlaPanel` to make the deadline feel live between the 30 s polls
 * issued by `useTicketSla`.
 */
import { useEffect, useState } from 'react';

interface CountdownState {
  secondsRemaining: number;
  isBreached: boolean;
  /** "2h 14m" / "8m 42s" / "Breached 1h ago" — human-readable. */
  formatted: string;
}

const formatRemaining = (secs: number): string => {
  if (secs <= 0) return 'Breached';
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatBreached = (secs: number): string => {
  const abs = Math.abs(secs);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  if (h > 0) return `Breached ${h}h ago`;
  if (m > 0) return `Breached ${m}m ago`;
  return 'Breached just now';
};

const compute = (deadline: Date): CountdownState => {
  const secsRemaining = Math.floor((deadline.getTime() - Date.now()) / 1000);
  const isBreached = secsRemaining <= 0;
  return {
    secondsRemaining: secsRemaining,
    isBreached,
    formatted: isBreached ? formatBreached(secsRemaining) : formatRemaining(secsRemaining),
  };
};

export const useCountdown = (deadline: Date | string | null | undefined): CountdownState | null => {
  const deadlineDate =
    deadline == null ? null : deadline instanceof Date ? deadline : new Date(deadline);
  const deadlineMs = deadlineDate?.getTime() ?? 0;

  // Seed with the current value so SSR/first-paint is correct.
  const [state, setState] = useState<CountdownState | null>(
    deadlineDate ? compute(deadlineDate) : null,
  );

  useEffect(() => {
    if (!deadlineDate) {
      setState(null);
      return;
    }
    setState(compute(deadlineDate));

    let intervalId: number | undefined;

    const start = () => {
      if (intervalId !== undefined) return;
      intervalId = window.setInterval(() => {
        setState(compute(deadlineDate));
      }, 1000);
    };

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        // Resync immediately on tab return so the display jumps to the correct
        // value rather than ticking forward from the stale state.
        setState(compute(deadlineDate));
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [deadlineMs, deadlineDate]);

  return state;
};
