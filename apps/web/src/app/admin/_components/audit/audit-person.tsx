'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PersonTrigger } from '@/components/users/person-trigger';
import { Bot, Terminal, UserRound } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { isAuditSystem, auditPersonName } from '~/apps/shared/audit';
import type { AuditEventRecord } from '../../_lib/types';

/**
 * The actor as a live entity: the name reads as row content (cell type, full
 * contrast) with the chat author-name affordance, and opens the shared profile
 * preview with the log filter. Rows without a person stay plain text.
 */
export function AuditPerson({ event, onFilter }: {
  event: AuditEventRecord;
  onFilter: (id: string, name: string) => void;
}) {
  const name = auditPersonName(event);
  const actor = event.actor;
  const triggerRef = useRef<HTMLButtonElement>(null);
  // PersonTrigger owns its open state and has no close hook for actions yet,
  // so filtering remounts it (closed) and returns focus to the name.
  const [filterCount, setFilterCount] = useState(0);
  useEffect(() => { if (filterCount) triggerRef.current?.focus(); }, [filterCount]);
  if (!actor) {
    const Icon = isAuditSystem(event) ? Bot : UserRound;
    return <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><Icon size={18} aria-hidden className="shrink-0" /><span className="truncate">{name}</span></span>;
  }
  return (
    <PersonTrigger
      key={filterCount}
      person={{ ...actor, _id: actor.id, preferredName: actor.preferredName ?? undefined }}
      usersHref={`/admin/users?user=${encodeURIComponent(actor.id)}`}
      trigger={
        <button
          ref={triggerRef}
          type="button"
          aria-label={`View ${name}'s profile${event.client === 'cli' ? ' (via command line)' : ''}`}
          title={event.client === "cli" ? `${name} via command line` : name}
          className="flex max-w-full items-center gap-2 rounded-sm text-left text-foreground outline-none hover:underline hover:underline-offset-2 focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="relative shrink-0" aria-hidden>
            <UserAvatar person={actor} seed={actor.id} size={20} />
            {event.client === 'cli' && <Terminal size={12} className="absolute -bottom-0.5 -right-1 rounded-sm bg-background text-foreground" />}
          </span>
          <span className="truncate">{name}</span>
          {actor.uniqueId && actor.uniqueId !== name && <span className="truncate text-xs text-muted-foreground">{actor.uniqueId}</span>}
        </button>
      }
      actions={<Button type="button" size="sm" variant="ghost" onClick={() => { onFilter(actor.id, name); setFilterCount((count) => count + 1); }}>Filter by this person</Button>}
    />
  );
}
