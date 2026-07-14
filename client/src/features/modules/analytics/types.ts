import type { TicketSummary } from '@/lib/api/ticket';

/** Which slice of records a KPI card drills through to (spec: card → ticket list). */
export type DrillView = 'all' | 'open' | 'overdue' | 'onhold' | 'completed';

/**
 * Every per-module analytics component (spec §6) is a default export with this
 * signature. It receives the module's own already-loaded records and derives
 * every KPI/chart client-side — strictly read-only (spec §9). No fetching, no
 * hardcoded sample data: sparse modules show honest empty states (spec §11).
 *
 * `onDrill` (optional) is wired by ModulePage: clicking a KPI card jumps to the
 * My Tasks ticket list filtered to that slice.
 */
export interface ModuleAnalyticsProps {
  tickets: TicketSummary[];
  moduleName: string;
  onDrill?: (view: DrillView) => void;
}
