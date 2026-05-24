import type { ReactNode } from 'react';
import { Search, LayoutGrid, List, Plus } from 'lucide-react';
import Input from '@/components/ui/Input';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type ListViewMode = 'card' | 'table';

interface SearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ViewConfig {
  value: ListViewMode;
  onChange: (mode: ListViewMode) => void;
}

interface ActionConfig {
  label: string;
  onClick: () => void;
  icon?: React.ElementType;
  variant?: ButtonProps['variant'];
}

interface ListPageHeaderProps {
  title: string;
  description?: ReactNode;
  search?: SearchConfig;
  view?: ViewConfig;
  action?: ActionConfig;
  extraActions?: ReactNode;
  className?: string;
}

/**
 * Header for list pages: title + description on the left,
 * search + view toggle + primary action on the right — all in one row.
 * Every right-side control is optional, so the same component fits any list page.
 */
export default function ListPageHeader({
  title,
  description,
  search,
  view,
  action,
  extraActions,
  className,
}: ListPageHeaderProps) {
  const ActionIcon = action?.icon ?? Plus;

  return (
    <div className={cn('flex items-start justify-between gap-4 flex-wrap', className)}>
      <div className="min-w-0">
        <h1 className="text-h1 text-gray-900">{title}</h1>
        {description && (
          <p className="text-body text-gray-500 mt-0.5">{description}</p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-2 flex-wrap">
        {search && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder}
              className="pl-9"
            />
          </div>
        )}

        {view && <ViewToggle view={view} />}

        {extraActions}

        {action && (
          <Button variant={action.variant ?? 'primary'} onClick={action.onClick}>
            <ActionIcon className="h-4 w-4" />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

function ViewToggle({ view }: { view: ViewConfig }) {
  const baseBtn = 'h-8 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-md transition';
  const active = 'bg-white text-slate-900 shadow-sm font-medium';
  const inactive = 'text-slate-500 hover:text-slate-700';
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
      <button
        type="button"
        onClick={() => view.onChange('card')}
        title="Card view"
        className={cn(baseBtn, view.value === 'card' ? active : inactive)}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Cards
      </button>
      <button
        type="button"
        onClick={() => view.onChange('table')}
        title="Table view"
        className={cn(baseBtn, view.value === 'table' ? active : inactive)}
      >
        <List className="h-3.5 w-3.5" /> Table
      </button>
    </div>
  );
}
