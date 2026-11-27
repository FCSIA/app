// Data stub: the real module's helpers, with hooks answered from the fixture.
import { useMemo, useState } from 'react';
import { getFunctionName } from 'convex/server';
export * from 'REAL_CONVEX_REACT';
const fx = () => (window as any).__fixture;
const answers: Record<string, (args: any) => unknown> = {
  'audit/events:counts': () => ({ total: fx().events.length, exact: true }),
  'audit/events:listFilterOptions': () => fx().filterOptions,
  'audit/events:get': (a) => fx().events.find((e: any) => e.id === a?.auditEventId) ?? null,
  'notifications/inbox:unreadCount': () => 0,
  'users/admin:list': (a) => fx().usersList(a),
  'users/admin:count': () => fx().usersCount,
};
// Convex hands back the same object until the data changes; so does the stub,
// or effects keyed on a query result re-run every render.
const cache = new Map<string, unknown>();
function answer(ref: any, args: any) {
  if (args === 'skip') return undefined;
  const name = getFunctionName(ref);
  const key = name + JSON.stringify(args ?? {});
  if (cache.has(key)) return cache.get(key);
  const value = compute(name, args); cache.set(key, value); return value;
}
function compute(name: string, args: any) {
  if (name in answers) return answers[name](args);
  (window as any).__unanswered ??= new Set(); (window as any).__unanswered.add(name);
  return fx().defaults?.[name];
}
export function useQuery(ref: any, args?: any) { return answer(ref, args); }
function paged(ref: any, args: any, options: any) {
  const name = getFunctionName(ref);
  // Stable per filter, as Convex's results are: a new array each render
  // re-runs every effect keyed on the rows.
  const all: any[] = useMemo(() => (name === 'audit/events:listFilteredPage' ? fx().filter(args) : []), [name, JSON.stringify(args)]);
  const [n, setN] = useState(options?.initialNumItems ?? 50);
  return useMemo(() => ({
    results: all.slice(0, n), status: n >= all.length ? 'Exhausted' : 'CanLoadMore', isLoading: false, isStale: false,
    loadMore: (k: number) => setN((x: number) => x + k),
  }), [all, n]);
}
export function usePaginatedQuery(ref: any, args: any, options: any) { return paged(ref, args, options); }
export function useStreamPaginatedQuery(ref: any, args: any, options: any) { return paged(ref, args, options); }
export const useMutation = () => Object.assign(async () => null, { withOptimisticUpdate: () => async () => null });
export const useAction = () => async () => null;
export const useConvexAuth = () => ({ isAuthenticated: true, isLoading: false });
export const useConvex = () => ({ query: async () => null, mutation: async () => null, action: async () => null, watchQuery: () => ({ onUpdate: () => () => {}, localQueryResult: () => undefined }) });
export function useKeepAliveQueries() {}
