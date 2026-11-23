'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { CodeBlock } from '@/components/ui/code-block';
import { cn } from '@/lib/utils';
import styles from './audit-event-content.module.css';
import { useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { AuditEventRecord } from '../../_lib/types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { auditMetaFields } from '~/apps/shared/audit';
import { WhiteboardAuditSnapshot } from './whiteboard-audit-snapshot';

function whiteboardSnapshotTarget(event: AuditEventRecord) {
  if (
    event.entityType !== 'ClubWhiteboard' ||
    !['CLUB_WHITEBOARD_EDITED', 'CLUB_WHITEBOARD_RESTORED'].includes(
      event.action,
    )
  )
    return null;
  const meta = event.meta as { boardId?: unknown; toSeq?: unknown } | null;
  if (typeof meta?.boardId !== 'string' || typeof meta.toSeq !== 'number')
    return null;
  return { boardId: meta.boardId as Id<'clubWhiteboards'>, atSeq: meta.toSeq };
}
function displayValue(value: unknown, event: AuditEventRecord): string {
  if (typeof value === 'string')
    return (
      event.context?.references.find((ref) => ref.id === value)?.name ?? value
    );
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value);
}
function Detail({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn('min-w-0 max-w-full', wide && 'basis-full')}>
      <dt className={cn('text-muted-foreground', wide ? 'mb-0.5 block' : 'mr-1.5 inline')}>{label}</dt>
      <dd className={cn('whitespace-pre-wrap text-foreground', !wide && 'inline')}>{children}</dd>
    </div>
  );
}

export function AuditEventContent({ event, showRecordLink }: { event: AuditEventRecord; showRecordLink: boolean }) {
  const detail = useQuery(api.audit.events.get, { auditEventId: event.id });
  const snapshot = whiteboardSnapshotTarget(event);
  const preview = detail?.entityPreview;
  const links = event.context?.links ?? [];
  const previewFields = (preview?.fields ?? []).filter(
    (field) => !/\bID\b/i.test(field.label) && !['0', 'No', 'None', 'null', 'false', ''].includes(field.value),
  );
  const recordLink = links.find((ref) => ref.id === event.entityId);
  const previewHref = recordLink?.href ? null : preview?.href;
  const related = links.filter((ref) => ref !== recordLink || (showRecordLink && ref.href));
  const fields = auditMetaFields(event);

  return (
    <div className="min-w-0 max-w-[calc(var(--table-view-w,100%)-1.5rem)] pb-2 pl-8 pr-4 text-xs leading-5 [overflow-wrap:anywhere]">
      <dl className="flex flex-wrap gap-x-5 gap-y-1">
        <Detail label="Time">
          <time dateTime={event.createdAt}>{format(new Date(event.createdAt), 'h:mm:ss a OOOO')}</time>
        </Detail>
        {fields.map((field) => (
          <Detail key={field.key} label={field.label} wide={field.key === 'previousBodyPreview' || field.key === 'bodyPreview'}>
            {displayValue(field.value, event)}
          </Detail>
        ))}
        {related.map((ref) => (
          <Detail key={`${ref.label}:${ref.id}`} label={ref.label}>
            {ref.href ? (
              <Link href={ref.href} className="rounded-sm underline decoration-foreground/30 underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-ring">{ref.name}</Link>
            ) : (
              <>{ref.name} <span className="text-muted-foreground">(no longer available)</span></>
            )}
          </Detail>
        ))}
        {previewHref && preview ? (
          <Detail label="Board">
            <Link href={previewHref} className="rounded-sm underline decoration-foreground/30 underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-ring">
              {preview.title}
            </Link>
          </Detail>
        ) : null}
        {preview?.body ? <Detail label="Content" wide>{preview.body}</Detail> : null}
        {previewFields.map((field) => (
          <Detail key={field.label} label={field.label}>{field.value}</Detail>
        ))}
        {snapshot ? (
          <Detail label="Board" wide>
            <WhiteboardAuditSnapshot boardId={snapshot.boardId} atSeq={snapshot.atSeq} />
          </Detail>
        ) : null}
      </dl>
      <details className={cn(styles.storedJson, "group/raw min-w-0")}>
        <summary className="flex min-h-6 w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <ChevronRight aria-hidden className={cn(styles.chevron, "size-3 group-open/raw:rotate-90")} />
          Stored JSON
        </summary>
        <div className="mt-1 max-w-3xl">
          <CodeBlock
            json={{
              action: event.action,
              entityType: event.entityType,
              entityId: event.entityId,
              actorId: event.actorId,
              workshopId: event.workshopId,
              client: event.client,
              createdAt: event.createdAt,
              meta: event.meta,
            }}
          />
        </div>
      </details>
    </div>
  );
}
