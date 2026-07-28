/**
 * Ticket-aggregation helpers shared by every module analytics component.
 *
 * These implement the calculation logic in spec §6 (aging bucketing, trend
 * rollups, Pareto ranking, on-time/closure rates) once, so no module reimplements
 * it. All are pure functions over the module's own TicketSummary[] — strictly
 * read-only (spec §9).
 */
import {
  isClosed as outcomeIsClosed,
  isCompletedSuccessfully as outcomeIsCompleted,
  isRejected as outcomeIsRejected,
  type TicketSummary,
} from '@/lib/api/ticket';

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface Slice {
  name: string;
  value: number;
  color?: string;
}

/**
 * There is deliberately no `isCompleted` export.
 *
 * A rejected flow carries `isCompleted: true` (terminal rejection works by
 * clearing the flow's current stages, the same signal a successful finish
 * uses), so a single "completed" predicate silently counts rejections as wins.
 * Every call site has to say which of these it means:
 *
 *   - `isClosed`    — finished either way. Use for backlog, aging, overdue,
 *                     open/closed splits: is this still on someone's plate?
 *   - `isCompletedSuccessfully` — reached the end of the workflow. Use for
 *                     completion/closure rates and success counts.
 */
export const isClosed = outcomeIsClosed;
export const isCompletedSuccessfully = outcomeIsCompleted;
export const isRejected = outcomeIsRejected;

export function isOnHold(t: TicketSummary): boolean {
  return !!t.isOnHold;
}

/** Whole days elapsed since an ISO date (positive = in the past). */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Whole days until an ISO date (positive = in the future). */
export function daysUntil(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export type SimpleStatus = 'Open' | 'In Progress' | 'On Hold' | 'Completed' | 'Rejected';

export function ticketStatus(t: TicketSummary): SimpleStatus {
  if (isRejected(t)) return 'Rejected';
  if (isCompletedSuccessfully(t)) return 'Completed';
  if (t.isOnHold) return 'On Hold';
  if (t.flows[0]?.currentStages.length) return 'In Progress';
  return 'Open';
}

/** True when a still-open ticket is past its due date. Closed — completed or
 *  rejected — is not overdue: nobody can act on it. */
export function isOverdue(t: TicketSummary): boolean {
  return !isClosed(t) && !!t.dueDate && daysSince(t.dueDate) > 0;
}

/** Count records by an arbitrary key, sorted descending (drops null keys). */
export function countBy(
  tickets: TicketSummary[],
  key: (t: TicketSummary) => string | null | undefined,
): Slice[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const name = key(t);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/** Standard status donut (Open / In Progress / On Hold / Completed / Rejected). */
export function statusSlices(tickets: TicketSummary[]): Slice[] {
  let open = 0, inProg = 0, onHold = 0, done = 0, rejected = 0;
  for (const t of tickets) {
    if (isRejected(t)) rejected++;
    else if (isCompletedSuccessfully(t)) done++;
    else if (t.isOnHold) onHold++;
    else if (t.flows[0]?.currentStages.length) inProg++;
    else open++;
  }
  return [
    { name: 'Open', value: open, color: '#3B82F6' },
    { name: 'In Progress', value: inProg, color: '#F59E0B' },
    { name: 'On Hold', value: onHold, color: '#F97316' },
    { name: 'Completed', value: done, color: '#22C55E' },
    { name: 'Rejected', value: rejected, color: '#EF4444' },
  ].filter((d) => d.value > 0);
}

/** How many whole months back from now an ISO date falls. */
export function monthsBack(iso: string): number {
  const now = new Date();
  const d = new Date(iso);
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

export interface TrendPoint {
  month: string;
  created: number;
  completed: number;
  /** Terminal rejections. Kept separate from `completed` so the chart doesn't
   *  present them as successes, but still drained from the open balance. */
  rejected: number;
  open: number;
}

/**
 * Created-vs-completed monthly trend over the last `months` months, plus a
 * running open balance (spec §6 "Open vs. Closed Trend").
 */
export function openClosedTrend(tickets: TicketSummary[], months = 6): TrendPoint[] {
  const now = new Date();
  const out: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      month: MONTH_LABELS[d.getMonth()]!,
      created: 0,
      completed: 0,
      rejected: 0,
      open: 0,
    });
  }
  for (const t of tickets) {
    const ci = months - 1 - monthsBack(t.createdAt);
    if (ci >= 0 && ci < months) out[ci]!.created++;
    if (isClosed(t)) {
      const ui = months - 1 - monthsBack(t.updatedAt);
      if (ui >= 0 && ui < months) {
        if (isRejected(t)) out[ui]!.rejected++;
        else out[ui]!.completed++;
      }
    }
  }
  // Running open balance = cumulative(created) - cumulative(closed). Rejections
  // have to drain the balance too, or the "open" line never comes back down.
  let bal = 0;
  for (const p of out) {
    bal += p.created - p.completed - p.rejected;
    p.open = Math.max(0, bal);
  }
  return out;
}

/** A generic monthly count of records passing `predicate`, over `months`. */
export function monthlyCount(
  tickets: TicketSummary[],
  predicate: (t: TicketSummary) => boolean,
  dateOf: (t: TicketSummary) => string,
  months = 6,
): Array<{ month: string; value: number }> {
  const now = new Date();
  const out: Array<{ month: string; value: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ month: MONTH_LABELS[d.getMonth()]!, value: 0 });
  }
  for (const t of tickets) {
    if (!predicate(t)) continue;
    const idx = months - 1 - monthsBack(dateOf(t));
    if (idx >= 0 && idx < months) out[idx]!.value++;
  }
  return out;
}

/** Aging of open records by days since creation (spec §6 aging buckets). */
export function agingByCreation(tickets: TicketSummary[]): Slice[] {
  const b = [
    { name: '0-7 days', value: 0, color: '#22C55E' },
    { name: '8-30 days', value: 0, color: '#F59E0B' },
    { name: '31-90 days', value: 0, color: '#F97316' },
    { name: '90+ days', value: 0, color: '#EF4444' },
  ];
  for (const t of tickets) {
    if (isClosed(t)) continue;
    const d = daysSince(t.createdAt);
    if (d <= 7) b[0]!.value++;
    else if (d <= 30) b[1]!.value++;
    else if (d <= 90) b[2]!.value++;
    else b[3]!.value++;
  }
  return b;
}

/**
 * Finer-grained aging of open records by days since creation, with buckets past
 * `slaDays` shown in red rather than only the oldest bucket — for panels where
 * the coarse 4-bucket `agingByCreation` hides how much sits just past SLA.
 * Kept separate from `agingByCreation` so existing callers are unaffected.
 */
export function agingByCreationFine(tickets: TicketSummary[], slaDays = 30): Slice[] {
  const b = [
    { name: '0-7 days', value: 0, color: '#22C55E' },
    { name: '8-15 days', value: 0, color: '#84CC16' },
    { name: '16-30 days', value: 0, color: '#F59E0B' },
    { name: '31-60 days', value: 0, color: '#F97316' },
    { name: '60+ days', value: 0, color: '#EF4444' },
  ];
  for (const t of tickets) {
    if (isClosed(t)) continue;
    const d = daysSince(t.createdAt);
    const idx = d <= 7 ? 0 : d <= 15 ? 1 : d <= 30 ? 2 : d <= 60 ? 3 : 4;
    b[idx]!.value++;
    if (d > slaDays) b[idx]!.color = '#EF4444';
  }
  return b;
}

/** On-time / due-soon / overdue posture for open records (spec §6). */
export function dueDatePosture(tickets: TicketSummary[]): Slice[] {
  let overdue = 0, dueSoon = 0, onTrack = 0, noDue = 0;
  for (const t of tickets) {
    if (isClosed(t)) continue;
    if (!t.dueDate) { noDue++; continue; }
    const d = daysSince(t.dueDate);
    if (d > 0) overdue++;
    else if (d > -3) dueSoon++;
    else onTrack++;
  }
  return [
    { name: 'On-time', value: onTrack, color: '#22C55E' },
    { name: 'Due-soon', value: dueSoon, color: '#F59E0B' },
    { name: 'Overdue', value: overdue, color: '#EF4444' },
    { name: 'No due date', value: noDue, color: '#64748B' },
  ].filter((d) => d.value > 0);
}

/** Due-window buckets (e.g. 30/60/90 days) for records with a future due date. */
export function dueWindows(
  tickets: TicketSummary[],
  dueOf: (t: TicketSummary) => string | null | undefined,
  windows: number[] = [30, 60, 90],
): Slice[] {
  const colors = ['#EF4444', '#F59E0B', '#3B82F6', '#64748B'];
  const buckets = windows.map((w, i) => ({
    name: i === 0 ? `≤ ${w}d` : `${windows[i - 1]}–${w}d`,
    value: 0,
    color: colors[i] ?? '#64748B',
  }));
  for (const t of tickets) {
    const due = dueOf(t);
    if (!due) continue;
    const d = daysUntil(due);
    if (isNaN(d) || d < 0) continue;
    for (let i = 0; i < windows.length; i++) {
      if (d <= windows[i]!) { buckets[i]!.value++; break; }
    }
  }
  return buckets;
}

/**
 * On-time closure rate % (closed on or before due date) over closed records.
 * Measures timeliness of reaching an end state, so rejections count — they are
 * a resolution, just not a successful one.
 */
export function onTimeClosureRate(tickets: TicketSummary[]): number {
  const closed = tickets.filter(isClosed);
  if (closed.length === 0) return 0;
  const onTime = closed.filter((t) => {
    if (!t.dueDate) return true; // no SLA target → not counted as breach
    return new Date(t.updatedAt).getTime() <= new Date(t.dueDate).getTime();
  }).length;
  return Math.round((onTime / closed.length) * 100);
}

/** Overall closure rate % (successfully completed / total). Rejections are not
 *  successes, so they lower this rather than inflating it. */
export function closureRate(tickets: TicketSummary[]): number {
  if (tickets.length === 0) return 0;
  return Math.round((tickets.filter(isCompletedSuccessfully).length / tickets.length) * 100);
}

/** Average cycle time in days for closed records (updatedAt - createdAt).
 *  Includes rejections — time-to-resolution, however it resolved. */
export function avgCycleDays(tickets: TicketSummary[]): number {
  const closed = tickets.filter(isClosed);
  if (closed.length === 0) return 0;
  const sum = closed.reduce(
    (s, t) => s + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 86_400_000,
    0,
  );
  return Math.round(sum / closed.length);
}

/** Average age in days of open records. */
export function avgOpenAge(tickets: TicketSummary[]): number {
  const open = tickets.filter((t) => !isClosed(t));
  if (open.length === 0) return 0;
  return Math.round(open.reduce((s, t) => s + daysSince(t.createdAt), 0) / open.length);
}

export interface ParetoItem {
  name: string;
  value: number;
  cumulative: number;
}

/** Pareto data: descending counts with a cumulative-% overlay (spec §5/§6). */
export function pareto(slices: Slice[], limit = 8): ParetoItem[] {
  const sorted = [...slices].sort((a, b) => b.value - a.value).slice(0, limit);
  const total = sorted.reduce((s, d) => s + d.value, 0) || 1;
  let run = 0;
  return sorted.map((d) => {
    run += d.value;
    return { name: d.name, value: d.value, cumulative: Math.round((run / total) * 100) };
  });
}

/** Stage-workflow counts (records currently at each stage), for funnels. */
export function stageCounts(tickets: TicketSummary[]): Slice[] {
  return countBy(tickets, (t) =>
    isRejected(t)
      ? 'Rejected'
      : isCompletedSuccessfully(t)
        ? 'Completed'
        : t.flows[0]?.currentStages[0]?.name ?? 'Unassigned',
  );
}
