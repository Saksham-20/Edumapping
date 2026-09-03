// client/src/components/admin/DataTable.js
import React, { useMemo, useState } from 'react';
import { ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon, InboxIcon } from '@heroicons/react/24/outline';
import {
  EmptyState,
  Pagination,
  Skeleton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  cx
} from '../ui';

/**
 * The admin dashboard's list table.
 *
 * Sorting is client-side over the current page only — the server paginates, so
 * this deliberately reorders what is on screen and nothing more.
 */
const DataTable = ({
  columns,
  data = [],
  onRowClick,
  actions,
  pagination,
  onPageChange,
  loading = false,
  emptyTitle = 'Nothing to show',
  emptyDescription = 'No records match the current filters.'
}) => {
  const [sort, setSort] = useState({ column: null, direction: 'asc' });

  const toggleSort = (key) =>
    setSort((prev) =>
      prev.column === key
        ? { column: key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { column: key, direction: 'asc' }
    );

  const rows = useMemo(() => {
    if (!sort.column) return data;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = a[sort.column];
      const bv = b[sort.column];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // blanks sink, whichever way the column is sorted
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [data, sort]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink-950/15 bg-white p-5">
        <Skeleton className="h-8 w-full" />
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState icon={InboxIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div>
      <Table>
        <Thead>
          <Tr className="hover:bg-transparent">
            {columns.map((column) => {
              const sorted = sort.column === column.key;
              if (!column.sortable) {
                return <Th key={column.key}>{column.label}</Th>;
              }
              return (
                // Raw <th> rather than the kit's, which owns its own padding —
                // the sort control has to fill the whole cell to be a
                // comfortable target.
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  {(
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="flex w-full items-center gap-1.5 px-4 py-3 text-left font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600 transition-colors hover:bg-bone-200 hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-950"
                    >
                      {column.label}
                      {sorted ? (
                        sort.direction === 'asc' ? (
                          <ChevronUpIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronUpDownIcon aria-hidden="true" className="h-3.5 w-3.5 opacity-40" />
                      )}
                      <span className="sr-only">
                        {sorted ? `sorted ${sort.direction}ending` : ', sort by this column'}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
            {actions && (
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            )}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row, index) => (
            <Tr key={row.id ?? index}>
              {columns.map((column, colIndex) => {
                const content = column.render
                  ? column.render(row[column.key], row)
                  : row[column.key] ?? '—';
                return (
                  <Td key={column.key} className={cx(colIndex === 0 && 'font-medium text-ink-950')}>
                    {/* Row activation lives on a button in the first cell —
                        a clickable <tr> is invisible to the keyboard. */}
                    {onRowClick && colIndex === 0 ? (
                      <button
                        type="button"
                        onClick={() => onRowClick(row)}
                        className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-950"
                      >
                        {content}
                      </button>
                    ) : (
                      content
                    )}
                  </Td>
                );
              })}
              {actions && <Td className="text-right">{actions(row)}</Td>}
            </Tr>
          ))}
        </Tbody>
      </Table>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-5 flex flex-col items-center gap-3">
          <Pagination
            page={pagination.currentPage}
            pages={pagination.totalPages}
            onChange={(p) => onPageChange && onPageChange(p)}
          />
          {pagination.totalItems != null && (
            <p className="text-xs text-ink-500">
              {pagination.totalItems} record{pagination.totalItems === 1 ? '' : 's'} in total
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
