/**
 * HeatMapMatrix — purpose-built grid heat map. Two uses in the spec:
 *  • Risk 5×5 Likelihood × Severity matrix (§6.3.8)
 *  • Role-wise Training Matrix (Employee × Training completion) (§6.5.1)
 *
 * Generic: give it row labels, column labels, and a value(row,col) accessor.
 */
import { EmptyChart } from './kit';

export interface HeatMapMatrixProps {
  rows: string[];
  cols: string[];
  /** Cell value for row index r, col index c. */
  value: (r: number, c: number) => number;
  /** Map a value to a background colour. Defaults to an amber ramp. */
  colorFor?: (v: number, max: number) => string;
  /** Render the cell content (defaults to the number, blank when 0). */
  cellLabel?: (v: number) => string;
  height?: number;
  rowHeader?: string;
  colHeader?: string;
  emptyLabel?: string;
}

function amberRamp(v: number, max: number): string {
  if (v <= 0) return '#F8FAFC';
  const t = Math.min(1, v / (max || 1));
  // interpolate slate-tint → amber → red for a risk-style ramp
  if (t < 0.5) return `rgba(59,130,246,${0.15 + t * 0.5})`;
  if (t < 0.8) return `rgba(245,158,11,${0.35 + t * 0.4})`;
  return `rgba(239,68,68,${0.45 + t * 0.5})`;
}

export default function HeatMapMatrix({
  rows,
  cols,
  value,
  colorFor = amberRamp,
  cellLabel = (v) => (v > 0 ? String(v) : ''),
  height = 260,
  rowHeader,
  colHeader,
  emptyLabel = 'No data yet',
}: HeatMapMatrixProps) {
  if (rows.length === 0 || cols.length === 0) {
    return <EmptyChart label={emptyLabel} height={height} />;
  }
  let max = 0;
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < cols.length; c++) max = Math.max(max, value(r, c));

  return (
    <div className="overflow-x-auto" style={{ minHeight: height }}>
      <table className="border-separate" style={{ borderSpacing: 3 }}>
        <thead>
          <tr>
            <th className="text-[10px] text-gray-400 font-medium text-right pr-2 align-bottom">
              {rowHeader && colHeader ? `${rowHeader} \\ ${colHeader}` : ''}
            </th>
            {cols.map((c) => (
              <th key={c} className="text-[10px] font-medium text-gray-500 px-1 pb-1 text-center max-w-[80px]">
                <span className="block truncate" title={c}>{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((rname, r) => (
            <tr key={rname}>
              <td className="text-[10px] font-medium text-gray-500 text-right pr-2 whitespace-nowrap max-w-[120px] truncate" title={rname}>
                {rname}
              </td>
              {cols.map((_, c) => {
                const v = value(r, c);
                return (
                  <td
                    key={c}
                    title={`${rname} × ${cols[c]}: ${v}`}
                    className="w-9 h-9 text-center rounded"
                    style={{
                      backgroundColor: colorFor(v, max),
                      minWidth: 34,
                    }}
                  >
                    <span className="text-[11px] font-semibold text-gray-800">{cellLabel(v)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
