/**
 * ScorecardTable — purpose-built ranked scorecard (spec §6.3.9 Supplier
 * Scorecard) and generic ranked lists. Columns are configurable; an optional
 * score column renders a coloured pill.
 */
import type { ReactNode } from 'react';
import { EmptyChart, PALETTE } from './kit';

export interface ScorecardColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
}

export interface ScorecardTableProps<T> {
  rows: T[];
  columns: ScorecardColumn<T>[];
  height?: number;
  emptyLabel?: string;
  rowKey: (row: T, i: number) => string;
}

export function scorePill(value: number, goodAbove = 80, warnAbove = 60): ReactNode {
  const color =
    value >= goodAbove ? PALETTE.good : value >= warnAbove ? PALETTE.warn : PALETTE.bad;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[42px] px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {Math.round(value)}
    </span>
  );
}

export default function ScorecardTable<T>({
  rows,
  columns,
  height = 260,
  emptyLabel = 'No records yet',
  rowKey,
}: ScorecardTableProps<T>) {
  if (rows.length === 0) return <EmptyChart label={emptyLabel} height={height} />;
  return (
    <div className="overflow-auto" style={{ maxHeight: height }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr className="border-b border-gray-200">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 text-${c.align ?? 'left'}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={rowKey(row, i)} className="border-b border-gray-100 hover:bg-gray-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 text-${c.align ?? 'left'} align-middle`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
