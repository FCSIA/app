import { describe, expect, test } from 'vitest';
import { auditRecordView } from './audit-record';

const event = (over: Record<string, unknown>) => ({
  id: 'e', action: 'X', entityType: 'Club', entityId: 'r1', actorId: 'a1', createdAt: '2026-11-25T00:00:00Z',
  meta: {}, context: { title: 'Robotics', subtitle: null, references: [], links: [] }, ...over,
});
const person = { id: 'u2', firstName: 'Ezra', lastName: 'Goldfarb', uniqueId: '1' };

describe('auditRecordView', () => {
  test('another person is a person; your own account is not repeated', () => {
    expect(auditRecordView(event({ entityType: 'user', entityId: 'u2', action: 'schedule.friend_requested', context: { title: 'Ezra Goldfarb', subtitle: null, references: [], person } })).kind).toBe('person');
    expect(auditRecordView(event({ entityType: 'user', entityId: 'a1', action: 'user.password_changed', context: { title: 'Me', subtitle: null, references: [], person } }))).toEqual({ kind: 'self' });
  });
  test('messages carry their text, reaction, reply and attachments', () => {
    expect(auditRecordView(event({ entityType: 'ClubChannelMessage', action: 'CLUB_CHANNEL_MESSAGE_REACTION_ADDED', meta: { emoji: 'LIKE', replyToMessageId: 'm0', attachmentCount: 2 }, context: { title: 'on my way', subtitle: null, references: [] } })))
      .toEqual({ kind: 'message', text: 'on my way', reaction: { glyph: '👍', name: 'Like' }, reply: true, attachments: 2 });
    expect(auditRecordView(event({ entityType: 'ClubChannelMessage', context: { title: 'Message', subtitle: null, references: [] } })).kind).toBe('generic');
  });
  test('feedback reads its number and the status it moved to', () => {
    expect(auditRecordView(event({ entityType: 'Report', action: 'REPORT_UPDATED', meta: { status: 'RESOLVED' }, context: { title: 'Feedback #240', subtitle: null, references: [] } })))
      .toEqual({ kind: 'feedback', number: 240, status: 'RESOLVED' });
    expect(auditRecordView(event({ entityType: 'Report', action: 'REPORT_SUBMITTED', context: { title: 'Report', subtitle: null, references: [] } })))
      .toEqual({ kind: 'feedback', number: null, status: null });
  });
  test('locks, named and generic records', () => {
    expect(auditRecordView(event({ entityType: 'authAccount', action: 'auth.login_locked', meta: { failureCount: 6 }, context: { title: 'Ezra Goldfarb', subtitle: null, references: [], person } })))
      .toEqual({ kind: 'lock', failures: 6, person: true });
    expect(auditRecordView(event({}))).toEqual({ kind: 'named', text: 'Robotics' });
    expect(auditRecordView(event({ entityType: 'studentScheduleGroup', context: { title: 'Schedule group', subtitle: null, references: [] } }))).toEqual({ kind: 'generic', text: 'Schedule group' });
  });
  test('membership, schedules and roles name the person or role they are about', () => {
    const role = { id: 'r1', label: 'Role', name: 'Treasurer', href: null };
    expect(auditRecordView(event({ action: 'CLUB_MEMBER_ROLE_SET', meta: { memberId: 'u2', roleId: 'r1' }, context: { title: 'Robotics', subtitle: null, references: [], links: [role], person } })))
      .toEqual({ kind: 'member', group: 'Treasurer', club: 'Robotics' });
    expect(auditRecordView(event({ action: 'CLUB_UNIT_MEMBER_SET', entityType: 'ClubUnit', context: { title: 'Officers', subtitle: null, references: [], links: [], person } })))
      .toEqual({ kind: 'member', group: 'Officers', club: null });
    expect(auditRecordView(event({ action: 'schedule.updated', entityType: 'StudentSchedule', actorId: 'u2', context: { title: 'Student schedule', subtitle: null, references: [], person } })))
      .toEqual({ kind: 'schedule', own: true });
    expect(auditRecordView(event({ action: 'CLUB_ROLE_PERMISSIONS_UPDATED', meta: { roleId: 'r1', permissions: ['createPolls', 'pinMessages'], enabled: false }, context: { title: 'Robotics', subtitle: null, references: [], links: [role] } })))
      .toEqual({ kind: 'role', name: 'Treasurer', change: 'Removed 2 permissions', club: 'Robotics' });
  });
});
