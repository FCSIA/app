'use client';

import { isPathway, PATHWAY_ABBREVIATIONS } from '~/apps/shared/labels';
import { isPrivilegedAccount } from '~/apps/shared/roles';
import type { UserFilter } from '~/apps/shared/admin-user-filters';
import { SCHOOL_TIME_ZONE } from '~/apps/shared/school-time';
import { displayName } from '~/apps/shared/user-name';

import { createContext, forwardRef, useContext, useState } from 'react';
import type { HeaderContext } from '@tanstack/react-table';
import { useSearchParams } from 'next/navigation';
import { KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DeveloperBadge } from '@/components/ui/developer-badge';
import {
  useDataTable,
  DataTableColumnHeader,
  DataTableColumnHeaderLabel,
  DataTableControls,
  DataTablePagination,
  selectColumn,
  type ColumnDef,
} from '@/components/ui/data-table';
import { AdminDataTable } from '../admin-data-table';
import { Card, CardDescription, CardFooter, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatPathwayLabel, formatRoleLabel } from '../../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../../_lib/types';
import { useAdminUsers } from '../../_hooks/use-admin-users';
import { AdminNotice } from '../admin-ui';
import { UserPermissionsPopover } from './user-permissions-popover';
import { ImpersonateUserAction } from '@/components/auth/impersonate-user-action';
import { InputCopy } from '@/components/ui/input-copy';
import { Skeleton } from '@/components/ui/skeleton';
import { UserFilterBar, UserFilterTools, UserHeaderFilter, UserRosterSearch } from './user-table-filters';

const ROLE_BADGE_LIMIT = 2;
const rosterDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: SCHOOL_TIME_ZONE,
});
const formatRosterDate = (value: string | number) => rosterDateFormatter.format(Number(value));

function PathwayCell({ value }: { value?: string | null }) {
  const label = formatPathwayLabel(value);
  return (
    <abbr title={label} aria-label={label} className="block truncate no-underline">
      {(value && isPathway(value) && PATHWAY_ABBREVIATIONS[value]) || label}
    </abbr>
  );
}

function RoleSummary({ roles }: { roles: string[] }) {
  const visibleRoles = roles.slice(0, ROLE_BADGE_LIMIT);
  const overflowCount = roles.length - visibleRoles.length;
  const fullLabel = roles.map(formatRoleLabel).join(', ') || 'No roles';

  return (
    <div
      className="flex max-w-full items-center gap-1 overflow-hidden"
      aria-label={fullLabel}
      title={fullLabel}
    >
      {visibleRoles.map((role) => (
        <Badge key={role} variant="solid" size="sm">
          {formatRoleLabel(role)}
        </Badge>
      ))}
      {overflowCount > 0 ? (
        <Badge variant="solid" color="gray" size="sm" className="shrink-0">
          +{overflowCount}
        </Badge>
      ) : null}
    </div>
  );
}

const IconActionButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  function IconActionButton({ label, children, ...props }, ref) {
    return (
      <Tooltip content={label} side="top" delayDuration={250}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          {...props}
          ref={ref}
          aria-label={label}
          title={label}
        >
          {children}
        </Button>
      </Tooltip>
    );
  },
);

function ResetPasswordAction({
  user,
  disabled,
  onResetPassword,
}: {
  user: AdminUserRecord;
  disabled: boolean;
  onResetPassword: (user: AdminUserRecord) => Promise<string | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string>();
  const [isResetting, setIsResetting] = useState(false);
  const label = `Reset password for ${displayName(user)}`;

  const resetPassword = async () => {
    setIsResetting(true);
    const password = await onResetPassword(user);
    setIsResetting(false);
    if (password) setTemporaryPassword(password);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setTemporaryPassword(undefined);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <IconActionButton label={label} disabled={disabled}>
          <KeyRound className="size-4" />
        </IconActionButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{temporaryPassword ? 'Temporary password created' : 'Reset password?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {temporaryPassword
              ? `Copy this password and share it securely with ${displayName(user)}. It is only shown once.`
              : `This will generate a temporary password for ${displayName(user)} and mark their account to change it after signing in.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {temporaryPassword ? <InputCopy label="Temporary password" value={temporaryPassword} variant="button" /> : null}
        <AlertDialogFooter>
          {temporaryPassword ? (
            <AlertDialogCancel>Done</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
              <Button type="button" onClick={() => void resetPassword()} disabled={isResetting}>
                {isResetting ? 'Resetting...' : 'Reset password'}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BulkDeleteUsersAction({
  selectedCount,
  disabled,
  onDelete,
}: {
  selectedCount: number;
  disabled: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="tertiary"
          size="sm"
          leadingIcon={Trash2}
          disabled={disabled || selectedCount === 0}
          className="text-destructive hover:text-destructive"
        >
          Delete {selectedCount} selected
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {selectedCount} user {selectedCount === 1 ? 'account' : 'accounts'}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the selected sign-ins, sessions, profile records, and profile images. Historical school and collaboration records remain for audit continuity.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            variant="destructive"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const UserHeaderContext = createContext<ReturnType<typeof useAdminUsers> | null>(null);
const rosterHeaderFilters: Record<string, UserFilter> = {
  grade: 'grade', major: 'major', minor: 'minor', roles: 'role', status: 'status',
  'flex-credits': 'flex', password: 'password',
};

function RosterColumnHeader({ column }: HeaderContext<AdminUserRecord, unknown>) {
  const roster = useContext(UserHeaderContext);
  const label = column.columnDef.meta?.label ?? column.id;
  const field = rosterHeaderFilters[column.id];
  if (!roster || !field) return <DataTableColumnHeader column={column} title={label} />;
  return (
    <DataTableColumnHeader column={column} title={label}>
      <DataTableColumnHeaderLabel />
      <DataTableControls><UserHeaderFilter field={field} roster={roster} /></DataTableControls>
    </DataTableColumnHeader>
  );
}

function rosterColumn(
  id: string,
  label: string,
  accessorFn: (user: AdminUserRecord) => string | number | undefined | null,
  { format = String, minWidth }: {
    format?: (value: number | string) => string;
    minWidth?: string;
  } = {},
): ColumnDef<AdminUserRecord> {
  return {
    id,
    accessorFn,
    header: RosterColumnHeader,
    cell: ({ getValue }) => {
      const value = getValue<number | string | null | undefined>();
      if (value == null || value === '') return <span className="text-muted-foreground" aria-label="Not available">—</span>;
      const text = format(value);
      return <span className="block truncate tabular-nums" title={text}>{text}</span>;
    },
    meta: { label, className: minWidth },
  };
}

function UserTableSection({ roster }: { roster: ReturnType<typeof useAdminUsers> }) {
  const {
    selectedUserRoleMeta: { label: title, emptyMessage },
    users,
    totalCount,
    isUsersLoading: isLoading,
    search,
    setSearch: onSearchChange,
    userRoleGroup,
    setUserRoleGroup: onUserRoleGroupChange,
    currentUserId,
    isSuperAdmin,
    canManage,
    canDeleteUsers,
    onDeactivate,
    onActivate,
    onResetPassword,
    onDeleteUsers,
    isDeleteUsersPending,
    isResetPasswordPending,
    isAssignRolesPending,
    onAssignRoles,
    onSetDeveloper,
    status,
    canLoadPrevious,
    pageIndex,
    pageSize,
    setPageSize: onPageSizeChange,
    pendingPageDirection,
    isSearchPending,
    loadNextPage,
    loadPreviousPage,
  } = roster;
  // Keep the Fluid table mounted so frozen/visible columns survive paging.
  const scope = JSON.stringify([roster.selectionScope, userRoleGroup, pageIndex, pageSize]);
  const [selectionScope, setSelectionScope] = useState(scope);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  if (selectionScope !== scope) {
    setSelectionScope(scope);
    setSelectedUserIds(new Set());
  }
  const selectedCount = selectedUserIds.size;

  const clearSelection = () => setSelectedUserIds(new Set());

  const deleteSelectedUsers = () => {
    void onDeleteUsers(Array.from(selectedUserIds)).then((didDelete) => {
      if (didDelete) clearSelection();
    });
  };

  const userActions = (user: AdminUserRecord) => (
    <>
      <UserPermissionsPopover
        user={user}
        isSuperAdmin={isSuperAdmin}
        isPending={isAssignRolesPending}
        onAssignRoles={onAssignRoles}
        onSetDeveloper={onSetDeveloper}
      />
      {canManage(user) && user._id !== currentUserId ? (
        <ResetPasswordAction
          user={user}
          disabled={isResetPasswordPending}
          onResetPassword={onResetPassword}
        />
      ) : null}
      {isSuperAdmin && user._id !== currentUserId && !isPrivilegedAccount(user) ? (
        <ImpersonateUserAction
          userId={user._id}
          name={displayName(user)}
        />
      ) : null}
      {user.isActive ? (
        canManage(user) && user._id !== currentUserId ? (
          <IconActionButton
            label={`Deactivate ${displayName(user)}`}
            onClick={() => onDeactivate(user._id)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <UserX className="size-4" />
          </IconActionButton>
        ) : null
      ) : (
        <IconActionButton
          label={`Activate ${displayName(user)}`}
          onClick={() => onActivate(user._id)}
          className="text-tone-positive hover:bg-tone-positive/10 hover:text-tone-positive"
        >
          <UserCheck className="size-4" />
        </IconActionButton>
      )}
    </>
  );

  const countLabel = isLoading
    ? '—'
    : roster.isFiltered
      ? status === 'Exhausted' && pageIndex === 0
        ? `${users.length} ${users.length === 1 ? 'match' : 'matches'}`
        : `${users.length} shown`
      : typeof totalCount === 'number'
        ? `${users.length.toLocaleString()}/${totalCount.toLocaleString()} ${totalCount === 1 ? 'user' : 'users'}`
        : `${users.length} ${users.length === 1 ? 'user' : 'users'}`;
  const rosterControls = (
    <>
      <Select value={userRoleGroup} onValueChange={(value) => onUserRoleGroupChange(value as AdminUserRoleGroup)}>
        <SelectTrigger className="min-w-28 shrink-0 sm:min-w-36" placeholder="User group" aria-label="User group" />
        <SelectContent>
          <SelectItem index={0} value="students">Students</SelectItem>
          <SelectItem index={1} value="teachers">Teachers</SelectItem>
          <SelectItem index={2} value="student-admin">Student Admins</SelectItem>
          <SelectItem index={3} value="other">Other Roles</SelectItem>
          <SelectItem index={4} value="all">All Users</SelectItem>
        </SelectContent>
      </Select>
      <UserFilterTools roster={roster} />
    </>
  );
  const selectionBar = canDeleteUsers && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {selectedCount} selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDeleteUsersPending}
            onClick={clearSelection}
          >
            Clear
          </Button>
          <BulkDeleteUsersAction
            selectedCount={selectedCount}
            disabled={isDeleteUsersPending}
            onDelete={deleteSelectedUsers}
          />
        </div>
  ) : null;

  const columns: ColumnDef<AdminUserRecord>[] = [
    selectColumn<AdminUserRecord>(),
    {
      id: 'name',
      accessorFn: (user) => displayName(user),
      header: RosterColumnHeader,
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-1 font-medium leading-tight">
          <span className="min-w-0 truncate" title={displayName(row.original)}>{displayName(row.original)}</span>
          <DeveloperBadge user={row.original} size={13} />
        </span>
      ),
      meta: { label: 'Name', className: 'min-w-36' },
    },
    rosterColumn('grade', 'Grade', (user) => user.gradeLevel),
    {
      ...rosterColumn('major', 'Major', (user) => user.major),
      cell: ({ row }) => <PathwayCell value={row.original.major} />,
    },
    {
      ...rosterColumn('minor', 'Minor', (user) => user.minor),
      cell: ({ row }) => <PathwayCell value={row.original.minor} />,
    },
    {
      ...rosterColumn('roles', 'Roles', (user) => (user.roles ?? []).join(', ')),
      cell: ({ row }) => <RoleSummary roles={row.original.roles ?? []} />,
    },
    {
      ...rosterColumn('status', 'Status', (user) => (user.isActive ? 'Active' : 'Inactive')),
      cell: ({ row }) => (
        <Badge variant="solid" color={row.original.isActive ? 'emerald' : 'red'} size="sm">
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    rosterColumn('school-id', 'School ID', (user) => user.uniqueId, { minWidth: 'min-w-28' }),
    rosterColumn('email', 'Email', (user) => user.email, { minWidth: 'min-w-52' }),
    rosterColumn('flex-credits', 'Flex credits', (user) => user.roster?.flex?.earned, { minWidth: 'min-w-32' }),
    rosterColumn('flex-remaining', 'Flex credits left', (user) => user.roster?.flex?.remaining, { minWidth: 'min-w-32' }),
    rosterColumn('flex-fall', 'Fall Flex credits', (user) => user.roster?.flex?.fall),
    rosterColumn('flex-spring', 'Spring Flex credits', (user) => user.roster?.flex?.spring),
    rosterColumn('flex-absences', 'Flex absences', (user) => user.roster?.flex?.absences),
    rosterColumn('flex-excused', 'Flex excused', (user) => user.roster?.flex?.excused),
    rosterColumn('flex-tardies', 'Flex tardies', (user) => user.roster?.flex?.tardies),
    rosterColumn('flex-last', 'Last Flex credit', (user) => user.roster?.flex?.lastCreditAt, { format: formatRosterDate }),
    rosterColumn('roster-name', 'Roster name', (user) => `${user.firstName} ${user.lastName}`.trim()),
    rosterColumn('preferred-name', 'Preferred name', (user) => user.preferredName),
    rosterColumn('password', 'Password', (user) => user.roster && (user.roster.mustResetPassword ? 'Reset required' : 'Ready')),
    rosterColumn('developer', 'Developer badge', (user) => user.isDeveloper ? 'Enabled' : '—'),
    rosterColumn('feedback-reviewer', 'Feedback review', (user) => user.roster && (user.roster.canReviewFeedback ? 'Enabled' : '—')),
    rosterColumn('created', 'Account created', (user) => user.roster?.createdAt, { format: formatRosterDate }),
    rosterColumn('updated', 'Account updated', (user) => user.roster?.updatedAt, { format: formatRosterDate }),
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DataTableControls className="justify-end">{userActions(row.original)}</DataTableControls>
      ),
      meta: { label: 'Actions' },
    },
  ];
  const table = useDataTable({
    data: users,
    columns,
    getRowId: (user) => user._id,
    manualFiltering: true,
    manualPagination: true,
    enableSorting: false,
    enableColumnFilters: false,
    initialState: { columnVisibility: {
      'flex-excused': false, 'flex-tardies': false, 'flex-last': false,
      'roster-name': false, 'preferred-name': false, password: false, developer: false,
      'feedback-reviewer': false, created: false, updated: false,
    } },
    state: {
      globalFilter: search,
      pagination: { pageIndex, pageSize },
      rowSelection: Object.fromEntries([...selectedUserIds].map((id) => [id, true])),
    },
    onPaginationChange: (update) => {
      const next = typeof update === 'function' ? update({ pageIndex, pageSize }) : update;
      onPageSizeChange(next.pageSize);
    },
    onGlobalFilterChange: (update) => onSearchChange(typeof update === 'function' ? update(search) : update),
    enableRowSelection: (row) => canDeleteUsers && row.original._id !== currentUserId && !isDeleteUsersPending,
    onRowSelectionChange: (update) =>
      setSelectedUserIds((current) => {
        const previous = Object.fromEntries([...current].map((id) => [id, true]));
        const next = typeof update === 'function' ? update(previous) : update;
        return new Set(Object.keys(next).filter((id) => next[id]));
      }),
  });

  return (
    <AdminDataTable
      label={title}
      table={table}
      loading={isLoading}
      empty={status === 'CanLoadMore' ? 'No matches on this page. More users are available.' : roster.isFiltered ? 'No users match these filters.' : emptyMessage}
      searchControl={<UserRosterSearch table={table} search={search} error={roster.searchError} onSearchChange={onSearchChange} />}
      controls={rosterControls}
      count={countLabel}
      toolbarBelow={
        <>
          {roster.searchError ? <p id="user-search-error" role="status" className="text-xs text-destructive">{roster.searchError} Showing the last valid search.</p> : null}
          <UserFilterBar roster={roster} />
          {selectionBar}
        </>
      }
      footer={
        <DataTablePagination
          table={table}
          pageSizes={[10, 20, 30, 50]}
          continuation={{
            totalRows: roster.isFiltered
              ? status === 'Exhausted' && pageIndex === 0 && !isSearchPending ? users.length : null
              : totalCount ?? null,
            canAdvance: status === 'CanLoadMore' && !isSearchPending,
            loading: pendingPageDirection === 'next',
            onNextPage: loadNextPage,
            canGoBack: canLoadPrevious && status !== 'LoadingMore' && !isSearchPending,
            loadingPrevious: pendingPageDirection === 'previous',
            onPreviousPage: loadPreviousPage,
          }}
        />
      }
      mobile={
        isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
          </div>
        ) : users.length === 0 ? (
          <AdminNotice message={status === 'CanLoadMore' ? 'No matches on this page. More users are available.' : roster.isFiltered ? 'No users match these filters.' : emptyMessage} />
        ) : (
          <CardGroup border="none" corners="compact">
            {users.map((user) => (
              <Card key={user._id}>
                <CardHeader>
                  <CardTitle>
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{displayName(user)}</span>
                        <DeveloperBadge user={user} size={13} />
                      </span>
                      <Badge variant="solid" color={user.isActive ? 'emerald' : 'red'} size="sm">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </span>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {[user.gradeLevel ? `Grade ${user.gradeLevel}` : null, (user.roles ?? []).map(formatRoleLabel).join(', '), user.roster?.flex ? `${user.roster.flex.earned} Flex credits` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <div className="flex items-center gap-1">{userActions(user)}</div>
                </CardFooter>
              </Card>
            ))}
          </CardGroup>
        )
      }
    />
  );
}

export function AdminUsersTab() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') ?? '';
  const initialUserId = searchParams?.get('user') ?? '';
  return <AdminUsersTabContent key={`${initialSearch}:${initialUserId}`} initialSearch={initialSearch} initialUserId={initialUserId} />;
}

function AdminUsersTabContent({ initialSearch, initialUserId }: { initialSearch: string; initialUserId: string }) {
  const users = useAdminUsers(initialSearch, initialUserId);

  return <UserHeaderContext.Provider value={users}><UserTableSection roster={users} /></UserHeaderContext.Provider>;
}
