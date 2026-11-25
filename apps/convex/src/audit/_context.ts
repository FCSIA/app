import {
  ADMIN_MODERATION_HREF,
  FLEX_FRIDAY_HREF,
  adminUserHref,
  announcementHref,
  clubChannelHref,
  clubHref,
  eventHref,
} from "../../../shared/routes";
import type { Doc, Id, TableNames } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { auditLabel, auditRecordLabel } from '../../../shared/audit';
import { displayName } from '../../../shared/user-name';

const ENTITY_TABLES: Record<string, TableNames> = {
  user: 'users',
  club: 'clubs',
  clubchannel: 'clubChannels',
  clubchannelmessage: 'clubChannelMessages',
  clubunit: 'clubUnits',
  clubwhiteboard: 'clubWhiteboards',
  clubpeoplegroup: 'clubPeopleGroups',
  clubjoinrequest: 'clubJoinRequests',
  announcement: 'announcements',
  comment: 'comments',
  event: 'events',
  flexfriday: 'flexFridays',
  flexsession: 'flexSessions',
  flexworkshop: 'flexWorkshops',
  flexregistration: 'flexRegistrations',
  flexassignment: 'flexAssignments',
  flexattendance: 'flexAttendances',
  keywordrule: 'moderationKeywordRules',
  report: 'moderationReports',
  studentschedule: 'studentSchedules',
  studentschedulegroup: 'studentScheduleGroups',
  studentfriendsharelink: 'studentFriendShareLinks',
  schooldayblock: 'schoolDayBlocks',
  schooldaytemplate: 'schoolDayTemplates',
  schooldaydateoverride: 'schoolDayDateOverrides',
};
/** The meta field naming the person a row is about, when its record is something else. */
const PERSON_META: Partial<Record<string, string>> = {
  CLUB_MEMBER_ROLE_SET: 'memberId',
  CLUB_MEMBER_REMOVED: 'memberId',
  CLUB_UNIT_MEMBER_SET: 'memberId',
  CLUB_UNIT_MEMBER_REMOVED: 'memberId',
  CLUB_MEMBER_ADDED_DIRECTLY: 'userId',
  'schedule.updated': 'userId',
};
const REFERENCE_TABLES: Record<string, TableNames> = {
  userId: 'users',
  studentId: 'users',
  targetUserId: 'users',
  teacherId: 'users',
  assignedBy: 'users',
  markedById: 'users',
  impersonatedByUserId: 'users',
  requesterId: 'users',
  recipientId: 'users',
  clubId: 'clubs',
  channelId: 'clubChannels',
  workshopId: 'flexWorkshops',
  sessionId: 'flexSessions',
  boardId: 'clubWhiteboards',
  announcementId: 'announcements',
  eventId: 'events',
  unitId: 'clubUnits',
  groupId: 'studentScheduleGroups',
  templateId: 'schoolDayTemplates',
  courseId: 'courses',
};
export function auditMetaRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function recordName(value: Record<string, unknown>): string | null {
  if (typeof value.firstName === 'string') return displayName({
    firstName: value.firstName,
    lastName: typeof value.lastName === 'string' ? value.lastName : undefined,
    preferredName: typeof value.preferredName === 'string' ? value.preferredName : undefined,
  });
  for (const key of ['title', 'name', 'keyword', 'date']) {
    if (typeof value[key] === 'string' && value[key])
      return value[key] as string;
  }
  return null;
}
/** Messages and comments are named by their text, as their own events record it. */
const TEXT_RECORD_TABLES = new Set<TableNames>(['clubChannelMessages', 'comments']);
const TEXT_RECORD_PREVIEW_CHARACTERS = 240;
function recordText(table: TableNames, value: Record<string, unknown>): string | null {
  return TEXT_RECORD_TABLES.has(table) && typeof value.body === 'string' && value.body.trim()
    ? value.body.trim().slice(0, TEXT_RECORD_PREVIEW_CHARACTERS)
    : null;
}
/** A cancellation can recover scope for a signup logged before workshop IDs were saved. */
export async function workshopFromCancellation(ctx: QueryCtx, registrationId: string) {
  // Rows not yet migrated keep the old spelling of the record type.
  for (const entityType of ['FlexRegistration', 'FLEX_REGISTRATION']) {
    const latest = await ctx.db.query('auditEvents')
      .withIndex('by_entityType_and_entityId_and_createdAt', (q) =>
        q.eq('entityType', entityType).eq('entityId', registrationId),
      ).order('desc').first();
    if (latest) return latest.action === 'FLEX_REGISTRATION_REMOVED' ? latest.workshopId : undefined;
  }
  return undefined;
}

/** Per-page memoization keeps repeated people, clubs, and channels to one read. */
export function auditContextResolver(ctx: QueryCtx) {
  const reads = new Map<string, Promise<Record<string, unknown> | null>>();
  const read = (table: TableNames, rawId: string) => {
    const key = `${table}:${rawId}`;
    let result = reads.get(key);
    if (!result) {
      const id = ctx.db.normalizeId(table, rawId);
      result = id
        ? ctx.db
            .get(id as Id<TableNames>)
            .then((doc) => doc as Record<string, unknown> | null)
        : Promise.resolve(null);
      reads.set(key, result);
    }
    return result;
  };
  return async (event: Doc<'auditEvents'>) => {
    const meta = auditMetaRecord(event.meta);
    const type = event.entityType.replace(/[_\s]/g, '').toLowerCase();
    const table = ENTITY_TABLES[type];
    const entity =
      table && event.entityId ? await read(table, event.entityId) : null;
    // A soft-deleted message keeps its row but is no longer a destination.
    // Only a real record ID can be deleted (bulk rows record e.g. "bulk").
    const live = !!entity && !entity.deletedAt;
    const deleted = !live && !!table && !!event.entityId && ctx.db.normalizeId(table, event.entityId) !== null;
    // A sign-in lock names its account by auth user ("auth:<id>"). The person
    // behind it is what an admin reading the lock wants to know.
    const authUserId = type === 'authaccount' && event.entityId?.startsWith('auth:')
      ? event.entityId.slice('auth:'.length) : null;
    const account = authUserId
      ? await ctx.db.query('users').withIndex('by_authUserId', (q) => q.eq('authUserId', authUserId)).first()
      : null;
    // Membership and schedule rows name a club or a schedule, but they are
    // about a person: whose role changed, whose schedule this is.
    const personKey = PERSON_META[event.action];
    const personId = personKey
      ? (typeof meta[personKey] === 'string' ? meta[personKey] : event.action === 'schedule.updated' ? entity?.userId : null)
      : null;
    const subject = typeof personId === 'string' ? await read('users', personId) : null;
    const personDoc = (account ?? (table === 'users' && live ? entity : subject)) as Doc<'users'> | null;
    const person = personDoc ? {
      id: personDoc._id,
      firstName: personDoc.firstName,
      lastName: personDoc.lastName,
      preferredName: personDoc.preferredName,
      uniqueId: personDoc.uniqueId,
      avatarUrl: personDoc.avatarUrl,
    } : null;
    // Historical labels take precedence; current names fill in missing context
    // (e.g. a reaction names the message it was added to).
    const title =
      (account ? displayName(account) : null) ??
      recordName(meta) ??
      (entity ? recordName(entity) : null) ??
      (live && table && entity ? recordText(table, entity) : null) ??
      (table === "moderationReports" && typeof entity?.githubIssueNumber === "number"
        ? `Feedback #${entity.githubIssueNumber}` : auditRecordLabel(event.entityType));
    const recoveredWorkshopId = !event.workshopId && !entity &&
      event.action === 'FLEX_WORKSHOP_REGISTERED' && event.entityId
      ? await workshopFromCancellation(ctx, event.entityId)
      : undefined;
    const references = (
      await Promise.all(
        Object.entries(REFERENCE_TABLES).map(async ([key, refTable]) => {
          const workshop = key === 'workshopId';
          const id = (workshop ? event.workshopId ?? recoveredWorkshopId : undefined) ?? meta[key] ??
            (key === 'impersonatedByUserId' ? event.impersonatedByUserId : undefined) ?? entity?.[key];
          if (typeof id !== 'string') return null;
          const snapshot = workshop && typeof meta.workshopTitle === 'string' ? meta.workshopTitle : null;
          const doc = snapshot ? null : await read(refTable, id);
          const name = snapshot || (doc ? recordName(doc) : null);
          return name
            ? { id, label: auditLabel(key.replace(/Id$/, '')), name }
            : null;
        }),
      )
    ).filter(
      (ref): ref is { id: string; label: string; name: string } => ref !== null,
    );
    const contextNames = references.filter((ref) =>
      ['Club', 'Channel', 'Student', 'Workshop'].includes(ref.label),
    );
    const subtitle =
      contextNames
        .map((ref) => (ref.label === 'Channel' ? `#${ref.name}` : ref.name))
        .join(' · ') || null;
    const clubId = typeof meta.clubId === 'string' ? meta.clubId : typeof entity?.clubId === 'string' ? entity.clubId : null;
    const channelId = typeof meta.channelId === 'string' ? meta.channelId : typeof entity?.channelId === 'string' ? entity.channelId : null;
    const href = (targetTable: TableNames | undefined, id: string): string | null => {
      if (targetTable === 'users') return adminUserHref(id);
      if (targetTable === 'clubs') return clubHref(id);
      if (targetTable === 'clubChannels' && clubId) return clubChannelHref(clubId, id);
      if (targetTable === 'clubChannelMessages' && clubId && channelId) return clubChannelHref(clubId, channelId, { messageId: id });
      if (targetTable === 'clubWhiteboards' && clubId && channelId) return clubChannelHref(clubId, channelId, { whiteboardId: id });
      if (targetTable === 'announcements') return announcementHref(id);
      if (targetTable === 'comments' && typeof (meta.announcementId ?? entity?.announcementId) === 'string') return announcementHref(String(meta.announcementId ?? entity?.announcementId));
      if (targetTable === 'events') return eventHref(id);
      if (targetTable?.startsWith('flex')) return FLEX_FRIDAY_HREF;
      if (targetTable === 'moderationReports' || targetTable === 'moderationKeywordRules') return ADMIN_MODERATION_HREF;
      if (targetTable?.startsWith('club') && clubId) return clubHref(clubId);
      return null;
    };
    // A role by the name it had then (rows that predate the snapshot use its current name).
    const role = typeof meta.roleId === 'string'
      ? { id: meta.roleId, name: typeof meta.roleName === 'string' ? meta.roleName : recordName((await read('clubRoles', meta.roleId)) ?? {}) }
      : null;
    const links = [
      ...(event.entityId ? [{ id: event.entityId, label: 'Record', name: title, href: account ? adminUserHref(account._id) : live ? href(table, event.entityId) : null }] : []),
      ...references.map((ref) => ({ ...ref, href: href(REFERENCE_TABLES[Object.keys(REFERENCE_TABLES).find((key) => auditLabel(key.replace(/Id$/, '')) === ref.label) ?? ''], ref.id) })),
      ...(role?.name ? [{ id: role.id, label: 'Role', name: role.name, href: null }] : []),
    ];
    return { title, subtitle, references, links, deleted, ...(person ? { person } : {}) };
  };
}
