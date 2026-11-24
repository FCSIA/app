'use client';

import type { ReactNode } from 'react';
import type { Row, Table } from '@tanstack/react-table';
import {
  DataTable,
  DataTableSearch,
  DataTableViewOptions,
  DataTablePagination,
} from '@/components/ui/data-table';
import {
  DataTableCount,
  DataTableSection,
} from '@/components/data/data-table-section';
import { SearchToolbarRow } from '@/components/ui/search';
import { cn } from '@/lib/utils';

/**
 * The admin table anatomy: a pinned toolbar (search, the tab's own controls,
 * column options, live count), then the Fluid table and its footer. Callers own
 * their data and table state; `mobile` replaces the table below `md`.
 * Without a `label` the table is embedded (a dialog or preview): the toolbar
 * stays in flow instead of pinning to the tab's scroll viewport.
 */
export function AdminDataTable<T>({
  label,
  table,
  loading,
  empty,
  searchPlaceholder,
  searchControl,
  controls,
  count,
  toolbarBelow,
  mobile,
  footer,
  onRowClick,
}: {
  label?: string;
  table: Table<T>;
  loading?: boolean;
  empty?: string;
  searchPlaceholder?: string;
  searchControl?: ReactNode;
  /** Tab-specific controls placed between search and column options. */
  controls?: ReactNode;
  count?: ReactNode;
  /** A second toolbar line, e.g. view tabs or a selection bar. */
  toolbarBelow?: ReactNode;
  mobile?: ReactNode;
  /** Replaces the client-side pagination, e.g. for server cursors. */
  footer?: ReactNode;
  onRowClick?: (row: Row<T>) => void;
}) {
  const desktop = (
    <DataTable
      table={table}
      fill={!!label}
      loading={loading}
      empty={empty ? { title: empty } : undefined}
      onRowClick={onRowClick}
    />
  );
  const toolbar = (
    <>
      <SearchToolbarRow className="flex-row flex-wrap items-center gap-2">
        {searchControl ?? <DataTableSearch table={table} placeholder={searchPlaceholder} collapsible={false} />}
        {/* Trailing controls sit at the row's end, as in the audit log. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {controls}
          <DataTableViewOptions table={table} className="hidden md:inline-flex" />
          {count != null ? <DataTableCount>{count}</DataTableCount> : null}
        </div>
      </SearchToolbarRow>
      {toolbarBelow}
    </>
  );
  // A server footer can serve both table rows and phone cards. Client
  // pagination only applies to the desktop table when phone cards are supplied.
  const pagination = footer === undefined ? <DataTablePagination table={table} /> : footer;
  const desktopOnlyFooter = !!mobile && footer === undefined;
  const body = mobile ? (
    <>
      <div className={cn("hidden min-w-0", label ? "md:flex md:min-h-0 md:flex-1 md:flex-col" : "md:block")}>{desktop}</div>
      <div className={desktopOnlyFooter && label ? 'pb-6 md:hidden' : 'md:hidden'}>{mobile}</div>
    </>
  ) : desktop;
  if (!label)
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {toolbar}
        <div className="min-w-0">
          {body}
          {pagination != null ? (
            <div className={desktopOnlyFooter ? 'hidden pt-3 md:block' : 'pt-3'}>{pagination}</div>
          ) : null}
        </div>
      </div>
    );
  return (
    <DataTableSection
      label={label}
      toolbar={toolbar}
      tableViewport={mobile ? 'desktop' : 'always'}
      footer={pagination}
      footerClassName={desktopOnlyFooter ? 'hidden md:block' : undefined}
    >
      {body}
    </DataTableSection>
  );
}
