'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { Popover, PopoverAnchor } from '@/components/ui/popover';
import { useShape } from '@/lib/shape-context';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';
import {
  AuditColumnFilter,
  WHEN_PRESETS,
  WhenRangePopoverContent,
  type AuditFilterColumn,
} from './audit-filters';

type AuditState = ReturnType<typeof useAdminAudit>;

const COLUMNS: AuditFilterColumn[] = ['When', 'Person', 'Action', 'Record'];
const UNSET: Record<AuditFilterColumn, string> = {
  When: 'Any time',
  Person: 'Anyone',
  Action: 'Any action',
  Record: 'Any record',
};

const shortDate = (value: string) => format(parseISO(value), 'MMM d');

function whenSummary(audit: AuditState) {
  const from = audit.auditStartDate;
  const to = audit.auditEndDate;
  const preset = WHEN_PRESETS.find((item) => {
    const [start, end] = item.range();
    return start === from && end === to;
  });
  if (preset) return preset.label;
  if (from && to) return from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
  return from ? `Since ${shortDate(from)}` : `Until ${shortDate(to)}`;
}

/**
 * One labelled control per column, so a reader sees every filter's current
 * value without opening anything: the column name stays muted and the value
 * reads in full contrast. Opening a control shows the same menu as that
 * column's header filter.
 */
export function AuditFilterBar({ audit }: { audit: AuditState }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filters">
      {COLUMNS.map((column) => (
        <AuditFilterControl key={column} column={column} audit={audit} />
      ))}
      {audit.auditFilterChips.length > 1 ? (
        <Button
          type="button"
          size="compact"
          variant="ghost"
          onClick={audit.clearAuditFilters}
        >
          Clear all
        </Button>
      ) : null}
    </div>
  );
}

function AuditFilterControl({
  column,
  audit,
}: {
  column: AuditFilterColumn;
  audit: AuditState;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const shape = useShape();
  const chips = audit.auditFilterChips.filter((chip) => chip.column === column);
  const applied = chips.length > 0;
  const value = !applied
    ? UNSET[column]
    : column === 'When'
      ? whenSummary(audit)
      : chips.length === 1
        ? chips[0].label
        : `${chips[0].label} +${chips.length - 1}`;
  // Applied, the pill holds two targets (open, clear) on one shared surface:
  // ghost buttons over a single tint, so no seam is drawn between them.
  const trigger = (
    <DropdownMenu size="compact" open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownTrigger
        render={
          <Button
            type="button"
            size="compact"
            variant={applied ? 'ghost' : 'secondary'}
            active={menuOpen}
            trailingIcon={applied ? undefined : ChevronDown}
            aria-label={`${column} filter: ${value}`}
            className={applied ? 'rounded-r-none pr-1.5' : undefined}
          >
            <span className="mr-1 text-muted-foreground">{column}</span>
            <span className="max-w-48 truncate text-foreground">{value}</span>
          </Button>
        }
      />
      <AuditColumnFilter
        column={column}
        surface="menu"
        audit={audit}
        onCustomRange={() => {
          setMenuOpen(false);
          setRangeOpen(true);
        }}
      />
    </DropdownMenu>
  );
  const control = applied ? (
    <span className={`surface-top-edge inline-flex bg-[var(--tint)] ${shape.button}`}>
      {trigger}
      <Button
        type="button"
        size="icon-compact"
        variant="ghost"
        aria-label={`Clear ${column.toLowerCase()} filter`}
        className="rounded-l-none"
        onClick={() => chips.forEach((chip) => chip.clear())}
      >
        <X />
      </Button>
    </span>
  ) : (
    trigger
  );
  if (column !== 'When') return control;
  return (
    <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
      <PopoverAnchor asChild>
        <span className="inline-flex">{control}</span>
      </PopoverAnchor>
      <WhenRangePopoverContent audit={audit} />
    </Popover>
  );
}
