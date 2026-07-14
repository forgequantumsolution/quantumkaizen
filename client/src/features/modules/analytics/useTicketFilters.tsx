/**
 * Shared filter behaviour for every module analytics panel.
 *
 * Renders a single right-aligned "Filter" button that opens a popover holding
 * all the filters (Status / Priority / Severity / Department) — the industry-
 * standard pattern — instead of a long inline row of dropdowns. Options are
 * derived live from the module's own records; empty facets are hidden.
 *
 * Usage inside a panel:
 *   const { filtered, toolbar } = useTicketFilters(tickets);
 *   return <div className="space-y-4">{toolbar} … charts built from `filtered` …</div>;
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Popover, Select } from 'antd';
import { Filter as FilterIcon, RotateCcw } from 'lucide-react';
import type { TicketSummary } from '@/lib/api/ticket';
import { ticketStatus } from '@/components/analytics';

interface Filters {
  status?: string;
  priority?: string;
  severity?: string;
  department?: string;
}

export function useTicketFilters(tickets: TicketSummary[]) {
  const [filters, setFilters] = useState<Filters>({});
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const uniq = (vals: Array<string | null | undefined>) =>
      Array.from(new Set(vals.filter((v): v is string => !!v))).sort();
    return {
      status: uniq(tickets.map(ticketStatus)),
      priority: uniq(tickets.map((t) => t.priority?.name)),
      severity: uniq(tickets.map((t) => t.severity?.name)),
      department: uniq(tickets.map((t) => t.department?.name)),
    };
  }, [tickets]);

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!filters.status || ticketStatus(t) === filters.status) &&
          (!filters.priority || t.priority?.name === filters.priority) &&
          (!filters.severity || t.severity?.name === filters.severity) &&
          (!filters.department || t.department?.name === filters.department),
      ),
    [tickets, filters],
  );

  const activeCount = Object.values(filters).filter(Boolean).length;
  const set = (key: keyof Filters) => (v?: string) =>
    setFilters((f) => ({ ...f, [key]: v || undefined }));
  const opts = (vals: string[]) => vals.map((v) => ({ value: v, label: v }));

  const field = (label: string, key: keyof Filters, list: string[]): ReactNode =>
    list.length ? (
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
        <Select
          size="small"
          allowClear
          placeholder={`Any ${label.toLowerCase()}`}
          style={{ width: '100%' }}
          value={filters[key]}
          onChange={set(key)}
          options={opts(list)}
        />
      </div>
    ) : null;

  const content = (
    <div className="w-[236px] space-y-3">
      {field('Status', 'status', options.status)}
      {field('Priority', 'priority', options.priority)}
      {field('Severity', 'severity', options.severity)}
      {field('Department', 'department', options.department)}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
        <button
          type="button"
          onClick={() => setFilters({})}
          disabled={activeCount === 0}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40"
        >
          <RotateCcw size={12} /> Clear all
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md bg-gray-900 px-3 py-1 text-[12px] font-semibold text-white hover:bg-gray-700"
        >
          Done
        </button>
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex items-center justify-end">
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomRight"
        content={content}
      >
        <button
          type="button"
          className="no-print inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          <FilterIcon size={14} />
          Filter
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </Popover>
    </div>
  );

  return { filtered, toolbar, filters, setFilters };
}
