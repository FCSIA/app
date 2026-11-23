'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminNotice } from '../admin-ui';
import { CodeBlock } from '@/components/ui/code-block';
import { useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { AuditEventDetail } from '../../_lib/types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  auditMetaFields,
} from '~/apps/shared/audit';
import { WhiteboardAuditSnapshot } from './whiteboard-audit-snapshot';

function whiteboardSnapshotTarget(event: AuditEventDetail) {
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
function displayValue(value: unknown, event: AuditEventDetail): string {
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
    <div className={wide ? 'basis-full' : 'min-w-0 max-w-full'}>
      <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

/**
 * What was recorded, side by side on one line (wrapping when it must), then
 * the stored event as a raised block. Each label is a caption above its value.
 */
export function AuditEventContent({ eventId }: { eventId: Id<"auditEvents"> }) {
  const eventDetail = useQuery(api.audit.events.get, { auditEventId: eventId });
  if (eventDetail === undefined) return <p role="status" className="pl-[22px] text-muted-foreground">Loading…</p>;
  if (!eventDetail) return <AdminNotice message="This activity record could not be loaded." />;
  const snapshot = whiteboardSnapshotTarget(eventDetail);
  const preview = eventDetail.entityPreview;
  const links = eventDetail.context?.links ?? [];
  const previewFields = (preview?.fields ?? []).filter(
    (field) => !/\bID\b/i.test(field.label) && !['0', 'No', 'None', 'null', 'false', ''].includes(field.value),
  );
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-4 pl-[22px] text-sm [overflow-wrap:anywhere]">
      {auditMetaFields(eventDetail).map((field) => (
        <Detail key={field.key} label={field.label}>{displayValue(field.value, eventDetail)}</Detail>
      ))}
      {links.map((ref) => (
        <Detail key={`${ref.label}:${ref.id}`} label={ref.label}>
          {ref.href ? (
            <Link href={ref.href} className="underline underline-offset-4">{ref.name}</Link>
          ) : (
            <>{ref.name} <span className="text-muted-foreground">(no longer available)</span></>
          )}
        </Detail>
      ))}
      {preview ? (
        <Detail label="Record">
          {preview.href && !links.length ? (
            <Link href={preview.href} className="underline underline-offset-4">{preview.title}</Link>
          ) : (
            preview.title
          )}
          {preview.subtitle ? <span className="text-muted-foreground"> · {preview.subtitle}</span> : null}
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
      <Detail label="Stored event" wide>
        <CodeBlock
          json={{
            action: eventDetail.action,
            entityType: eventDetail.entityType,
            entityId: eventDetail.entityId,
            actorId: eventDetail.actorId,
            client: eventDetail.client,
            createdAt: eventDetail.createdAt,
            meta: eventDetail.meta,
          }}
        />
      </Detail>
    </dl>
  );
}
