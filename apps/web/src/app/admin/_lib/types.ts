import type { FunctionReturnType } from 'convex/server';
import type { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

export type StudentImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  generatedCredentials: Array<{
    firstName: string;
    lastName: string;
    uniqueId: string;
    email: string;
    temporaryPassword: string;
  }>;
};

export type AdministratorImportResult = StudentImportResult;

export type StudentBulkUpdateResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

export type AuditActorScope = 'ALL' | 'USER' | 'SYSTEM';

export type AuditEventRecord = {
  client?: "cli";
  source?: "system";
  impersonatedByUserId?: Id<"users">;
  workshopId?: Id<"flexWorkshops">;
  actorId?: string | null;
  context?: { title: string; subtitle: string | null; references: Array<{ id: string; label: string; name: string }>; links?: Array<{ id: string; label: string; name: string; href: string | null }>; deleted?: boolean; person?: { id: Id<'users'>; firstName: string; lastName: string; preferredName?: string; uniqueId: string; avatarUrl?: string } } | null;
  id: Id<"auditEvents">;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  meta?: Record<string, unknown> | null;
  actor?: {
    id: Id<'users'>;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    uniqueId: string;
    avatarUrl?: string;
  } | null;
};

export type AuditEventDetail = AuditEventRecord & {
  entityPreview?: {
    kind: string;
    title: string;
    subtitle?: string | null;
    body?: string | null;
    href?: string | null;
    hrefLabel?: string | null;
    fields?: Array<{
      label: string;
      value: string;
    }>;
  } | null;
};

export type AdminUserRecord = {
  _id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  roles?: string[];
  gradeLevel?: number | null;
  major?: string | null;
  minor?: string | null;
  email?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isDeveloper?: boolean;
} & Pick<FunctionReturnType<typeof api.users.admin.list>['page'][number], 'roster'>;
