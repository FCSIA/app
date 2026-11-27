// Router stub: the URL is the state, as in the app. Pages re-render on change.
import { useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); window.addEventListener('popstate', l); return () => { listeners.delete(l); window.removeEventListener('popstate', l); }; };
const go = (url: string, replace = false) => { const u = new URL(url, location.href); history[replace ? 'replaceState' : 'pushState'](null, '', u.pathname.startsWith('/admin') ? u.pathname + u.search : location.pathname + location.search); notify(); };
const router = { push: (u: string) => go(u), replace: (u: string) => go(u, true), prefetch() {}, back() {}, forward() {}, refresh() {} };
export const useRouter = () => router;
export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
export function useSearchParams() { const s = useSyncExternalStore(subscribe, () => location.search); return new URLSearchParams(s) as any; }
export const useParams = () => ({ section: location.pathname.split('/')[2] });
export const useSelectedLayoutSegment = () => null;
export const useSelectedLayoutSegments = () => [];
export const redirect = () => {}; export const notFound = () => {};
export const ReadonlyURLSearchParams = URLSearchParams;
