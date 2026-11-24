'use client';

import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseUserSearch, USER_FILTER_KEYS, USER_FILTERS, type UserFilter, type UserFilters } from '~/apps/shared/admin-user-filters';
import { schoolYearStart } from '~/apps/shared/school-time';
import { useMutation, useQuery } from '@/lib/convex-react';
import { useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { USER_ROLE_GROUP_META } from '../_lib/admin-utils';
import type { AdminUserRecord, AdminUserRoleGroup } from '../_lib/types';
import {
  type AppRole,
  canManageUser,
  hasAnyRole,
  SUPER_ADMIN_ROLES,
} from '~/apps/shared/roles';

const USERS_PAGE_SIZE = 30;

type UsersPage = {
  page: AdminUserRecord[];
  isDone: boolean;
  continueCursor: string;
};

type UsersPageStatus = 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';

type DisplayedUsersPageState = {
  viewerId: string | undefined;
  search: string;
  userRoleGroup: AdminUserRoleGroup;
  pageSize: number;
  pageIndex: number;
  page: UsersPage | undefined;
};

export function useAdminUsers(initialSearch = '', initialUserId = '') {
  const user = useCurrentUser();
  const { toast } = useToast();

  const params = useSearchParams();
  const initialQuery = initialUserId || params?.get('users_q') || initialSearch;
  const [search, setDraft] = useState(initialQuery);
  const [appliedSearch, setAppliedSearch] = useState(() => parseUserSearch(initialQuery).error ? '' : initialQuery);
  const [filters, setFilters] = useState<UserFilters>(() => initialUserId ? {} : Object.fromEntries(
    USER_FILTER_KEYS.flatMap((key) => {
      const values = (params?.get(`users_${key}`) ?? '').split(',');
      const available = USER_FILTERS[key].options.filter((option) => values.includes(option.value)).map((option) => option.value);
      return available.length ? [[key, available]] : [];
    }),
  ));
  const deferredSearch = useDeferredValue(appliedSearch);
  const searchError = parseUserSearch(search).error;
  const parsed = parseUserSearch(deferredSearch);
  const plainSearch = parsed.terms.length > 0 && parsed.terms.every((term) => term.field === 'text' && !term.exclude && !/\s/.test(term.value)) && !deferredSearch.includes('"');
  const hasFilters = USER_FILTER_KEYS.some((key) => !!filters[key]?.length);
  const [schoolYear] = useState(() => schoolYearStart(new Date()));
  const exactUserId = initialUserId && deferredSearch === initialUserId ? initialUserId : undefined;
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>(() => {
    if (initialUserId) return 'all';
    const group = params?.get('users_group');
    return group && Object.hasOwn(USER_ROLE_GROUP_META, group) ? group as AdminUserRoleGroup : 'students';
  });
  const [isUserMutationPending, setIsUserMutationPending] = useState(false);
  const [pageSize, setPageSize] = useState(USERS_PAGE_SIZE);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
  const [displayedPageState, setDisplayedPageState] = useState<DisplayedUsersPageState>({
    viewerId: user?._id,
    search: deferredSearch,
    userRoleGroup,
    pageSize,
    pageIndex: 0,
    page: undefined,
  });
  const requestedPageIndex = previousCursors.length;

  const canManage = (targetUser: AdminUserRecord) => canManageUser(user, targetUser);

  const usersPage = useQuery(api.users.admin.list, {
    search: plainSearch && !hasFilters ? deferredSearch.trim() : undefined,
    roster: {
      schoolYear,
      filters,
      search: plainSearch && !hasFilters ? undefined : deferredSearch.trim() || undefined,
    },
    userId: exactUserId,
    roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup,
    paginationOpts: {
      numItems: pageSize,
      cursor: currentCursor,
    },
  });

  const pageScopeChanged =
    displayedPageState.viewerId !== user?._id ||
    displayedPageState.userRoleGroup !== userRoleGroup ||
    displayedPageState.pageSize !== pageSize;
  const searchChanged = displayedPageState.search !== deferredSearch;
  const displayedPage = usersPage ?? (pageScopeChanged ? undefined : displayedPageState.page);
  const pageIndex = usersPage
    ? requestedPageIndex
    : pageScopeChanged || searchChanged ? 0 : displayedPageState.pageIndex;

  if (
    pageScopeChanged ||
    searchChanged ||
    (usersPage && (displayedPageState.page !== usersPage || displayedPageState.pageIndex !== pageIndex))
  ) {
    setDisplayedPageState({
      viewerId: user?._id,
      search: deferredSearch,
      userRoleGroup,
      pageSize,
      pageIndex,
      page: displayedPage,
    });
  }

  // Actual total count for the selected role group (shown in the header badge).
  const totalCount = useQuery(
    api.users.admin.count,
    exactUserId || hasFilters || !!deferredSearch.trim() ? 'skip' : { roleGroup: userRoleGroup === 'all' ? undefined : userRoleGroup },
  );

  const deactivateUser = useMutation(api.users.admin.deactivate);
  const activateUser = useMutation(api.users.admin.activate);
  const assignRoles = useMutation(api.users.admin.assignRoles);
  const resetPassword = useMutation(api.users.admin.resetPassword);
  const deleteUsers = useMutation(api.users.admin.deleteUsers);
  const setDeveloper = useMutation(api.users.admin.setDeveloper);

  const runUserMutation = async <T, TResult = boolean>(
    action: () => Promise<T>,
    successTitle: string,
    successDescription?: (result: T) => string,
    resultMapper?: (result: T) => TResult,
  ) => {
    try {
      setIsUserMutationPending(true);
      const result = await action();
      toast({ title: successTitle, description: successDescription?.(result) });
      return (resultMapper ? resultMapper(result) : true) as TResult;
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Request failed',
        variant: 'destructive',
      });
      return undefined;
    } finally {
      setIsUserMutationPending(false);
    }
  };

  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const isSuperAdmin = hasAnyRole(user, SUPER_ADMIN_ROLES);
  const status: UsersPageStatus = usersPage
    ? usersPage.isDone ? 'Exhausted' : 'CanLoadMore'
    : displayedPage ? 'LoadingMore' : 'LoadingFirstPage';
  const isSearchPending = appliedSearch !== deferredSearch;
  const pendingPageDirection: 'next' | 'previous' | null =
    status !== 'LoadingMore' || isSearchPending || pageIndex === requestedPageIndex
      ? null
      : requestedPageIndex > pageIndex ? 'next' : 'previous';

  const resetPage = () => {
    setCurrentCursor(null);
    setPreviousCursors([]);
  };

  const saveQuery = (query: string, nextFilters: UserFilters, group = userRoleGroup) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('user');
    url.searchParams.delete('search');
    if (group === 'students') url.searchParams.delete('users_group');
    else url.searchParams.set('users_group', group);
    if (query) url.searchParams.set('users_q', query);
    else url.searchParams.delete('users_q');
    for (const key of USER_FILTER_KEYS) {
      const values = nextFilters[key];
      if (values?.length) url.searchParams.set(`users_${key}`, values.join(','));
      else url.searchParams.delete(`users_${key}`);
    }
    window.history.replaceState(null, '', url);
  };

  return {
    search,
    searchError,
    filters,
    hasFilters,
    schoolYear,
    isFiltered: !!appliedSearch.trim() || hasFilters,
    selectionScope: JSON.stringify([appliedSearch, filters]),
    setSearch: (value: string) => {
      setDraft(value);
      const result = parseUserSearch(value);
      if (result.error) return;
      const next = { ...filters };
      for (const term of result.terms) {
        if (term.field !== 'text' && term.field !== 'name' && term.field !== 'email' && term.field !== 'id') {
          delete next[term.field];
        }
      }
      setFilters(next);
      setAppliedSearch(value);
      saveQuery(value, next);
      resetPage();
    },
    setFilter: (key: UserFilter, values: string[]) => {
      const next = { ...filters };
      if (values.length) next[key] = values;
      else delete next[key];
      const terms = parseUserSearch(exactUserId ? '' : appliedSearch).terms;
      const query = terms.some((term) => term.field === key) || exactUserId
        ? terms.filter((term) => term.field !== key)
            .map((term) => `${term.exclude ? '-' : ''}${term.field === 'text' ? '' : term.field + ':'}${JSON.stringify(term.value)}`).join(' ')
        : appliedSearch;
      setAppliedSearch(query);
      setDraft(query);
      setFilters(next);
      saveQuery(query, next);
      resetPage();
    },
    clearFilters: () => {
      setAppliedSearch('');
      setDraft('');
      setFilters({});
      saveQuery('', {});
      resetPage();
    },
    userRoleGroup,
    setUserRoleGroup: (value: AdminUserRoleGroup) => {
      if (exactUserId) {
        setAppliedSearch('');
        setDraft('');
      }
      saveQuery(exactUserId ? '' : appliedSearch, filters, value);
      setUserRoleGroup(value);
      resetPage();
    },
    users: displayedPage?.page ?? [],
    totalCount: exactUserId ? usersPage?.page.length : totalCount ?? undefined,
    status,
    canLoadPrevious: pageIndex > 0,
    pageIndex,
    pageSize,
    setPageSize: (size: number) => {
      if (size === pageSize) return;
      setPageSize(size);
      setCurrentCursor(null);
      setPreviousCursors([]);
    },
    pendingPageDirection,
    isSearchPending,
    loadNextPage: () => {
      if (!displayedPage || displayedPage.isDone || !usersPage) return;
      setPreviousCursors((cursors) => [...cursors, currentCursor]);
      setCurrentCursor(displayedPage.continueCursor);
    },
    loadPreviousPage: () => {
      if (previousCursors.length === 0) return;
      setCurrentCursor(previousCursors[previousCursors.length - 1] ?? null);
      setPreviousCursors((cursors) => cursors.slice(0, -1));
    },
    isUsersLoading: !displayedPage && !usersPage,
    selectedUserRoleMeta,
    currentUserId: user?._id,
    canManage,
    canDeleteUsers: isSuperAdmin,
    onDeactivate: (userId: string) =>
      void runUserMutation(
        () => deactivateUser({ userId: userId as Id<'users'> }),
        'Deactivated',
      ),
    onActivate: (userId: string) =>
      void runUserMutation(
        () => activateUser({ userId: userId as Id<'users'> }),
        'Activated',
      ),
    onResetPassword: async (targetUser: AdminUserRecord) => {
      return await runUserMutation(
        () => resetPassword({ userId: targetUser._id as Id<'users'> }),
        'Temporary password generated',
        undefined,
        (result) => result.temporaryPassword,
      );
    },
    onDeleteUsers: async (userIds: string[]) =>
      await runUserMutation(
        () => deleteUsers({ userIds: userIds as Id<'users'>[] }),
        `Deleted ${userIds.length} ${userIds.length === 1 ? 'user' : 'users'}`,
        (result) => `${result.deleted} account${result.deleted === 1 ? '' : 's'} permanently removed.`,
      ),
    isDeleteUsersPending: isUserMutationPending,
    isResetPasswordPending: isUserMutationPending,
    isSuperAdmin,
    isSetDeveloperPending: isUserMutationPending,
    onSetDeveloper: (payload: { _id: string; enabled: boolean }) =>
      void runUserMutation(
        () => setDeveloper({ userId: payload._id as Id<'users'>, enabled: payload.enabled }),
        payload.enabled ? 'Developer badge granted' : 'Developer badge removed',
      ),
    isAssignRolesPending: isUserMutationPending,
    onAssignRoles: (payload: { _id: string; roles: string[] }) =>
      void runUserMutation(
        () =>
          assignRoles({
            userId: payload._id as Id<'users'>,
            roles: payload.roles as AppRole[],
          }),
        'Permissions updated',
      ),
  };
}
