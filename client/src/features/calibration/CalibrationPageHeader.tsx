import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared header for every Calibration page: title left, controls right, one row.
 *
 * Controls only wrap below `xl`, where five filters genuinely cannot fit.
 */
export default function CalibrationPageHeader({
  title,
  icon: Icon,
  actions,
}: {
  title: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4 flex-wrap xl:flex-nowrap">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 shrink-0">
        {Icon && <Icon size={22} className="text-gray-500" />}
        {title}
      </h1>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap xl:justify-end">{actions}</div>
      )}
    </div>
  );
}
