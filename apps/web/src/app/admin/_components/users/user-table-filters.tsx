'use client';

import { useState } from 'react';
import type { Table } from '@tanstack/react-table';
import { ChevronDown, CircleHelp, ListFilter, SlidersHorizontal, X } from 'lucide-react';
import { USER_FILTER_KEYS, USER_FILTERS, type UserFilter } from '~/apps/shared/admin-user-filters';
import { schoolYearLabel } from '~/apps/shared/school-time';
import { Button } from '@/components/ui/button';
import { Command, CommandInputSlot, CommandItem, CommandList } from '@/components/ui/command';
import { DataTableSearch, DataTableSearchInput } from '@/components/ui/data-table';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Dropdown, DropdownContent, DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useShape } from '@/lib/shape-context';
import type { useAdminUsers } from '../../_hooks/use-admin-users';
import type { AdminUserRecord } from '../../_lib/types';

type RosterFilters = Pick<ReturnType<typeof useAdminUsers>, 'filters' | 'hasFilters' | 'isFiltered' | 'setFilter' | 'clearFilters' | 'schoolYear'>;

function FilterMenu({ field, roster, header = false, inline = false }: {
  field: UserFilter;
  roster: RosterFilters;
  header?: boolean;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shape = useShape();
  const { label, any, options } = USER_FILTERS[field];
  const selected = roster.filters[field] ?? [];
  const applied = selected.length > 0;
  const first = options.find((option) => option.value === selected[0])?.label ?? any;
  const value = selected.length > 1 ? `${first} +${selected.length - 1}` : first;
  const rows = [{ value: '', label: any }, ...options];
  const checked = (key: string) => key ? selected.includes(key) : !applied;
  const checkedIndices = rows.flatMap((row, index) => checked(row.value) ? [index] : []);
  const items = rows.map((row, index) => (
    <MenuItem
      key={row.value}
      index={index}
      checked={checked(row.value)}
      label={row.label}
      closeOnClick={!row.value}
      onSelect={() => {
        roster.setFilter(field, !row.value ? [] : checked(row.value)
          ? selected.filter((item) => item !== row.value)
          : [...selected, row.value]);
      }}
    />
  ));
  if (inline) return (
    <Dropdown aria-label={`${label} options`} checkedIndices={checkedIndices} className="w-full max-w-none">
      {items}
    </Dropdown>
  );

  const menu = (
    <DropdownMenu size="compact" open={open} onOpenChange={setOpen}>
      <DropdownTrigger render={header ? (
        <Button type="button" variant="ghost" size="icon-compact" active={applied || open} aria-label={`Filter column: ${label}`}>
          <ListFilter />
        </Button>
      ) : (
        <Button
          type="button"
          size="compact"
          variant={applied ? 'ghost' : 'secondary'}
          active={open}
          trailingIcon={applied ? undefined : ChevronDown}
          aria-label={`${label} filter: ${value}`}
          className={applied ? 'rounded-r-none pr-1.5' : undefined}
        >
          <span className="mr-1 text-muted-foreground">{label}</span>
          <span className="max-w-40 truncate text-foreground">{value}</span>
        </Button>
      )} />
      <DropdownContent
        align="start"
        collisionPadding={8}
        checkedIndices={checkedIndices}
        className="[--roster-filter-bg:var(--surface-4)] lg:[--roster-filter-bg:var(--surface-5)] bg-(--roster-filter-bg) shadow-surface-2"
      >
        {items}
      </DropdownContent>
    </DropdownMenu>
  );

  if (header) return menu;
  return (
    <span className={applied ? `surface-top-edge inline-flex bg-[var(--tint)] ${shape.button}` : 'inline-flex'}>
      {menu}
      {applied ? <Button type="button" size="icon-compact" variant="ghost" className="rounded-l-none" aria-label={`Clear ${label.toLowerCase()} filter`} onClick={() => roster.setFilter(field, [])}>
        <X />
      </Button> : null}
    </span>
  );
}

export function UserHeaderFilter({ field, roster }: { field: UserFilter; roster: RosterFilters }) {
  return <FilterMenu field={field} roster={roster} header />;
}

export function UserFilterBar({ roster }: { roster: RosterFilters }) {
  return (
    <>
      <div className="hidden flex-wrap items-center gap-1.5 md:flex" aria-label="User filters">
        {USER_FILTER_KEYS.map((field) => <FilterMenu key={field} field={field} roster={roster} />)}
        {roster.isFiltered ? <Button type="button" variant="ghost" size="compact" onClick={roster.clearFilters}>Clear all</Button> : null}
      </div>
      {roster.hasFilters ? (
        <div className="flex flex-wrap items-center gap-1.5 md:hidden" aria-label="Active user filters">
          {USER_FILTER_KEYS.filter((field) => roster.filters[field]?.length).map((field) => (
            <Button key={field} type="button" size="compact" variant="secondary" trailingIcon={X} onClick={() => roster.setFilter(field, [])} aria-label={`Clear ${USER_FILTERS[field].label.toLowerCase()} filter`}>
              <span className="mr-1 text-muted-foreground">{USER_FILTERS[field].label}</span>
              {USER_FILTERS[field].options.filter((option) => roster.filters[field]?.includes(option.value)).map((option) => option.label).join(', ')}
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function UserFilterTools({ roster }: { roster: RosterFilters }) {
  const selectedCount = USER_FILTER_KEYS.filter((key) => roster.filters[key]?.length).length;
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label="User search help"><CircleHelp /></Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 text-sm">
          <p className="font-medium">Search users</p>
          <p className="mt-2 text-muted-foreground">
            Search by name, ID, or email, or combine filters such as <code>grade:11 status:active</code>.
            Quote phrases and use <code>-</code> to exclude a term.
          </p>
          <p className="mt-2 text-muted-foreground">
            Fields include name, id, email, grade, major, minor, role, status, flex, and password.
            Flex credits and attendance cover the {schoolYearLabel(roster.schoolYear)} school year.
          </p>
        </PopoverContent>
      </Popover>
      <div className="md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button type="button" variant="tertiary" size="icon" aria-label={`User filters${selectedCount ? ` (${selectedCount})` : ''}`}><SlidersHorizontal /></Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filter users</DrawerTitle>
              <DrawerDescription>Changes apply as you select filters.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto px-4 pb-4">
              {USER_FILTER_KEYS.map((field) => (
                <section key={field} className="space-y-1.5">
                  <h3 className="text-sm font-medium">{USER_FILTERS[field].label}</h3>
                  <FilterMenu field={field} roster={roster} inline />
                </section>
              ))}
            </div>
            <DrawerFooter>
              <DrawerClose asChild><Button type="button">Show users</Button></DrawerClose>
              <Button type="button" variant="ghost" onClick={roster.clearFilters}>Clear filters</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}

export function UserRosterSearch({ table, search, error, onSearchChange }: {
  table: Table<AdminUserRecord>;
  search: string;
  error?: string;
  onSearchChange: (value: string) => void;
}) {
  const [active, setActive] = useState(false);
  const match = search.match(/(?:^|\s)(-?)(grade|major|minor|role|status|flex|password):(?:"([^"\n]*)|([^\s"]*))$/i);
  const field = match?.[2]?.toLowerCase() as UserFilter | undefined;
  const fragment = (match?.[3] ?? match?.[4] ?? '').toLowerCase();
  const options = field ? USER_FILTERS[field].options.filter(({ value, label }) =>
    `${value} ${label}`.toLowerCase().includes(fragment),
  ) : [];
  const open = active && options.length > 0;
  return (
    <Popover open={open} onOpenChange={setActive}>
      <Command surface="inherit" shouldFilter={false} loop className="h-auto min-w-0 flex-1 overflow-visible">
        <PopoverAnchor asChild>
          <DataTableSearch table={table} placeholder="Search by name, ID, or email…" collapsible={false}>
            <CommandInputSlot asChild value={search}>
              <DataTableSearchInput
                outlined
                aria-label="Search users"
                aria-expanded={open}
                aria-invalid={!!error}
                aria-describedby={error ? 'user-search-error' : undefined}
                onFocus={() => setActive(true)}
                onChange={() => setActive(true)}
              />
            </CommandInputSlot>
          </DataTableSearch>
        </PopoverAnchor>
        <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0" onOpenAutoFocus={(event) => event.preventDefault()} onCloseAutoFocus={(event) => event.preventDefault()}>
          <CommandList aria-label={`${field ?? ''} suggestions`}>
            {options.map(({ value, label }) => (
              <CommandItem key={value} value={value} onSelect={() => {
                if (!match) return;
                const start = (match.index ?? 0) + (/^\s/.test(match[0]) ? 1 : 0);
                onSearchChange(`${search.slice(0, start)}${match[1]}${field}:${value} `);
                setActive(false);
              }}>{label}</CommandItem>
            ))}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
