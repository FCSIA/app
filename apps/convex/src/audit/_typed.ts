import { AUDIT_ACTIONS, auditRecordType, type AuditAction } from '../../../shared/audit';
import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { AUDIT_EVENT_SPECS, AUDIT_MESSAGE_PREVIEW_CHARACTERS } from './_spec';

const MESSAGE_ACTIONS = new Set<string>([
  'CLUB_CHANNEL_MESSAGE_POSTED',
  'CLUB_CHANNEL_MESSAGE_UPDATED',
  'CLUB_CHANNEL_MESSAGE_DELETED',
]);
const ROLE_ACTIONS = new Set<string>([
  'CLUB_MEMBER_ROLE_SET',
  'CLUB_ROLE_PERMISSIONS_UPDATED',
  'CLUB_ROLE_DIRECTORY_VISIBILITY_UPDATED',
  'CLUB_ROLE_REMOVED',
]);

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type TypedAuditLookups = {
  /** Who owns the schedule a `schedule.updated` row names. */
  scheduleOwner?: Id<'users'> | null;
  /** The name of the club role a role row names, as it was. */
  roleName?: string | null;
};

/**
 * The changes that bring one stored audit row to the typed shape in
 * AUDIT_EVENT_SPECS, or null when it already has it. Pure, so the migration,
 * its tests and a dry run over exported rows share it.
 */
export function typedAuditPatch(row: Doc<'auditEvents'>, lookups: TypedAuditLookups = {}) {
  const known = row.action in AUDIT_ACTIONS ? (row.action as AuditAction) : null;
  const entityType = known ? AUDIT_EVENT_SPECS[known].recordType : auditRecordType(row.entityType) ?? row.entityType;
  const category = known ? AUDIT_ACTIONS[known].category : row.category;
  const original = record(row.meta);
  const { auditSource, impersonatedByUserId, originalMeta: _originalMeta, ...meta } = original;
  if (row.action === 'schedule.updated' && meta.userId === undefined && lookups.scheduleOwner) meta.userId = lookups.scheduleOwner;
  // Message rows written before previews stored the whole text; their counts
  // follow from it exactly.
  if (MESSAGE_ACTIONS.has(row.action)) {
    const text = (key: string) => (typeof meta[key] === 'string' ? meta[key] as string : null);
    const body = text('body');
    if (body !== null) {
      meta.bodyPreview ??= body.slice(0, AUDIT_MESSAGE_PREVIEW_CHARACTERS);
      meta.bodyLength ??= body.length;
      meta.markdownLength ??= text('bodyMarkdown')?.length ?? 0;
    }
    const previous = text('previousBody');
    if (row.action === 'CLUB_CHANNEL_MESSAGE_UPDATED' && previous !== null) {
      meta.previousBodyPreview ??= previous.slice(0, AUDIT_MESSAGE_PREVIEW_CHARACTERS);
      meta.previousBodyLength ??= previous.length;
      meta.previousMarkdownLength ??= text('previousBodyMarkdown')?.length ?? 0;
    }
  }
  if (ROLE_ACTIONS.has(row.action) && meta.roleName === undefined && lookups.roleName) meta.roleName = lookups.roleName;

  const patch: Partial<Pick<Doc<'auditEvents'>, 'entityType' | 'category' | 'meta' | 'source' | 'impersonatedByUserId'>> = {};
  if (entityType !== row.entityType) patch.entityType = entityType;
  if (category !== row.category) patch.category = category;
  if (auditSource === 'system' && row.source !== 'system') patch.source = 'system';
  if (typeof impersonatedByUserId === 'string' && !row.impersonatedByUserId)
    patch.impersonatedByUserId = impersonatedByUserId as Id<'users'>;
  const keys = (value: Record<string, unknown>) => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  if (row.meta !== undefined && keys(meta) !== keys(original)) patch.meta = meta;
  return Object.keys(patch).length ? patch : null;
}

/** Reads what typedAuditPatch needs that the row itself doesn't hold. */
export async function typedAuditLookups(ctx: QueryCtx, row: Doc<'auditEvents'>): Promise<TypedAuditLookups> {
  const meta = record(row.meta);
  if (row.action === 'schedule.updated' && meta.userId === undefined && row.entityId) {
    const id = ctx.db.normalizeId('studentSchedules', row.entityId);
    const schedule = id ? await ctx.db.get(id) : null;
    return { scheduleOwner: schedule?.userId ?? null };
  }
  if (ROLE_ACTIONS.has(row.action) && meta.roleName === undefined && typeof meta.roleId === 'string') {
    return { roleName: await roleNameAt(ctx, meta.roleId, row.createdAt) };
  }
  return {};
}

/**
 * A role's name when an event happened: the latest rename (or its creation)
 * logged at or before it, else the role's current name. Removed roles keep
 * their names this way.
 */
async function roleNameAt(ctx: QueryCtx, rawRoleId: string, at: number) {
  for (const action of ['CLUB_ROLE_RENAMED', 'CLUB_ROLE_CREATED'] as const) {
    const named = await ctx.db.query('auditEvents')
      .withIndex('by_action_and_createdAt', (q) => q.eq('action', action).lte('createdAt', at))
      .order('desc')
      .filter((q) => q.eq(q.field('meta.roleId'), rawRoleId))
      .first();
    const name = record(named?.meta).name;
    if (typeof name === 'string') return name;
  }
  const id = ctx.db.normalizeId('clubRoles', rawRoleId);
  const role = id ? await ctx.db.get(id) : null;
  return role?.name ?? null;
}
