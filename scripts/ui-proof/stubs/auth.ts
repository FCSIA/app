export const SUPER_ADMIN = { _id: 'u_admin', firstName: 'Super', lastName: 'Admin', uniqueId: '100000001', roles: ['SUPER_ADMIN'], email: 'admin@example.org', canReviewFeedback: true, isActive: true };
export const useCurrentUser = () => SUPER_ADMIN as any;
export const startLogout = () => {}; export const clearAuth = () => {};
export type AppUser = any;
export const isSuperAdmin = (user: any) => !!user?.roles?.includes('SUPER_ADMIN');
export type CachedDisplayUser = any;
export const getUser = () => SUPER_ADMIN as any; export const cacheUser = (_: any) => {};
export const hasRole = (user: any, ...roles: string[]) => roles.some((r) => user?.roles?.includes(r));
export const isAdmin = (user: any) => hasRole(user, 'ADMIN', 'SUPER_ADMIN');
