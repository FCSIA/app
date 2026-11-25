import { isAdmin, isStaff, isSuperAdmin } from '~/apps/shared/roles';
import {
  ChartLine,
  ContactRound,
  FileText,
  MessageSquareText,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';

/** What the signed-in account may open in the admin workspace. */
export type AdminAccess = {
  isSuperAdmin: boolean;
  canManageWrapped: boolean;
  canReviewFeedback: boolean;
  hasStaffAccess: boolean;
};

type AdminSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  canSee: (access: AdminAccess) => boolean;
};

const staffOnly = ({ hasStaffAccess }: AdminAccess) => hasStaffAccess;
const superAdminOnly = ({ isSuperAdmin }: AdminAccess) => isSuperAdmin;

/**
 * Each administration destination, who may open it, and its sidebar order.
 * The main navigation and the `/admin/<section>` page both read this list, so
 * each route uses the same label and permission as its navigation link.
 */
const ADMIN_SECTIONS = [
  { id: 'users', label: 'Users', icon: Users, canSee: staffOnly },
  { id: 'schedule', label: 'Student roster', icon: ContactRound, canSee: superAdminOnly },
  { id: 'administrator-roster', label: 'Admin roster', icon: ShieldCheck, canSee: superAdminOnly },
  { id: 'moderation', label: 'Reports', icon: MessageSquareWarning, canSee: staffOnly },
  { id: 'feedback', label: 'Feedback', icon: MessageSquareText, canSee: ({ canReviewFeedback }) => canReviewFeedback },
  { id: 'wrapped', label: 'Wrapped', icon: Sparkles, canSee: ({ canManageWrapped }) => canManageWrapped },
  { id: 'analytics', label: 'Analytics', icon: ChartLine, canSee: superAdminOnly },
  { id: 'audit', label: 'Audit log', icon: FileText, canSee: staffOnly },
] as const satisfies readonly AdminSection[];

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]['id'];

/** Old tab names that still arrive from notifications and bookmarks. */
const LEGACY_SECTION_IDS: ReadonlyMap<string, AdminSectionId> = new Map([
  ['permissions', 'users'],
  ['student-admins', 'users'],
  ['reports', 'moderation'],
]);

export function adminAccessFor(
  user: { roles?: readonly string[] | null; canReviewFeedback?: boolean } | null | undefined,
): AdminAccess {
  const superAdmin = isSuperAdmin(user);
  return {
    isSuperAdmin: superAdmin,
    canManageWrapped: isAdmin(user),
    canReviewFeedback: superAdmin || user?.canReviewFeedback === true,
    hasStaffAccess: isStaff(user),
  };
}

export function visibleAdminSections(access: AdminAccess) {
  return ADMIN_SECTIONS.filter((section) => section.canSee(access));
}

/** The requested page if the account may open it, otherwise its first page. */
export function resolveAdminSection(
  requested: string | null,
  access: AdminAccess,
): AdminSectionId | null {
  const visible = visibleAdminSections(access);
  const wanted = requested ? LEGACY_SECTION_IDS.get(requested) ?? requested : null;
  return visible.find((section) => section.id === wanted)?.id ?? visible[0]?.id ?? null;
}

export function adminSectionHref(section: AdminSectionId, params?: URLSearchParams) {
  const query = params?.toString();
  return `/admin/${section}${query ? `?${query}` : ''}`;
}
