'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Column, Table } from '@tanstack/react-table';
import {
  useDataTable,
  DataTable,
  DataTableColumnHeader,
  DataTableColumnHeaderLabel,
  DataTableControls,
  DataTablePagination,
  type ColumnDef,
} from '@/components/ui/data-table';
import { AuditEventContent } from './audit-event-content';
import { format, isSameDay } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  Ban,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Flag,
  Handshake,
  KeyRound,
  ListFilterPlus,
  Lock,
  LockOpen,
  MessageSquarePlus,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Reply,
  RotateCcw,
  Send,
  Smile,
  Terminal,
  ToggleRight,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  VenetianMask,
  type LucideIcon,
  ListFilter,
  FileText,
  Megaphone,
  MessagesSquare,
  Shield,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import {
  Popover,
  PopoverAnchor,
} from '@/components/ui/popover';
import {
  AuditColumnFilter,
  WhenRangePopoverContent,
  auditFilterActive,
  type AuditFilterColumn,
} from './audit-filters';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';
import {
  auditActionInfo,
  auditActionKind,
  auditActionLabel,
  type AuditActionKind,
  auditCategory,
  auditPersonName,
  auditRecordTitle,
} from '~/apps/shared/audit';
import { AuditPerson } from './audit-person';
import { AuditRecord } from './audit-record';

type AuditState = ReturnType<typeof useAdminAudit>;
const AuditTableContext = createContext<AuditState | null>(null);
const icons = {
  'people-access': Users,
  'clubs-chat': MessagesSquare,
  announcements: Megaphone,
  moderation: Shield,
  schedules: FileText,
  'flex-events': CalendarDays,
};
// Meaning tones from the theme palette: most rows stay neutral so the few
// approvals, removals, security changes and conversations stand out.
const tone = {
  neutral: 'text-tone-neutral',
  positive: 'text-tone-positive',
  negative: 'text-tone-negative',
  caution: 'text-tone-caution',
  social: 'text-tone-social',
};
const actionKinds: Record<AuditActionKind, [LucideIcon, string]> = {
  create: [Plus, tone.neutral], edit: [Pencil, tone.neutral],
  delete: [Trash2, tone.negative], approve: [CircleCheck, tone.positive],
  reject: [CircleX, tone.negative], archive: [Archive, tone.neutral],
  restore: [ArchiveRestore, tone.neutral], deactivate: [Ban, tone.negative],
  import: [Upload, tone.neutral], join: [UserPlus, tone.social],
  assign: [UserCheck, tone.neutral], request: [Handshake, tone.social],
  access: [KeyRound, tone.caution], publish: [Send, tone.social],
  message: [MessageSquarePlus, tone.social], reply: [Reply, tone.social],
  pin: [Pin, tone.neutral], toggle: [ToggleRight, tone.neutral],
  attendance: [ClipboardCheck, tone.neutral], report: [Flag, tone.caution],
  rule: [ListFilterPlus, tone.neutral], reaction: [Smile, tone.neutral],
  lock: [Lock, tone.caution], unlock: [LockOpen, tone.neutral],
  impersonate: [VenetianMask, tone.caution], cli: [Terminal, tone.neutral],
  sync: [RefreshCw, tone.neutral], retry: [RotateCcw, tone.neutral],
  failure: [CircleAlert, tone.negative],
};

function AuditAction({ event }: { event: AuditEventRecord }) {
  const category = auditCategory(event.entityType, event.action);
  const kind = auditActionKind(event.action);
  const [Icon, color] = kind ? actionKinds[kind] : [icons[category], tone.neutral];
  const label = auditActionLabel(event.action);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon size={14} className={`shrink-0 ${color}`} aria-hidden />
      <span
        title={label}
        className={`truncate ${auditActionInfo(event.action)?.destructive ? 'text-tone-negative' : 'text-foreground'}`}
      >
        {label}
      </span>
    </span>
  );
}

function AuditTime({ event }: { event: AuditEventRecord }) {
  const audit = useContext(AuditTableContext);
  if (!audit) throw new Error('AuditTime requires AuditTableContext');
  const open = audit.selectedAuditEventId === event.id;
  const date = new Date(event.createdAt);
  return <button type="button" aria-expanded={open}
    aria-label={`${open ? 'Collapse' : 'Expand'} ${auditActionLabel(event.action)}, ${format(date, 'PPP p')}`}
    title={format(date, 'PPP pp')}
    onClick={() => audit.setSelectedAuditEventId(open ? null : event.id)}
    className="flex items-center gap-2 whitespace-nowrap rounded-sm text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring">
    <ChevronRight size={14} aria-hidden className={open ? 'rotate-90' : undefined} />
    <time dateTime={event.createdAt}>{format(date, 'h:mm a')}</time>
  </button>;
}
function AuditPersonCell({ event }: { event: AuditEventRecord }) {
  const audit = useContext(AuditTableContext);
  if (!audit) throw new Error('AuditPersonCell requires AuditTableContext');
  return <AuditPerson event={event} onFilter={audit.setAuditActorId} />;
}

/** Feature filters use ColumnDef.header; Fluid retains ownership of sorting and controls. */
function AuditColumnHeader({
  title,
  column,
}: {
  column: Column<AuditEventRecord, unknown>;
  title: AuditFilterColumn;
}) {
  const audit = useContext(AuditTableContext);
  if (!audit) throw new Error('AuditColumnHeader requires AuditTableContext');
  const [menuOpen, setMenuOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  return (
    <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
      <PopoverAnchor asChild>
        <div>
          <DataTableColumnHeader column={column} title={title}>
          <DataTableColumnHeaderLabel />
          <DataTableControls>
          <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-compact"
                  active={auditFilterActive(audit, title)}
                  aria-label={`Filter ${title.toLowerCase()}`}
                >
                  <ListFilter />
                </Button>
              }
            />
            <AuditColumnFilter
              column={title}
              surface="menu"
              audit={audit}
              onCustomRange={() => {
                setMenuOpen(false);
                setRangeOpen(true);
              }}
            />
          </DropdownMenu>
          </DataTableControls>
          </DataTableColumnHeader>
        </div>
      </PopoverAnchor>
      {title === 'When' ? (
        <WhenRangePopoverContent audit={audit} />
      ) : null}
    </Popover>
  );
}

export function useAuditDataTable(audit: AuditState) {
  // Preserve scan positions on wide panes, including when filters return no rows.
  // DataTable reads each column at its full one-line width and never makes
  // the table narrower than their sum, so one long message or name widened
  // the table past the pane and that page alone scrolled sideways. A `size`
  // replaces the measured width: on a wide pane the shares below decide, and
  // on a narrow one (under 48rem) names and labels cut short instead.
  const columns = useMemo<ColumnDef<AuditEventRecord>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <AuditColumnHeader column={column} title="When" />,
        size: 112,
        meta: { label: 'When' },
        enableHiding: false,
        cell: ({ row }) => <AuditTime event={row.original} />,
      },
      {
        id: 'person',
        accessorFn: auditPersonName,
        header: ({ column }) => <AuditColumnHeader column={column} title="Person" />,
        size: 180,
        meta: { label: 'Person', className: 'overflow-visible @min-[48rem]/audit:w-[24%]!' },
        cell: ({ row }) => <AuditPersonCell event={row.original} />,
      },
      {
        id: 'action',
        accessorFn: (event) => auditActionLabel(event.action),
        header: ({ column }) => <AuditColumnHeader column={column} title="Action" />,
        size: 230,
        meta: { label: 'Action', className: '@min-[48rem]/audit:w-[29%]!' },
        enableHiding: false,
        cell: ({ row }) => <AuditAction event={row.original} />,
      },
      {
        id: 'record',
        accessorFn: auditRecordTitle,
        header: ({ column }) => <AuditColumnHeader column={column} title="Record" />,
        // Record takes the rest of the row; its size is only the room it
        // asks for (a message preview runs to 240 characters).
        size: 160,
        meta: { label: 'Record' },
        cell: ({ row }) => <AuditRecord event={row.original} />,
      },
    ],
    [],
  );
  const table = useDataTable<AuditEventRecord>({
    data: audit.displayedAuditEvents,
    columns,
    pageSize: 20,
    getRowId: (event) => event.id,
    manualFiltering: true,
    enableSorting: false,
    enableColumnPinning: false,
    state: { globalFilter: audit.auditSearch },
    onGlobalFilterChange: (update) =>
      audit.setAuditSearch(
        typeof update === 'function' ? update(audit.auditSearch) : update,
      ),
  });
  const lastFilter = useRef(audit.filterKey);
  useLayoutEffect(() => {
    if (lastFilter.current === audit.filterKey) return;
    lastFilter.current = audit.filterKey;
    table.setPageIndex(0);
  }, [audit.filterKey, table]);
  return table;
}

type AuditPagerProps = {
  audit: AuditState;
  table: Table<AuditEventRecord>;
};

export function AuditPagination({ audit, table }: AuditPagerProps) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const [pending, setPending] = useState<{
    filterKey: string;
    pageIndex: number;
    pageSize: number;
    targetPage: number;
  } | null>(null);
  const { filterKey, auditStatus, isAuditUpdating, loadMoreAuditEvents } = audit;
  const loaded = audit.displayedAuditEvents.length;
  const targetPage = loaded > pageIndex * pageSize ? pageIndex + 1 : pageIndex;
  const exhausted = auditStatus === 'Exhausted';
  const canAdvance = loaded > targetPage * pageSize || auditStatus === 'CanLoadMore';
  const isPending = pending?.filterKey === filterKey &&
    pending.pageIndex === pageIndex && pending.pageSize === pageSize;

  useEffect(() => {
    if (!pending) return;
    if (!isPending || isAuditUpdating) {
      setPending(null);
      return;
    }

    const start = pending.targetPage * pending.pageSize;
    if (loaded >= start + pending.pageSize || exhausted) {
      setPending(null);
      if (loaded > start) table.setPageIndex(pending.targetPage);
    } else if (auditStatus === 'CanLoadMore') {
      // Sparse filters can return short or empty cursor batches.
      loadMoreAuditEvents(AUDIT_FETCH_LIMIT);
    }
  }, [auditStatus, exhausted, isAuditUpdating, isPending, loaded, loadMoreAuditEvents, pending, table]);

  const exactTotal = !isAuditUpdating && audit.auditCounts?.exact
    ? audit.auditCounts.total
    : null;
  const totalRows = exhausted ? loaded : exactTotal == null ? null : Math.max(loaded, exactTotal);

  return (
    <DataTablePagination
      table={table}
      continuation={{
        totalRows,
        canAdvance: !isAuditUpdating && auditStatus !== 'LoadingFirstPage' && canAdvance,
        loading: isPending,
        onNextPage: () => {
          if (exhausted || loaded >= (targetPage + 1) * pageSize) {
            table.setPageIndex(targetPage);
          } else {
            setPending({ filterKey, pageIndex, pageSize, targetPage });
          }
        },
      }}
    />
  );
}

export function AuditTable({
  audit,
  table,
}: {
  audit: AuditState;
  table: Table<AuditEventRecord>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const { pageIndex, pageSize } = table.getState().pagination;
  useLayoutEffect(() => {
    const viewport = contentRef.current?.querySelector<HTMLElement>('[data-slot=scroll-area-viewport]');
    if (viewport) viewport.scrollTop = 0;
  }, [pageIndex, pageSize, audit.filterKey]);
  return (
    <div ref={contentRef} className="@container/audit flex min-h-0 min-w-0 flex-1 flex-col" aria-busy={audit.isStale}>
      <AuditTableContext.Provider value={audit}>
      <DataTable
        table={table}
        fill
        loading={audit.isAuditLoading}
        empty={{
          title: audit.auditStatus === 'Exhausted'
            ? 'No activity matches these filters.'
            : 'No matches in the history checked so far.',
        }}
        groupLabel={(row, previous) => {
          const day = new Date(row.original.createdAt);
          return previous && isSameDay(day, new Date(previous.original.createdAt)) ? null : format(day, 'EEEE, MMM d, yyyy');
        }}
        onRowClick={(row) => audit.setSelectedAuditEventId(row.id === audit.selectedAuditEventId ? null : row.id)}
        rowDetail={(row) => row.id === audit.selectedAuditEventId
          ? <AuditEventContent event={row.original} />
          : null}
      />
      </AuditTableContext.Provider>
    </div>
  );
}
