import { v, type GenericValidator, type ObjectType, type PropertyValidators } from 'convex/values';
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  type AuditAction,
  type AuditCategory,
  type AuditRecordType,
  type WritableAuditAction,
} from '../../../shared/audit';
import {
  appRoleValidator,
  clubChannelReactionValidator,
  clubRolePermissionValidator,
  feedbackStatusValidator,
  friendShareLinkModeValidator,
  scheduleLunchPeriodValidator,
  scheduleWeekdayValidator,
  schoolDayTemplateKindValidator,
} from '../validators';

/**
 * What every audit action records: the one kind of record it names and the
 * shape of its `meta`. This is the single source the table's staged
 * validator, `logAuditEvent`'s argument types and the 2026-11 migration are
 * built from, so a writer can't log a field (or a record type) the schema
 * doesn't know.
 *
 * Fields optional here are ones older rows lack; new writes set them.
 */
/** How much of a message an audit row keeps. */
export const AUDIT_MESSAGE_PREVIEW_CHARACTERS = 240;

const spec = <R extends AuditRecordType, M extends PropertyValidators>(recordType: R, meta: M) => ({ recordType, meta });
const none = {} as const;

const message = {
  clubId: v.id('clubs'),
  channelId: v.id('clubChannels'),
  parentMessageId: v.union(v.id('clubChannelMessages'), v.null()),
  replyToMessageId: v.union(v.id('clubChannelMessages'), v.null()),
  bodyPreview: v.string(),
  bodyLength: v.number(),
  markdownLength: v.number(),
  attachmentCount: v.number(),
  hasPoll: v.boolean(),
};
const reaction = {
  clubId: v.id('clubs'),
  channelId: v.id('clubChannels'),
  emoji: clubChannelReactionValidator,
  removedReactionCount: v.number(),
};
const whiteboard = {
  clubId: v.id('clubs'),
  channelId: v.id('clubChannels'),
  boardId: v.id('clubWhiteboards'),
  title: v.string(),
};
const whiteboardEdit = {
  ...whiteboard,
  fromSeq: v.number(),
  toSeq: v.number(),
  saveCount: v.number(),
  changeCount: v.number(),
  created: v.number(),
  updated: v.number(),
  deleted: v.number(),
  restored: v.number(),
  changes: v.array(v.object({
    elementId: v.string(),
    type: v.string(),
    change: v.union(v.literal('created'), v.literal('updated'), v.literal('deleted'), v.literal('restored')),
    textPreview: v.optional(v.string()),
  })),
  omittedChangeCount: v.number(),
  lastSavedAt: v.number(),
  restoredToSeq: v.optional(v.number()),
};
/** A club role, named as it was when the event happened (roles get renamed and removed). */
const role = { roleId: v.id('clubRoles'), roleName: v.optional(v.string()) };
const unit = { clubId: v.id('clubs') };
const csvImport = { created: v.number(), skipped: v.number(), generatedPasswords: v.boolean() };
const templateDay = { name: v.string(), kind: schoolDayTemplateKindValidator, blockCount: v.number() };
const overrideDay = { dateKey: v.string(), name: v.string(), blockCount: v.number() };
const block = { weekday: scheduleWeekdayValidator, label: v.string() };
const linkedTemplate = { dateKey: v.string(), templateId: v.id('schoolDayTemplates') };

export const AUDIT_EVENT_SPECS = {
  ADMINISTRATOR_CSV_IMPORT: spec('User', csvImport),
  ANNOUNCEMENT_APPROVED: spec('Announcement', none),
  ANNOUNCEMENT_ARCHIVED: spec('Announcement', none),
  ANNOUNCEMENT_COMMENT_ADDED: spec('Comment', { announcementId: v.optional(v.id('announcements')), title: v.optional(v.string()) }),
  ANNOUNCEMENT_COMMENT_DELETED: spec('Comment', { announcementId: v.id('announcements'), title: v.optional(v.string()) }),
  ANNOUNCEMENT_CREATED: spec('Announcement', { title: v.string(), imageCount: v.optional(v.number()), embedCount: v.optional(v.number()) }),
  ANNOUNCEMENT_READ: spec('Announcement', none),
  ANNOUNCEMENT_REJECTED: spec('Announcement', none),
  ANNOUNCEMENT_UNREAD: spec('Announcement', none),
  AUTO_MODERATION_FLAGGED: spec('Report', { contentType: v.string(), contentId: v.string(), matchedWords: v.array(v.string()) }),
  CLUB_BULK_STRUCTURE_ASSIGNMENTS_APPLIED: spec('Club', { clubId: v.id('clubs'), assignedUnits: v.number(), assignedRoles: v.number(), skippedRoles: v.number(), removed: v.number(), createdRoles: v.number() }),
  CLUB_CHANNEL_CREATED: spec('ClubChannel', none),
  CLUB_CHANNEL_MESSAGE_DELETED: spec('ClubChannelMessage', message),
  CLUB_CHANNEL_MESSAGE_PINNED: spec('ClubChannelMessage', none),
  CLUB_CHANNEL_MESSAGE_POSTED: spec('ClubChannelMessage', message),
  CLUB_CHANNEL_MESSAGE_REACTION_ADDED: spec('ClubChannelMessage', reaction),
  CLUB_CHANNEL_MESSAGE_REACTION_REMOVED: spec('ClubChannelMessage', reaction),
  CLUB_CHANNEL_MESSAGE_UNPINNED: spec('ClubChannelMessage', none),
  CLUB_CHANNEL_MESSAGE_UPDATED: spec('ClubChannelMessage', {
    ...message,
    previousBodyPreview: v.string(),
    previousBodyLength: v.number(),
    previousMarkdownLength: v.number(),
  }),
  CLUB_CHANNEL_WHITEBOARDS_DISABLED: spec('ClubChannel', { clubId: v.id('clubs'), channelId: v.id('clubChannels'), channelName: v.string(), enabled: v.boolean() }),
  CLUB_CHANNEL_WHITEBOARDS_ENABLED: spec('ClubChannel', { clubId: v.id('clubs'), channelId: v.id('clubChannels'), channelName: v.string(), enabled: v.boolean() }),
  CLUB_CREATED: spec('Club', none),
  CLUB_DEACTIVATED: spec('Club', none),
  CLUB_DELETED: spec('Club', { name: v.string() }),
  CLUB_DELETION_STARTED: spec('Club', { name: v.string() }),
  CLUB_INVITES_BULK_IMPORTED: spec('Club', { invited: v.number(), skipped: v.number() }),
  CLUB_JOINED: spec('Club', { userId: v.id('users') }),
  CLUB_JOIN_CODE_GENERATED: spec('Club', none),
  CLUB_JOIN_CODE_REDEEMED: spec('Club', none),
  CLUB_JOIN_CODE_REVOKED: spec('Club', none),
  CLUB_JOIN_REQUEST_APPROVED: spec('ClubJoinRequest', none),
  CLUB_JOIN_REQUEST_DECLINED: spec('ClubJoinRequest', none),
  CLUB_MEMBERS_BULK_ADDED_DIRECTLY: spec('Club', { added: v.number(), alreadyMember: v.number(), skipped: v.number() }),
  CLUB_MEMBER_ADDED_DIRECTLY: spec('Club', { userId: v.id('users') }),
  /** `memberId` is the member's user ID. */
  CLUB_MEMBER_REMOVED: spec('Club', { memberId: v.id('users') }),
  CLUB_MEMBER_ROLES_BULK_SET: spec('Club', none),
  CLUB_MEMBER_ROLE_SET: spec('Club', { memberId: v.id('users'), ...role }),
  CLUB_PEOPLE_GROUP_CREATED: spec('ClubPeopleGroup', { clubId: v.id('clubs'), ruleCount: v.number() }),
  CLUB_PEOPLE_GROUP_DELETED: spec('ClubPeopleGroup', { clubId: v.id('clubs'), name: v.string() }),
  CLUB_PEOPLE_GROUP_UPDATED: spec('ClubPeopleGroup', { clubId: v.id('clubs'), ruleCount: v.number() }),
  CLUB_ROLE_CREATED: spec('Club', { roleId: v.id('clubRoles'), name: v.string() }),
  CLUB_ROLE_DIRECTORY_VISIBILITY_UPDATED: spec('Club', { ...role, showInDirectory: v.boolean() }),
  CLUB_ROLE_PERMISSIONS_UPDATED: spec('Club', {
    ...role,
    permissions: v.optional(v.array(clubRolePermissionValidator)),
    /** Whether `permissions` were granted or taken away; older rows don't say. */
    enabled: v.optional(v.boolean()),
  }),
  CLUB_ROLE_REMOVED: spec('Club', {
    ...role,
    reassignedImmediately: v.number(),
    reassignedToDefault: v.optional(v.boolean()),
    channelAccessRulesUpdated: v.optional(v.number()),
    channelsBroadened: v.optional(v.number()),
  }),
  CLUB_ROLE_RENAMED: spec('Club', { roleId: v.id('clubRoles'), name: v.string() }),
  CLUB_UNITS_BULK_CREATED: spec('Club', { clubId: v.id('clubs'), created: v.number(), existing: v.number() }),
  CLUB_UNIT_ARCHIVED: spec('ClubUnit', unit),
  CLUB_UNIT_CREATED: spec('ClubUnit', { ...unit, parentUnitId: v.union(v.id('clubUnits'), v.null()) }),
  CLUB_UNIT_JOINED: spec('ClubUnit', unit),
  CLUB_UNIT_JOIN_CODE_ROTATED: spec('ClubUnit', unit),
  CLUB_UNIT_MEMBERS_BULK_SET: spec('Club', { clubId: v.id('clubs'), assigned: v.number(), removed: v.number(), replaceExisting: v.boolean() }),
  /** `memberId` is the member's user ID. */
  CLUB_UNIT_MEMBER_REMOVED: spec('ClubUnit', { ...unit, memberId: v.id('users') }),
  CLUB_UNIT_MEMBER_SET: spec('ClubUnit', { ...unit, memberId: v.id('users') }),
  CLUB_UNIT_UPDATED: spec('ClubUnit', unit),
  CLUB_UPDATED: spec('Club', {
    volunteerTrackingEnabled: v.optional(v.boolean()),
    volunteerLogId: v.optional(v.id('clubVolunteerLogs')),
    decision: v.optional(v.union(v.literal('APPROVED'), v.literal('DECLINED'))),
  }),
  CLUB_WHITEBOARD_ARCHIVED: spec('ClubWhiteboard', whiteboard),
  CLUB_WHITEBOARD_CREATED: spec('ClubWhiteboard', { ...whiteboard, duplicatedFromBoardId: v.union(v.id('clubWhiteboards'), v.null()) }),
  CLUB_WHITEBOARD_EDITED: spec('ClubWhiteboard', whiteboardEdit),
  CLUB_WHITEBOARD_RENAMED: spec('ClubWhiteboard', { ...whiteboard, previousTitle: v.string() }),
  CLUB_WHITEBOARD_RESTORED: spec('ClubWhiteboard', whiteboardEdit),
  CLUB_WHITEBOARD_UNARCHIVED: spec('ClubWhiteboard', whiteboard),
  EVENT_APPROVED: spec('Event', none),
  EVENT_CANCELLED: spec('Event', { reason: v.optional(v.literal('NO_ACTIVE_SPONSOR')) }),
  EVENT_CREATED: spec('Event', none),
  EVENT_PUBLISHED: spec('Event', { reason: v.optional(v.literal('REMAINING_SPONSORS_APPROVED')) }),
  EVENT_REJECTED: spec('Event', none),
  FEEDBACK_GITHUB_ISSUE_CREATED: spec('Report', { issueNumber: v.number() }),
  FEEDBACK_GITHUB_ISSUE_FAILED: spec('Report', none),
  FEEDBACK_GITHUB_ISSUE_RETRY_QUEUED: spec('Report', none),
  FEEDBACK_GITHUB_ISSUE_STATE_SYNCED: spec('Report', { issueNumber: v.number(), status: feedbackStatusValidator, stateReason: v.union(v.string(), v.null()) }),
  FEEDBACK_RESPONSE_ADDED: spec('Report', { responseId: v.id('feedbackReportResponses') }),
  FLEX_ATTENDANCE_CLEARED: spec('FlexAttendance', none),
  FLEX_ATTENDANCE_MARKED: spec('FlexAttendance', none),
  FLEX_FRIDAY_CREATED: spec('FlexFriday', none),
  FLEX_REGISTRATION_REMOVED: spec('FlexRegistration', { workshopTitle: v.optional(v.string()) }),
  FLEX_SESSION_CREATED: spec('FlexSession', none),
  FLEX_SESSION_DELETED: spec('FlexSession', none),
  FLEX_SESSION_UPDATED: spec('FlexSession', none),
  FLEX_WORKSHOP_ASSIGNED: spec('FlexAssignment', { workshopTitle: v.string(), studentId: v.id('users') }),
  FLEX_WORKSHOP_CREATED: spec('FlexWorkshop', none),
  FLEX_WORKSHOP_DELETED: spec('FlexWorkshop', none),
  FLEX_WORKSHOP_REGISTERED: spec('FlexRegistration', { workshopTitle: v.string() }),
  FLEX_WORKSHOP_UPDATED: spec('FlexWorkshop', none),
  KEYWORD_ADDED: spec('KeywordRule', { keyword: v.string() }),
  KEYWORD_REMOVED: spec('KeywordRule', none),
  REPORT_SUBMITTED: spec('Report', { contentType: v.string(), contentId: v.optional(v.string()) }),
  REPORT_UPDATED: spec('Report', { status: feedbackStatusValidator, previousStatus: v.optional(feedbackStatusValidator) }),
  USER_CSV_BULK_UPDATED: spec('User', { updated: v.number(), skipped: v.number() }),
  USER_CSV_IMPORT: spec('User', csvImport),
  USER_DEVELOPER_STATUS_UPDATED: spec('User', { enabled: v.boolean() }),
  USER_FEEDBACK_REVIEW_ACCESS_UPDATED: spec('User', { enabled: v.boolean() }),
  'auth.cli_session_revoked': spec('AuthSession', none),
  'auth.cli_signed_in': spec('AuthSession', { client: v.string() }),
  'auth.login_locked': spec('AuthAccount', { failureCount: v.number(), lockedUntil: v.number() }),
  'auth.login_unlocked': spec('AuthAccount', none),
  'club.unit_channel_defaults_updated': spec('Club', { enabled: v.boolean() }),
  'club.unit_channels_created': spec('Club', { created: v.number() }),
  'impersonation.requested': spec('User', { reason: v.string() }),
  'schedule.friend_accepted': spec('User', none),
  'schedule.friend_link_auto_accepted': spec('StudentFriendShareLink', { ownerId: v.id('users') }),
  'schedule.friend_link_created': spec('StudentFriendShareLink', { mode: v.union(friendShareLinkModeValidator, v.null()) }),
  'schedule.friend_link_requested': spec('StudentFriendShareLink', { ownerId: v.id('users') }),
  'schedule.friend_link_revoked': spec('StudentFriendShareLink', none),
  'schedule.friend_removed': spec('User', none),
  'schedule.friend_requested': spec('User', none),
  'schedule.group_created': spec('StudentScheduleGroup', none),
  'schedule.group_deleted': spec('StudentScheduleGroup', none),
  'schedule.updated': spec('StudentSchedule', {
    /** Whose schedule this is; the actor can be staff editing it. */
    userId: v.optional(v.id('users')),
    isPublic: v.boolean(),
    lunchPeriod: v.optional(v.union(scheduleLunchPeriodValidator, v.null())),
    entryCount: v.number(),
  }),
  'schoolDayBlock.created': spec('SchoolDayBlock', block),
  'schoolDayBlock.deleted': spec('SchoolDayBlock', block),
  'schoolDayBlock.updated': spec('SchoolDayBlock', block),
  'schoolDayDateOverride.applied_template': spec('SchoolDayDateOverride', linkedTemplate),
  'schoolDayDateOverride.created': spec('SchoolDayDateOverride', overrideDay),
  'schoolDayDateOverride.reset': spec('SchoolDayDateOverride', { dateKey: v.string() }),
  'schoolDayDateOverride.unlinked_template': spec('SchoolDayDateOverride', linkedTemplate),
  'schoolDayDateOverride.updated': spec('SchoolDayDateOverride', overrideDay),
  'schoolDayTemplate.created': spec('SchoolDayTemplate', templateDay),
  'schoolDayTemplate.deleted': spec('SchoolDayTemplate', { name: v.string() }),
  'schoolDayTemplate.set_regular': spec('SchoolDayTemplate', none),
  'schoolDayTemplate.updated': spec('SchoolDayTemplate', templateDay),
  'schoolScheduleSettings.academic_year_configured': spec('SchoolScheduleSettings', { startDateKey: v.string(), endDateKey: v.string(), regularTemplateId: v.id('schoolDayTemplates') }),
  'user.activated': spec('User', none),
  'user.bulk_deleted': spec('User', { count: v.number(), userIds: v.array(v.id('users')) }),
  'user.created': spec('User', { roles: v.array(appRoleValidator) }),
  'user.deactivated': spec('User', none),
  'user.legacy_credential_rotated': spec('User', none),
  'user.password_changed': spec('User', none),
  'user.password_reset': spec('User', none),
  'user.roles_assigned': spec('User', { roles: v.array(appRoleValidator) }),
} satisfies Record<AuditAction, { recordType: AuditRecordType; meta: PropertyValidators }>;

type Specs = typeof AUDIT_EVENT_SPECS;
/** What a writer passes as `meta` for an action. */
export type AuditMeta<A extends AuditAction> = ObjectType<Specs[A]['meta']>;
export type { WritableAuditAction };

export function auditRecordTypeOf(action: AuditAction): AuditRecordType {
  return AUDIT_EVENT_SPECS[action].recordType;
}

/** Fields every audit event has, whatever its action. */
export const auditEventCommonFields = {
  createdAt: v.number(),
  /** Missing for the system and for actors that were never recorded. */
  actorId: v.optional(v.id('users')),
  /** Written by the system rather than a person. */
  source: v.optional(v.literal('system')),
  /** The administrator behind an impersonated session; `actorId` is whose permissions were used. */
  impersonatedByUserId: v.optional(v.id('users')),
  client: v.optional(v.literal('cli')),
  workshopId: v.optional(v.id('flexWorkshops')),
  entityId: v.optional(v.string()),
};

/**
 * The table's target shape: one variant per action, each with its own record
 * type, category and `meta`. Staged first (see schema.ts), so the deploy
 * doesn't block on a scan while existing rows are migrated to it.
 */
export function auditEventsTargetValidator(): GenericValidator {
  const variants = (Object.keys(AUDIT_EVENT_SPECS) as AuditAction[]).map((action) => {
    const { recordType, meta } = AUDIT_EVENT_SPECS[action] as { recordType: AuditRecordType; meta: PropertyValidators };
    const category: AuditCategory = AUDIT_ACTIONS[action].category;
    return v.object({
      ...auditEventCommonFields,
      action: v.literal(action),
      entityType: v.literal(recordType),
      category: v.literal(category),
      meta: v.optional(v.object(meta)),
    });
  });
  const [first, second, ...rest] = variants;
  return v.union(first!, second!, ...rest);
}

/** Every category, for validators that don't narrow by action. */
export const auditCategoryValidator = v.union(
  ...(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((category) => v.literal(category)),
);
