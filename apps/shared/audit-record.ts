import { auditEntityKey, auditRecordLabel, auditRecordTitle, type SearchableAuditEvent } from './audit';
import { chatReactionDefinition } from './chat/protocol';
import { FEEDBACK_STATUSES, type FeedbackStatus } from './feedback-status';

/**
 * What an event's record is, so each kind can look like itself in a log:
 * people with a face, messages as quotes, feedback by number and outcome,
 * named things by name, and records with no name of their own stepping back.
 * The record column mixes all of these; one shared style made "on my way",
 * "Feedback #240" and "Sign-in account" read as the same kind of value.
 */
export type AuditRecordView =
  /** Another person (`context.person`): a friend request, a reset password, a locked account. */
  | { kind: 'person' }
  /** The actor's own account, which the Person column already names. */
  | { kind: 'self' }
  /** What someone wrote: a chat message or comment, or the one a reaction was left on. */
  | { kind: 'message'; text: string; reaction: { glyph: string; name: string } | null; reply: boolean; attachments: number }
  /** A feedback report, by its GitHub issue number, and the status it was moved to. */
  | { kind: 'feedback'; number: number | null; status: FeedbackStatus | null }
  /** Failed sign-ins locked an account; `person` is false when no account matched. */
  | { kind: 'lock'; failures: number | null; person: boolean }
  /** A record with a name of its own: a club, announcement, workshop. */
  | { kind: 'named'; text: string }
  /** A record known only by its type ("Schedule group"). */
  | { kind: 'generic'; text: string };

const meta = (event: SearchableAuditEvent): Record<string, unknown> =>
  event.meta && typeof event.meta === 'object' && !Array.isArray(event.meta) ? event.meta as Record<string, unknown> : {};
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

export function auditRecordView(event: SearchableAuditEvent): AuditRecordView {
  const m = meta(event);
  const type = auditEntityKey(event.entityType);
  const label = auditRecordLabel(event.entityType);
  const title = auditRecordTitle(event);
  const person = !!event.context?.person;
  if (event.action === 'auth.login_locked') return { kind: 'lock', failures: count(m.failureCount), person };
  if (type === 'user') {
    if (event.entityId && event.entityId === event.actorId) return { kind: 'self' };
    if (person) return { kind: 'person' };
  }
  if ((label === 'Message' || label === 'Comment') && title !== label) {
    const reaction = typeof m.emoji === 'string' ? chatReactionDefinition(m.emoji) : null;
    return {
      kind: 'message',
      text: title,
      reaction: reaction ? { glyph: reaction.glyph, name: reaction.name } : null,
      reply: !!(m.parentMessageId || m.replyToMessageId),
      attachments: count(m.attachmentCount) ?? 0,
    };
  }
  if (type === 'report') {
    const number = count(m.issueNumber) ?? (Number(/#(\d+)/.exec(title)?.[1]) || null);
    const status = typeof m.status === 'string' && (FEEDBACK_STATUSES as readonly string[]).includes(m.status) &&
      (event.action === 'REPORT_UPDATED' || event.action === 'FEEDBACK_GITHUB_ISSUE_STATE_SYNCED')
      ? m.status as FeedbackStatus : null;
    return { kind: 'feedback', number, status };
  }
  return title === label ? { kind: 'generic', text: title } : { kind: 'named', text: title };
}
