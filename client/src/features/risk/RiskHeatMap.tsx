/**
 * The interactive risk matrix.
 *
 * Rows run highest-rank-first so the grid reads like the printed matrices in the
 * ICH Q9 / ISO 14971 annexes, where the worst outcome sits at the top-left.
 *
 * Layout note — the matrix is a fixed-layout, full-width table rather than an
 * intrinsically-sized one. An intrinsic table sizes itself to its content, so a
 * 5×5 framework rendered a ~370px matrix pinned to the left of a ~900px card and
 * left the rest of the panel empty. Here the data columns divide whatever width
 * the card gives them and the cell height scales to the row count, so the matrix
 * fills its panel at any framework size. The margin that used to be dead space
 * now carries the marginal totals, which are what a reviewer reads next after
 * the cells themselves.
 *
 * Every number rendered here is a count the API returned. Colours are the
 * tenant's own framework level colours; nothing is derived or estimated.
 */
import { useMemo } from 'react';
import type { RiskFramework, RiskHeatmap } from '@/lib/api/risk';

/**
 * The framework level a (rowRank, colRank) cell resolves to. Mirrors the
 * server's resolution order so the dashboard cannot show a colour the scoring
 * engine would disagree with: an explicit matrix cell wins, otherwise the score
 * the formula produces is matched against the level bands.
 */
export function resolveCellLevel(
  framework: RiskFramework | undefined,
  rowKey: string,
  rowRank: number,
  colKey: string,
  colRank: number,
) {
  if (!framework) return null;
  const cell = framework.matrix_cells?.find(
    (c) =>
      c.row_factor_key === rowKey &&
      c.row_rank === rowRank &&
      c.col_factor_key === colKey &&
      c.col_rank === colRank,
  );
  if (cell) return framework.levels.find((l) => l.id === cell.level_id) ?? null;
  if (framework.formula === 'MATRIX_LOOKUP') return null;

  const score = framework.formula === 'SUM' ? rowRank + colRank : rowRank * colRank;
  return (
    framework.levels.find(
      (l) =>
        l.min_score != null &&
        score >= l.min_score &&
        (l.max_score == null || score <= l.max_score),
    ) ?? null
  );
}

/** Cell height by row count, so a 3-row and a 7-row framework both fill the card. */
const cellHeight = (rowCount: number) =>
  rowCount <= 3 ? 74 : rowCount <= 4 ? 62 : rowCount <= 5 ? 54 : rowCount <= 6 ? 47 : 42;

export interface RiskHeatMapProps {
  heatmap: RiskHeatmap;
  framework: RiskFramework | undefined;
  countFor: (rowRank: number, colRank: number) => number;
  onCellClick: (rowRank: number, colRank: number) => void;
  /** Highlights the cells belonging to one level; others fade back. */
  highlightLevelCode?: string;
}

export default function RiskHeatMap({
  heatmap,
  framework,
  countFor,
  onCellClick,
  highlightLevelCode,
}: RiskHeatMapProps) {
  const rows = useMemo(
    () => [...heatmap.axes.row.levels].sort((a, b) => b.rank - a.rank),
    [heatmap],
  );
  const cols = useMemo(
    () => [...heatmap.axes.col.levels].sort((a, b) => a.rank - b.rank),
    [heatmap],
  );

  const h = cellHeight(rows.length);

  // Marginal totals. Computed from the same cell counts the grid renders, so the
  // margins can never disagree with the body.
  const rowTotals = useMemo(
    () => new Map(rows.map((r) => [r.rank, cols.reduce((acc, c) => acc + countFor(r.rank, c.rank), 0)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, countFor],
  );
  const colTotals = useMemo(
    () => new Map(cols.map((c) => [c.rank, rows.reduce((acc, r) => acc + countFor(r.rank, c.rank), 0)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, cols, countFor],
  );
  const scored = useMemo(
    () => [...rowTotals.values()].reduce((a, b) => a + b, 0),
    [rowTotals],
  );

  const maxRowTotal = Math.max(1, ...rowTotals.values());
  const maxColTotal = Math.max(1, ...colTotals.values());

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex min-w-0 flex-1 items-stretch gap-1.5">
        {/* Row axis title, rotated up the left edge. This replaces the old
            "rows \ cols" corner label, which had to be tiny to fit. */}
        <div className="hidden shrink-0 items-center sm:flex">
          <span
            className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {heatmap.axes.row.label}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <table className="w-full table-fixed border-separate" style={{ borderSpacing: 3 }}>
            <colgroup>
              <col style={{ width: 128 }} />
              {cols.map((c) => (
                <col key={c.rank} />
              ))}
              <col style={{ width: 52 }} />
            </colgroup>

            <thead>
              <tr>
                <th />
                {cols.map((c) => (
                  <th key={c.rank} className="px-0.5 pb-1 align-bottom">
                    <span
                      className="block text-[10px] font-semibold leading-tight text-gray-500"
                      title={`${c.rank} — ${c.label}`}
                    >
                      <span className="text-gray-400">{c.rank}.</span> {c.label}
                    </span>
                  </th>
                ))}
                <th className="pb-1 align-bottom">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Total
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const rowTotal = rowTotals.get(r.rank) ?? 0;
                return (
                  <tr key={r.rank} style={{ height: h }}>
                    <td className="pr-2 align-middle">
                      <span
                        className="block truncate text-right text-[11px] font-medium leading-tight text-gray-600"
                        title={`${r.rank} — ${r.label}`}
                      >
                        <span className="text-gray-400">{r.rank}.</span> {r.label}
                      </span>
                    </td>

                    {cols.map((c) => {
                      const count = countFor(r.rank, c.rank);
                      const level = resolveCellLevel(
                        framework,
                        heatmap.axes.row.key,
                        r.rank,
                        heatmap.axes.col.key,
                        c.rank,
                      );
                      const bg = level?.color ?? '#E2E8F0';
                      const dimmed =
                        !!highlightLevelCode && level?.code !== highlightLevelCode;
                      const share = scored > 0 ? (count / scored) * 100 : 0;
                      return (
                        <td key={c.rank} className="p-0 align-middle">
                          <button
                            type="button"
                            onClick={() => onCellClick(r.rank, c.rank)}
                            title={
                              `${r.label} × ${c.label}` +
                              `${level ? ` · ${level.label}` : ''} — ${count} risk(s)` +
                              `${count > 0 && scored > 0 ? ` (${share.toFixed(0)}% of scored)` : ''}`
                            }
                            className="group/cell flex h-full w-full flex-col items-center justify-center rounded-lg transition-all hover:z-10 hover:ring-2 hover:ring-gray-500 hover:ring-offset-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            style={{
                              backgroundColor: count > 0 ? bg : `${bg}2E`,
                              color: count > 0 ? '#fff' : '#A3AEC0',
                              opacity: dimmed ? 0.3 : 1,
                              minHeight: h,
                            }}
                          >
                            <span className="text-[15px] font-extrabold leading-none tabular-nums">
                              {count > 0 ? count : ''}
                            </span>
                            {/* Share only when the cell is tall enough to carry a
                                second line without crowding the count. */}
                            {count > 0 && scored > 0 && h >= 54 && (
                              <span className="mt-0.5 text-[9px] font-semibold leading-none tabular-nums text-white/75">
                                {share.toFixed(0)}%
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    <td className="p-0 align-middle">
                      <div
                        className="flex h-full flex-col items-center justify-center rounded-lg bg-gray-50/80"
                        style={{ minHeight: h }}
                        title={`${rowTotal} risk(s) at ${heatmap.axes.row.label.toLowerCase()} ${r.label}`}
                      >
                        <span className="text-[12px] font-bold leading-none tabular-nums text-gray-700">
                          {rowTotal}
                        </span>
                        <div className="mt-1 h-[3px] w-6 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-gray-400"
                            style={{ width: `${(rowTotal / maxRowTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Column totals — the strip under the matrix that used to be padding. */}
              <tr style={{ height: 30 }}>
                <td className="pr-2 align-middle">
                  <span className="block text-right text-[9px] font-bold uppercase tracking-wider text-gray-400">
                    Total
                  </span>
                </td>
                {cols.map((c) => {
                  const t = colTotals.get(c.rank) ?? 0;
                  return (
                    <td key={c.rank} className="p-0 align-middle">
                      <div
                        className="flex h-full flex-col items-center justify-center rounded-lg bg-gray-50/80"
                        title={`${t} risk(s) at ${heatmap.axes.col.label.toLowerCase()} ${c.label}`}
                      >
                        <span className="text-[12px] font-bold leading-none tabular-nums text-gray-700">
                          {t}
                        </span>
                        <div className="mt-1 h-[3px] w-6 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-gray-400"
                            style={{ width: `${(t / maxColTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
                <td className="p-0 align-middle">
                  <div className="flex h-full items-center justify-center rounded-lg bg-gray-100">
                    <span className="text-[12px] font-extrabold leading-none tabular-nums text-gray-800">
                      {scored}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Column axis title, centred under the matrix. */}
          <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">
            {heatmap.axes.col.label}
          </p>
        </div>
      </div>

      {framework && framework.levels.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-gray-100 pt-2.5">
          {framework.levels.map((l) => {
            const n = heatmap.by_level[l.code] ?? 0;
            return (
              <span
                key={l.id}
                className="inline-flex items-center gap-1.5 text-[10px] text-gray-500"
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.label}
                <span className="font-bold tabular-nums text-gray-700">{n}</span>
              </span>
            );
          })}
          {heatmap.unscored > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" />
              Unscored
              <span className="font-bold tabular-nums text-gray-600">{heatmap.unscored}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
