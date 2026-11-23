'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CodeBlock } from '@/components/ui/code-block';
import { useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import type { AuditEventRecord } from '../../_lib/types';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  auditMetaFields,
} from '~/apps/shared/audit';
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
    <div className={wide ? 'basis-full' : 'min-w-0 max-w-full'}>
      <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export function AuditEventContent({ event }: { event: AuditEventRecord }) {
  const detail = useQuery(api.audit.events.get, { auditEventId: event.id });
  const snapshot = whiteboardSnapshotTarget(event);
  const preview = detail?.entityPreview;
  const links = event.context?.links ?? [];
  const previewFields = (preview?.fields ?? []).filter(
    (field) => !/\bID\b/i.test(field.label) && !['0', 'No', 'None', 'null', 'false', ''].includes(field.value),
  );
  return (
    <dl className="flex min-w-0 max-w-[calc(var(--table-view-w,100%)-1.5rem)] flex-wrap gap-x-8 gap-y-3 border-l border-border bg-surface-2 px-4 py-3 text-sm [overflow-wrap:anywhere] lg:bg-surface-3">
      {auditMetaFields(event).map((field) => (
        <Detail key={field.key} label={field.label}>{displayValue(field.value, event)}</Detail>
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
      <Detail label="Stored event" wide>
        <CodeBlock
          json={{
            action: event.action,
            entityType: event.entityType,
            entityId: event.entityId,
            actorId: event.actorId,
            client: event.client,
            createdAt: event.createdAt,
            meta: event.meta,
          }}
        />
      </Detail>
      {preview && !links.some((link) => link.id === event.entityId) ? (
        <Detail label="Record">
          {preview.href ? (
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
    </dl>
  );
}
