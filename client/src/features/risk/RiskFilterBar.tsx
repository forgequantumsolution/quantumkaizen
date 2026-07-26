/**
 * The one toolbar every risk list page renders, directly above its KPI strip.
 *
 * Before this, each page laid its filters out as a row of bare selects under
 * the KPI cards — six controls wide on the risks page — so the filters competed
 * with the numbers for the top of the screen and every page arranged them a bit
 * differently. This mirrors the pattern the generic module pages already use
 * (features/modules/ModulePage.tsx): a search field plus a single Filter button
 * that opens the selects in a modal, with a badge for how many are set.
 *
 * Pages pass their own selects as `children` — the bar owns the chrome (search,
 * button, badge, modal, clear) and knows nothing about what is being filtered.
 * `activeCount` is the page's own count of set filters: only the page knows
 * which of its state values count as "a filter" versus a default view.
 */
import { type ReactNode, useState } from 'react';
import { Input as AntInput } from 'antd';
import { Filter as FilterIcon, Search, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

export interface RiskFilterBarProps {
  /** Omit both to render no search field (pages that filter by select only). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** How many filters are currently set — drives the button's badge + tone. */
  activeCount: number;
  /** Resets every filter this bar owns. Wired to the modal's Clear button. */
  onClear: () => void;
  /** Modal heading, e.g. "Filter risks". */
  title: string;
  /** The filter controls themselves — wrap each in <RiskFilterField>. */
  children: ReactNode;
  /** Page actions (Export CSV, New…) pinned to the right of the bar. */
  actions?: ReactNode;
}

/** Label + control pairing for the fields inside the filter modal. */
export function RiskFilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function RiskFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  activeCount,
  onClear,
  title,
  children,
  actions,
}: RiskFilterBarProps) {
  const [open, setOpen] = useState(false);
  const hasFilter = activeCount > 0;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {onSearchChange && (
          <div className="relative w-60">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
            />
            <AntInput
              allowClear
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="!pl-10 !rounded-full"
            />
          </div>
        )}

        <Button
          variant={hasFilter ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setOpen(true)}
        >
          <FilterIcon size={14} />
          <span className="ml-1.5">Filter</span>
          {hasFilter && (
            <span className="ml-1.5 bg-white/30 text-white text-[10px] font-semibold rounded-full w-4 h-4 inline-flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </Button>

        {actions && <div className="flex items-center gap-2 flex-wrap ml-auto">{actions}</div>}
      </div>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="ghost" size="sm" disabled={!hasFilter} onClick={onClear}>
              <X size={13} />
              <span className="ml-1">Clear</span>
            </Button>
            <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-3">{children}</div>
      </Modal>
    </>
  );
}
