import { useMemo, useState, type ReactNode } from 'react';
import { Checkbox as AntCheckbox, Popover, Tooltip, Modal, Button as AntButton } from 'antd';
import { Check, X, Minus, Plus, Search, MoreHorizontal, Download, SlidersHorizontal } from 'lucide-react';
import { NAV_ACCESS, type NavModuleAccess, type NavTabAccess } from '@/lib/navAccess';
import {
  bucketActionsForEntity,
  MATRIX_COLUMNS,
  COLUMN_LABELS,
  type CatalogPerm,
  type EntityBuckets,
  type MatrixColumn,
  type BucketPerm,
} from '@/lib/accessActions';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export type TriState = 'none' | 'grant' | 'deny';

interface MatrixRow {
  tab: NavTabAccess;
  buckets: EntityBuckets;
}
interface MatrixGroup {
  module: NavModuleAccess;
  rows: MatrixRow[];
}

/** Columns the user can show/hide via "Customize Columns". `all` = the master
 * "All Access" column; the five action columns; `more` = the long-tail popover. */
type OptionalColumn = 'all' | MatrixColumn | 'more';
const ALL_OPTIONAL_COLUMNS: OptionalColumn[] = ['all', ...MATRIX_COLUMNS, 'more'];
const OPTIONAL_LABELS: Record<OptionalColumn, string> = {
  all: 'All Access',
  view: COLUMN_LABELS.view,
  create: COLUMN_LABELS.create,
  edit: COLUMN_LABELS.edit,
  delete: COLUMN_LABELS.delete,
  approve: COLUMN_LABELS.approve,
  more: 'More',
};
// Default view matches the requested layout: All Access + Read/Create/Update/Delete.
// Approve + More stay one click away under "Customize Columns" (All Access still
// grants them in bulk, so nothing is unreachable).
const DEFAULT_VISIBLE: OptionalColumn[] = ['all', 'view', 'create', 'edit', 'delete'];

interface AccessMatrixProps {
  mode: 'binary' | 'tristate';
  /** Flat permission catalog (key/action/description) used to bucket columns. */
  catalog: CatalogPerm[];
  /**
   * Extra, DB-driven modules appended after the static NAV_ACCESS list — one per
   * workflow type, so each module (CAPA, Deviation, …) gets its own switch. Built
   * by the caller from the workflow-types list.
   */
  extraModules?: NavModuleAccess[];
  canEdit: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  /** Filename stem for the CSV export (e.g. the role/department/user name). */
  exportName?: string;
  /** Rendered at the start of the single toolbar row (subject selector + summary). */
  leftSlot?: ReactNode;
  /** Rendered at the end of the toolbar row (reason input + Reset/Save). */
  rightSlot?: ReactNode;

  // ── binary mode (Role / Department) ──
  isOn?: (permKey: string) => boolean;
  /** Batched setter so select-all + auto-View land in one update. */
  setKeys?: (updates: { key: string; on: boolean }[]) => void;

  // ── tristate mode (User overrides) ──
  triStateOf?: (permKey: string) => TriState;
  isInherited?: (permKey: string) => boolean;
  setTri?: (permKey: string, next: TriState) => void;
  /** Human-readable source of a key ("via QC role", "explicit grant"…). */
  sourceLabel?: (permKey: string) => string;
}

/* ── Build the module → tab → buckets model, filtered by search ─────────── */
function useMatrixGroups(
  catalog: CatalogPerm[],
  search: string,
  extraModules: NavModuleAccess[],
): MatrixGroup[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: MatrixGroup[] = [];
    for (const module of [...NAV_ACCESS, ...extraModules]) {
      const rows: MatrixRow[] = [];
      for (const tab of module.tabs) {
        const buckets = bucketActionsForEntity(tab.entity, catalog);
        if (q) {
          const hay = [
            module.label,
            tab.label,
            tab.entity,
            tab.permission,
            ...MATRIX_COLUMNS.map((c) => buckets[c]?.key ?? ''),
            ...buckets.more.map((m) => m.key),
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) continue;
        }
        rows.push({ tab, buckets });
      }
      if (rows.length > 0) groups.push({ module, rows });
    }
    return groups;
  }, [catalog, search, extraModules]);
}

/** Every distinct permission-key a row references (all columns + more). */
function rowKeys(row: MatrixRow): string[] {
  const keys = new Set<string>();
  for (const col of MATRIX_COLUMNS) {
    const k = row.buckets[col]?.key;
    if (k) keys.add(k);
  }
  row.buckets.more.forEach((m) => keys.add(m.key));
  return [...keys];
}

export default function AccessMatrix(props: AccessMatrixProps) {
  const { mode, catalog, canEdit, search, onSearchChange } = props;
  const extraModules = useMemo(() => props.extraModules ?? [], [props.extraModules]);
  const groups = useMatrixGroups(catalog, search, extraModules);
  // Start with every module collapsed — the user opens the ones they need.
  // While a search is active we force-expand so matches are visible.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set([...NAV_ACCESS, ...extraModules].map((m) => m.key)),
  );
  const searchActive = search.trim().length > 0;
  const [visible, setVisible] = useState<Set<OptionalColumn>>(new Set(DEFAULT_VISIBLE));

  const shownCols = MATRIX_COLUMNS.filter((c) => visible.has(c));
  const showAll = visible.has('all');
  const showMore = visible.has('more');
  const dataColCount = (showAll ? 1 : 0) + shownCols.length + (showMore ? 1 : 0);

  const toggleCollapse = (moduleKey: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });

  const toggleVisible = (col: OptionalColumn) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });

  /* ── binary helpers ── */
  const viewKeyForRow = (r: MatrixRow) => r.buckets.view?.key;

  const applyBinary = (updates: { key: string; on: boolean }[]) => {
    if (!props.setKeys || updates.length === 0) return;
    props.setKeys(updates);
  };

  // Toggle a single binary cell with the View-footgun guard.
  const toggleBinaryCell = (row: MatrixRow, key: string, next: boolean) => {
    if (!props.isOn) return;
    const viewKey = viewKeyForRow(row);
    const updates: { key: string; on: boolean }[] = [{ key, on: next }];

    if (next && viewKey && key !== viewKey && !props.isOn(viewKey)) {
      updates.push({ key: viewKey, on: true });
    }

    if (!next && viewKey && key === viewKey) {
      const others = otherRowKeys(row, viewKey).filter((k) => props.isOn!(k));
      if (others.length > 0) {
        Modal.confirm({
          title: 'Remove Read access?',
          content:
            'Other actions (Create/Update/…) are still enabled for this tab. Without Read the tab is hidden in the sidebar but still reachable by deep link. Remove Read anyway?',
          okText: 'Remove Read',
          okButtonProps: { danger: true },
          onOk: () => applyBinary(updates),
        });
        return;
      }
    }
    applyBinary(updates);
  };

  const otherRowKeys = (row: MatrixRow, viewKey: string | undefined): string[] =>
    rowKeys(row).filter((k) => k !== viewKey);

  // Bulk toggle a column across a set of rows (auto-enable View where needed).
  const bulkToggleColumn = (rows: MatrixRow[], col: MatrixColumn, on: boolean) => {
    if (!props.isOn) return;
    const updates: { key: string; on: boolean }[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      const key = row.buckets[col]?.key;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      updates.push({ key, on });
      if (on && col !== 'view') {
        const viewKey = viewKeyForRow(row);
        if (viewKey && !props.isOn(viewKey) && !seen.has(viewKey)) {
          seen.add(viewKey);
          updates.push({ key: viewKey, on: true });
        }
      }
    }
    applyBinary(updates);
  };

  // Bulk toggle EVERY action key across a set of rows (the "All Access" column).
  const bulkToggleAll = (rows: MatrixRow[], on: boolean) => {
    if (!props.isOn) return;
    const updates: { key: string; on: boolean }[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of rowKeys(row)) {
        if (seen.has(key)) continue;
        seen.add(key);
        updates.push({ key, on });
      }
    }
    applyBinary(updates);
  };

  // Column state across a set of rows: all / some / none.
  const columnState = (rows: MatrixRow[], col: MatrixColumn): 'all' | 'some' | 'none' => {
    if (!props.isOn) return 'none';
    let total = 0;
    let onCount = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      const key = row.buckets[col]?.key;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      total += 1;
      if (props.isOn(key)) onCount += 1;
    }
    if (total === 0 || onCount === 0) return 'none';
    return onCount === total ? 'all' : 'some';
  };

  // "All Access" state across a set of rows (every key in every row).
  const allAccessState = (rows: MatrixRow[]): 'all' | 'some' | 'none' => {
    let total = 0;
    let onCount = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of rowKeys(row)) {
        if (seen.has(key)) continue;
        seen.add(key);
        total += 1;
        if (mode === 'binary') {
          if (props.isOn?.(key)) onCount += 1;
        } else if ((props.triStateOf?.(key) ?? 'none') === 'grant') onCount += 1;
      }
    }
    if (total === 0 || onCount === 0) return 'none';
    return onCount === total ? 'all' : 'some';
  };

  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  /* ── tristate helpers ── */
  const cycleTri = (key: string, current: TriState) => {
    if (!props.setTri) return;
    const next: TriState = current === 'none' ? 'grant' : current === 'grant' ? 'deny' : 'none';
    props.setTri(key, next);
  };
  const autoViewGrant = (row: MatrixRow, key: string, next: TriState) => {
    if (!props.setTri || next !== 'grant') return;
    const viewKey = viewKeyForRow(row);
    if (!viewKey || viewKey === key) return;
    const inherited = props.isInherited?.(viewKey) ?? false;
    const state = props.triStateOf?.(viewKey) ?? 'none';
    if (!inherited && state === 'none') props.setTri(viewKey, 'grant');
  };
  const bulkSetTriAll = (rows: MatrixRow[], grant: boolean) => {
    if (!props.setTri) return;
    const seen = new Set<string>();
    for (const row of rows) {
      for (const key of rowKeys(row)) {
        if (seen.has(key)) continue;
        seen.add(key);
        props.setTri(key, grant ? 'grant' : 'none');
      }
    }
  };

  const toggleAllAccess = (rows: MatrixRow[], on: boolean) => {
    if (mode === 'binary') bulkToggleAll(rows, on);
    else bulkSetTriAll(rows, on);
  };

  /* ── CSV export ── */
  const exportCsv = () => {
    const header = ['Module', 'Tab', 'Entity', ...shownCols.map((c) => COLUMN_LABELS[c])];
    if (showMore) header.push('More');
    const lines = [header.join(',')];
    const cellVal = (key?: string): string => {
      if (!key) return '—';
      if (mode === 'binary') return props.isOn?.(key) ? 'Y' : 'N';
      const s = props.triStateOf?.(key) ?? 'none';
      if (s === 'grant') return 'GRANT';
      if (s === 'deny') return 'DENY';
      return props.isInherited?.(key) ? 'inherit' : 'N';
    };
    for (const g of groups) {
      for (const row of g.rows) {
        const cols = shownCols.map((c) => cellVal(row.buckets[c]?.key));
        if (showMore) cols.push(row.buckets.more.map((m) => `${m.verb}:${cellVal(m.key)}`).join(' '));
        const cells = [g.module.label, row.tab.label, row.tab.entity, ...cols].map((v) =>
          /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v,
        );
        lines.push(cells.join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-matrix-${props.exportName ?? 'export'}.csv`.replace(/\s+/g, '-').toLowerCase();
    a.click();
    URL.revokeObjectURL(url);
  };

  // Everything that doesn't need to be always-visible lives under one Filter
  // button: the CSV download + the column show/hide toggles.
  const filterContent = (
    <div className="w-56 -mx-1">
      <button
        type="button"
        onClick={exportCsv}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-[12px] text-gray-700"
      >
        <Download size={14} className="text-gray-500" /> Download CSV
      </button>
      <div className="my-1 border-t border-gray-100" />
      <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        Columns
      </div>
      {ALL_OPTIONAL_COLUMNS.map((col) => (
        <label
          key={col}
          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
        >
          <AntCheckbox checked={visible.has(col)} onChange={() => toggleVisible(col)} />
          <span className="text-[12px] text-gray-700">{OPTIONAL_LABELS[col]}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Single-line toolbar: [leftSlot] [search] … [Filter ▾] [rightSlot] */}
      <div className="flex items-center gap-2 flex-wrap">
        {props.leftSlot}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
          />
          <Input
            placeholder="Search modules or permissions…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Popover
            content={filterContent}
            trigger="click"
            placement="bottomRight"
            title="Filter & columns"
          >
            <AntButton icon={<SlidersHorizontal size={14} />}>Filter</AntButton>
          </Popover>
          {props.rightSlot}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-4 py-3 w-[34%]">
                Module Name
              </th>
              {showAll && (
                <HeaderCell
                  label="All Access"
                  state={allAccessState(allRows)}
                  canEdit={canEdit}
                  onToggle={(on) => toggleAllAccess(allRows, on)}
                />
              )}
              {shownCols.map((col) => (
                <HeaderCell
                  key={col}
                  label={COLUMN_LABELS[col]}
                  state={mode === 'binary' ? columnState(allRows, col) : 'none'}
                  canEdit={canEdit && mode === 'binary'}
                  onToggle={(on) => bulkToggleColumn(allRows, col, on)}
                />
              ))}
              {showMore && (
                <th className="text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-2 py-3">
                  More
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={dataColCount + 1} className="py-12 text-center text-sm text-gray-400">
                  No modules match your search.
                </td>
              </tr>
            )}
            {groups.map((group) => (
              <ModuleGroup
                key={group.module.key}
                group={group}
                isCollapsed={searchActive ? false : collapsed.has(group.module.key)}
                onToggleCollapse={() => toggleCollapse(group.module.key)}
                mode={mode}
                canEdit={canEdit}
                showAll={showAll}
                shownCols={shownCols}
                showMore={showMore}
                isOn={props.isOn}
                columnState={(col) => columnState(group.rows, col)}
                bulkToggleColumn={(col, on) => bulkToggleColumn(group.rows, col, on)}
                allAccessState={() => allAccessState(group.rows)}
                toggleAllAccessGroup={(on) => toggleAllAccess(group.rows, on)}
                toggleAllAccessRow={(row, on) => toggleAllAccess([row], on)}
                rowAllState={(row) => allAccessState([row])}
                toggleBinaryCell={toggleBinaryCell}
                triStateOf={props.triStateOf}
                isInherited={props.isInherited}
                cycleTri={cycleTri}
                sourceLabel={props.sourceLabel}
                autoViewGrant={autoViewGrant}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Header cell with select-all checkbox ─────────────────────────────── */
function HeaderCell({
  label,
  state,
  canEdit,
  onToggle,
}: {
  label: string;
  state: 'all' | 'some' | 'none';
  canEdit: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <th className="text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wide px-2 py-3">
      <div className="flex flex-col items-center gap-1">
        <span>{label}</span>
        {canEdit && (
          <AntCheckbox
            checked={state === 'all'}
            indeterminate={state === 'some'}
            onChange={(e) => onToggle(e.target.checked)}
          />
        )}
      </div>
    </th>
  );
}

/* ── Module group (header row + tab rows) ─────────────────────────────── */
interface ModuleGroupProps {
  group: MatrixGroup;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mode: 'binary' | 'tristate';
  canEdit: boolean;
  showAll: boolean;
  shownCols: MatrixColumn[];
  showMore: boolean;
  isOn?: (permKey: string) => boolean;
  columnState: (col: MatrixColumn) => 'all' | 'some' | 'none';
  bulkToggleColumn: (col: MatrixColumn, on: boolean) => void;
  allAccessState: () => 'all' | 'some' | 'none';
  toggleAllAccessGroup: (on: boolean) => void;
  toggleAllAccessRow: (row: MatrixRow, on: boolean) => void;
  rowAllState: (row: MatrixRow) => 'all' | 'some' | 'none';
  toggleBinaryCell: (row: MatrixRow, key: string, next: boolean) => void;
  triStateOf?: (permKey: string) => TriState;
  isInherited?: (permKey: string) => boolean;
  cycleTri: (key: string, current: TriState) => void;
  sourceLabel?: (permKey: string) => string;
  autoViewGrant: (row: MatrixRow, key: string, next: TriState) => void;
}

function ModuleGroup(p: ModuleGroupProps) {
  const {
    group,
    isCollapsed,
    onToggleCollapse,
    mode,
    canEdit,
    showAll,
    shownCols,
    showMore,
    isOn,
    columnState,
    bulkToggleColumn,
    allAccessState,
    toggleAllAccessGroup,
    toggleAllAccessRow,
    rowAllState,
    toggleBinaryCell,
    triStateOf,
    isInherited,
    cycleTri,
    sourceLabel,
    autoViewGrant,
  } = p;

  const cell = (state: 'all' | 'some' | 'none', onToggle: (on: boolean) => void) => (
    <AntCheckbox
      checked={state === 'all'}
      indeterminate={state === 'some'}
      disabled={!canEdit}
      onChange={(e) => onToggle(e.target.checked)}
    />
  );

  return (
    <>
      {/* Module header row */}
      <tr className="bg-slate-50/70 border-b border-gray-100">
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="inline-flex items-center gap-1.5 text-left"
          >
            <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-gray-300 text-gray-500">
              {isCollapsed ? <Plus size={11} /> : <Minus size={11} />}
            </span>
            <span className="text-[13px] font-semibold text-gray-900">{group.module.label}</span>
            <span className="text-[11px] text-gray-400">({group.rows.length})</span>
          </button>
        </td>
        {showAll && (
          <td className="text-center px-2 py-2.5">{cell(allAccessState(), toggleAllAccessGroup)}</td>
        )}
        {shownCols.map((col) => (
          <td key={col} className="text-center px-2 py-2.5">
            {mode === 'binary' ? cell(columnState(col), (on) => bulkToggleColumn(col, on)) : null}
          </td>
        ))}
        {showMore && <td />}
      </tr>

      {/* Tab rows */}
      {!isCollapsed &&
        group.rows.map((row) => (
          <tr key={row.tab.key} className="border-b border-gray-50 hover:bg-gray-50/60">
            <td className="px-4 py-2 pl-10">
              <div className="text-[13px] text-gray-800">{row.tab.label}</div>
              <div className="font-mono text-[10px] text-gray-400">{row.tab.entity}</div>
            </td>
            {showAll && (
              <td className="text-center px-2 py-2">
                {cell(rowAllState(row), (on) => toggleAllAccessRow(row, on))}
              </td>
            )}
            {shownCols.map((col) => {
              const bucket = row.buckets[col];
              const isWriteLinked =
                !!row.buckets.writeKey &&
                (col === 'create' || col === 'edit') &&
                bucket?.key === row.buckets.writeKey;
              return (
                <td key={col} className="text-center px-2 py-2">
                  {!bucket ? (
                    <span className="text-gray-300 select-none">—</span>
                  ) : (
                    <MatrixCell
                      permKey={bucket.key}
                      bucket={bucket}
                      writeLinked={isWriteLinked}
                      mode={mode}
                      canEdit={canEdit}
                      isOn={isOn}
                      onBinaryToggle={(next) => toggleBinaryCell(row, bucket.key, next)}
                      triStateOf={triStateOf}
                      isInherited={isInherited}
                      onCycle={(cur) => {
                        cycleTri(bucket.key, cur);
                        const next: TriState =
                          cur === 'none' ? 'grant' : cur === 'grant' ? 'deny' : 'none';
                        autoViewGrant(row, bucket.key, next);
                      }}
                      sourceLabel={sourceLabel}
                    />
                  )}
                </td>
              );
            })}
            {showMore && (
              <td className="text-center px-2 py-2">
                {row.buckets.more.length === 0 ? (
                  <span className="text-gray-300 select-none">—</span>
                ) : (
                  <MorePopover
                    items={row.buckets.more}
                    mode={mode}
                    canEdit={canEdit}
                    isOn={isOn}
                    onBinaryToggle={(key, next) => toggleBinaryCell(row, key, next)}
                    triStateOf={triStateOf}
                    isInherited={isInherited}
                    onCycle={(key, cur) => {
                      cycleTri(key, cur);
                      const next: TriState =
                        cur === 'none' ? 'grant' : cur === 'grant' ? 'deny' : 'none';
                      autoViewGrant(row, key, next);
                    }}
                    sourceLabel={sourceLabel}
                  />
                )}
              </td>
            )}
          </tr>
        ))}
    </>
  );
}

/* ── A single cell (binary checkbox or tri-state control) ─────────────── */
interface MatrixCellProps {
  permKey: string;
  bucket: BucketPerm;
  writeLinked?: boolean;
  mode: 'binary' | 'tristate';
  canEdit: boolean;
  isOn?: (permKey: string) => boolean;
  onBinaryToggle: (next: boolean) => void;
  triStateOf?: (permKey: string) => TriState;
  isInherited?: (permKey: string) => boolean;
  onCycle: (current: TriState) => void;
  sourceLabel?: (permKey: string) => string;
}

function MatrixCell({
  permKey,
  bucket,
  writeLinked,
  mode,
  canEdit,
  isOn,
  onBinaryToggle,
  triStateOf,
  isInherited,
  onCycle,
  sourceLabel,
}: MatrixCellProps) {
  if (mode === 'binary') {
    const checked = isOn?.(permKey) ?? false;
    const cellEl = (
      <span className="inline-flex items-center gap-1">
        <AntCheckbox
          checked={checked}
          disabled={!canEdit}
          onChange={(e) => onBinaryToggle(e.target.checked)}
        />
        {writeLinked && (
          <span
            className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-tight"
            aria-hidden
          >
            W
          </span>
        )}
      </span>
    );
    const tip = writeLinked
      ? `${bucket.key} — legacy "write" key: Create and Update toggle together`
      : bucket.key;
    return <Tooltip title={tip}>{cellEl}</Tooltip>;
  }

  const state = triStateOf?.(permKey) ?? 'none';
  const inherited = isInherited?.(permKey) ?? false;
  const label = sourceLabel?.(permKey) ?? permKey;
  return (
    <Tooltip title={label}>
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => onCycle(state)}
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded border transition-colors',
          !canEdit && 'cursor-default',
          state === 'grant' && 'bg-blue-600 border-blue-600 text-white',
          state === 'deny' && 'bg-red-50 border-red-300 text-red-600',
          state === 'none' && inherited && 'bg-gray-50 border-gray-200 text-gray-400',
          state === 'none' && !inherited && 'bg-white border-gray-300 text-transparent',
        )}
      >
        {state === 'deny' ? (
          <X size={14} strokeWidth={3} />
        ) : state === 'grant' ? (
          <Check size={14} strokeWidth={3} />
        ) : inherited ? (
          <Check size={13} strokeWidth={2.5} className="opacity-60" />
        ) : (
          <Minus size={12} className="opacity-0" />
        )}
      </button>
    </Tooltip>
  );
}

/* ── "More" popover (long-tail action keys) ───────────────────────────── */
interface MorePopoverProps {
  items: BucketPerm[];
  mode: 'binary' | 'tristate';
  canEdit: boolean;
  isOn?: (permKey: string) => boolean;
  onBinaryToggle: (key: string, next: boolean) => void;
  triStateOf?: (permKey: string) => TriState;
  isInherited?: (permKey: string) => boolean;
  onCycle: (key: string, current: TriState) => void;
  sourceLabel?: (permKey: string) => string;
}

function MorePopover({
  items,
  mode,
  canEdit,
  isOn,
  onBinaryToggle,
  triStateOf,
  isInherited,
  onCycle,
  sourceLabel,
}: MorePopoverProps) {
  const activeCount =
    mode === 'binary'
      ? items.filter((i) => isOn?.(i.key)).length
      : items.filter((i) => (triStateOf?.(i.key) ?? 'none') !== 'none').length;

  const content = (
    <div className="w-64 max-h-72 overflow-y-auto -mx-1">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-gray-50"
        >
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-gray-800 truncate">{item.verb}</div>
            <div className="text-[10px] text-gray-400 truncate">{item.key}</div>
          </div>
          {mode === 'binary' ? (
            <AntCheckbox
              checked={isOn?.(item.key) ?? false}
              disabled={!canEdit}
              onChange={(e) => onBinaryToggle(item.key, e.target.checked)}
            />
          ) : (
            <MatrixCell
              permKey={item.key}
              bucket={item}
              mode="tristate"
              canEdit={canEdit}
              onBinaryToggle={() => {}}
              triStateOf={triStateOf}
              isInherited={isInherited}
              onCycle={(cur) => onCycle(item.key, cur)}
              sourceLabel={sourceLabel}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" title="More actions">
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] transition-colors',
          activeCount > 0
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50',
        )}
      >
        <MoreHorizontal size={13} />
        {activeCount > 0 && <span className="font-semibold">{activeCount}</span>}
      </button>
    </Popover>
  );
}
