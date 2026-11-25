'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { CornerDownRight, Paperclip } from 'lucide-react';
import { PersonTrigger, PersonTriggerButton } from '@/components/users/person-trigger';
import { auditActionLabel, auditRecordTitle } from '~/apps/shared/audit';
import { auditRecordView } from '~/apps/shared/audit-record';
import { displayName } from '~/apps/shared/user-name';
import { STAFF_FEEDBACK_STATUS_LABELS, type FeedbackStatus } from '~/apps/shared/feedback-status';
import type { AuditEventRecord } from '../../_lib/types';

/** Where a record lives (club, then channel, workshop, …); people are not places. */
const PLACE_LABELS = new Set([
  'Club',
  'Channel',
  'Workshop',
  'Session',
  'Board',
  'Announcement',
  'Event',
  'Unit',
  'Group',
  'Template',
  'Course',
]);
function auditPlaces(event: AuditEventRecord) {
  return (event.context?.links ?? [])
    .filter(
      (link) => link.id !== event.entityId && PLACE_LABELS.has(link.label),
    )
    .slice(0, 2);
}
function RecordLink({ href, name, children }: { href?: string | null; name: string; children?: ReactNode }) {
  return href ? (
    <Link href={href} className="underline-offset-2 hover:underline focus-visible:underline" title={name}>
      {children ?? name}
    </Link>
  ) : <span title={name}>{children ?? name}</span>;
}

/**
 * The club a membership or role row is in, styled like the place that follows
 * other records. It takes only the room left over, so the person and role
 * stay whole first.
 */
function ClubPlace({ href, name }: { href?: string | null; name: string }) {
  return (
    <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground @min-[48rem]/audit:block">
      <RecordLink href={href} name={name} />
    </span>
  );
}

// A status reads in the palette's meaning tones: a decision stands out, an
// open state stays quiet.
const statusTone: Record<FeedbackStatus, string> = {
  PENDING: 'text-muted-foreground',
  IN_REVIEW: 'text-tone-caution',
  RESOLVED: 'text-tone-positive',
  DISMISSED: 'text-muted-foreground',
};

function RecordPerson({ person }: { person: NonNullable<NonNullable<AuditEventRecord['context']>['person']> }) {
  const name = displayName(person);
  return (
    <PersonTrigger
      person={{ ...person, _id: person.id, preferredName: person.preferredName ?? undefined }}
      usersHref={`/admin/users?user=${encodeURIComponent(person.id)}`}
      trigger={
        <PersonTriggerButton
          person={person}
          seed={person.id}
          name={name}
          title={name}
          className="max-w-full focus-visible:ring-inset"
          aria-label={`View ${name}'s profile`}
        />
      }
    />
  );
}

/**
 * The record column holds very different kinds of values, so each kind gets
 * its own shape and the eye can sort rows before reading them: a person
 * has a face, a message is quoted, feedback is a number with its outcome,
 * a named record is plain text, and one known only by its type steps back.
 * Kept to one line so every row is the same height.
 */
export function AuditRecord({ event }: { event: AuditEventRecord }) {
  const view = auditRecordView(event);
  const links = event.context?.links ?? [];
  const record = links.find((link) => link.id === event.entityId);
  const person = event.context?.person;
  const places = auditPlaces(event);
  const workshop = places.find((place) => place.label === 'Workshop');
  const namedWorkshop = view.kind === 'generic' ? workshop : undefined;
  const context = places.filter((place) => place !== namedWorkshop);
  const student = event.action === 'FLEX_WORKSHOP_ASSIGNED'
    ? links.find((link) => link.label === 'Student')
    : undefined;
  if (student) context.push(student);
  const deleted = !namedWorkshop && event.context?.deleted &&
    !/^(Deleted|Removed)\b/.test(auditActionLabel(event.action));

  let lead: ReactNode;
  switch (view.kind) {
    case 'person':
      lead = person ? <RecordPerson person={person} /> : null;
      break;
    case 'self':
      lead = <span className="truncate text-muted-foreground">Own account</span>;
      break;
    case 'lock':
      lead = (
        <>
          {person ? <RecordPerson person={person} /> : <span className="shrink-0 text-muted-foreground">Unknown account</span>}
          {view.failures ? <span className="shrink-0 text-xs text-muted-foreground">{view.failures} failed sign-ins</span> : null}
        </>
      );
      break;
    case 'member':
      lead = (
        <>
          {person ? <span className="flex min-w-0 max-w-[55%] shrink-0"><RecordPerson person={person} /></span> : null}
          {view.group ? <span className="max-w-[40%] shrink-0 truncate text-muted-foreground">→ <span className="text-foreground">{view.group}</span></span> : null}
          {view.club ? <ClubPlace href={record?.href} name={view.club} /> : null}
        </>
      );
      break;
    case 'schedule':
      lead = view.own || !person
        ? <span className="truncate text-muted-foreground">Own schedule</span>
        : <><RecordPerson person={person} /><span className="shrink-0 text-muted-foreground">schedule</span></>;
      break;
    case 'role':
      lead = (
        <>
          <span className="min-w-0 truncate text-foreground" title={view.name}>{view.name}</span>
          {view.change ? <span className="shrink-0 text-xs text-muted-foreground">{view.change}</span> : null}
          {view.club ? <ClubPlace href={record?.href} name={view.club} /> : null}
        </>
      );
      break;
    case 'message':
      lead = (
        <>
          {view.reaction ? <span role="img" aria-label={view.reaction.name} title={view.reaction.name} className="shrink-0">{view.reaction.glyph}</span> : null}
          {view.reply ? <CornerDownRight size={14} aria-label="Reply" className="shrink-0 text-muted-foreground" /> : null}
          <span className="min-w-0 truncate border-l-2 border-border pl-2 text-foreground">
            <RecordLink href={record?.href} name={view.text} />
          </span>
          {view.attachments ? (
            <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground" title={`${view.attachments} attachment${view.attachments === 1 ? '' : 's'}`}>
              <Paperclip size={12} aria-hidden />{view.attachments}
            </span>
          ) : null}
        </>
      );
      break;
    case 'feedback':
      lead = (
        <>
          <span className="shrink-0">
            <RecordLink href={record?.href} name={auditRecordTitle(event)}>
              <span className="text-muted-foreground">Feedback</span>
              {view.number ? <span className="tabular-nums text-foreground"> #{view.number}</span> : null}
            </RecordLink>
          </span>
          {view.status ? (
            <span className={`truncate text-xs ${statusTone[view.status]}`}>→ {STAFF_FEEDBACK_STATUS_LABELS[view.status]}</span>
          ) : null}
        </>
      );
      break;
    default: {
      const title = namedWorkshop?.name ?? view.text;
      lead = (
        <span className={`min-w-0 truncate ${view.kind === 'generic' && !namedWorkshop ? 'text-muted-foreground' : 'text-foreground'}`}>
          <RecordLink href={(namedWorkshop ?? record)?.href} name={deleted ? `${title} (deleted)` : title} />
        </span>
      );
    }
  }

  // The record leads; its club / #channel follow in muted type, cut short on
  // their own. A narrow pane drops the place; the opened event keeps it.
  return (
    <span className="flex min-w-0 items-center gap-2" data-record-kind={view.kind}>
      {lead}
      {context.length ? (
        <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-muted-foreground @min-[48rem]/audit:block">
          {context.map((item, index) => (
            <Fragment key={`${item.label}:${item.id}`}>
              {index ? ' / ' : null}
              <RecordLink href={item.href} name={item.label === 'Channel' ? `#${item.name}` : item.name} />
            </Fragment>
          ))}
        </span>
      ) : null}
    </span>
  );
}
