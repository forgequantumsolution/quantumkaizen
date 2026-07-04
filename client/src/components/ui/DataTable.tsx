import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T = any> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  rowClassName?: (row: T) => string;
  isLoading?: boolean;
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: { label: string; action: string; variant?: 'danger' | 'default' }[];
  onBulkAction?: (action: string, selectedRows: T[]) => void;
  /**
   * When provided, the table is driven by the server: `data` is treated as the
   * current page (not sliced), client-side sorting is disabled, and the pager
   * reflects `totalItems`. `page` is 1-based.
   */
  serverPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
  };
}

function SkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr key={rowIdx} className="border-b border-surface-border-light last:border-0">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <td key={colIdx} className="px-5 py-3.5">
              <div
                className="skeleton-text"
                style={{ width: `${45 + Math.random() * 40}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data found',
  rowClassName,
  isLoading,
  pageSize = 10,
  selectable,
  bulkActions,
  onBulkAction,
  serverPagination,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  // Client sorting only applies in client-pagination mode; the server owns
  // ordering when paginating server-side.
  const sortedData =
    !serverPagination && sortKey
      ? [...data].sort((a, b) => {
          const av = (a as any)[sortKey];
          const bv = (b as any)[sortKey];
          if (av == null) return 1;
          if (bv == null) return -1;
          const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
          return sortDir === 'asc' ? cmp : -cmp;
        })
      : data;

  const effPageSize = serverPagination?.pageSize ?? pageSize;
  const effPage = serverPagination ? serverPagination.page - 1 : page;
  const totalItems = serverPagination?.totalItems ?? sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / effPageSize));
  // In server mode `data` is already the current page; don't slice it.
  const paginatedData = serverPagination
    ? data
    : sortedData.slice(page * pageSize, (page + 1) * pageSize);
  const goToPage = (p: number) => {
    if (serverPagination) serverPagination.onPageChange(p + 1);
    else setPage(p);
  };

  const toggleRow = (idx: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedData.map((_, i) => i)));
    }
  };

  if (!isLoading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {selectable && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-t-xl -mb-px">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-2">
            {(bulkActions ?? []).map((ba) => (
              <button
                key={ba.action}
                onClick={() => {
                  onBulkAction?.(ba.action, data.filter((_, i) => selectedIds.has(i)));
                  setSelectedIds(new Set());
                }}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                  ba.variant === 'danger'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
              >
                {ba.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-white/70 hover:text-white"
          >
            Deselect all
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-surface-border bg-surface-secondary/50">
              {selectable && (
                <th className="px-5 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginatedData.length && paginatedData.length > 0}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
              )}
              {columns.map((col) => {
                const canSort = !serverPagination && col.sortable !== false;
                return (
                <th
                  key={col.key}
                  className={cn(
                    'px-5 py-3 text-xxs font-semibold uppercase tracking-wider text-gray-500',
                    'whitespace-nowrap select-none',
                    canSort && 'cursor-pointer hover:text-gray-700',
                    col.className,
                  )}
                  onClick={() => canSort && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {canSort && (
                      <span className="shrink-0">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp size={12} className="text-blue-600" />
                          ) : (
                            <ChevronDown size={12} className="text-blue-600" />
                          )
                        ) : (
                          <ChevronsUpDown size={12} className="text-gray-300" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows columns={columns.length + (selectable ? 1 : 0)} />
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={(row as any).id ?? idx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-surface-border-light last:border-0',
                    'transition-colors duration-150',
                    onRowClick && 'cursor-pointer hover:bg-blue-50',
                    rowClassName?.(row),
                  )}
                >
                  {selectable && (
                    <td className="px-5 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(idx)}
                        onChange={() => toggleRow(idx)}
                        className="rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-5 py-3.5 text-body text-gray-700 whitespace-nowrap',
                        col.className,
                      )}
                    >
                      {col.render ? col.render(row) : ((row as any)[col.key] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalItems > effPageSize && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-surface-secondary">
          <p className="text-xs text-gray-500">
            Showing {totalItems === 0 ? 0 : effPage * effPageSize + 1}–
            {Math.min((effPage + 1) * effPageSize, totalItems)} of {totalItems}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(Math.max(0, effPage - 1))}
              disabled={effPage === 0}
              className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i)
              .slice(Math.max(0, effPage - 2), Math.min(totalPages, effPage + 3))
              .map((i) => (
                <button
                  key={i}
                  onClick={() => goToPage(i)}
                  className={cn(
                    'w-7 h-7 text-xs rounded border transition-colors',
                    i === effPage
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 hover:bg-gray-100',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            <button
              onClick={() => goToPage(Math.min(totalPages - 1, effPage + 1))}
              disabled={effPage >= totalPages - 1}
              className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
