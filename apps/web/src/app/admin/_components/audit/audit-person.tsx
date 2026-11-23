'use client';

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { SquareTerminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IaOrbitMark } from '@/components/ui/ia-orbit-mark';
import { PersonTrigger, PersonTriggerButton } from '@/components/users/person-trigger';
import { isAuditSystem, auditPersonName } from '~/apps/shared/audit';
import type { AuditEventRecord } from '../../_lib/types';

/** Marks an action taken through the command-line client; opens what that means. */
function CliMark({ name, at }: { name: string; at: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Done from the command-line client"
          onClick={(event) => event.stopPropagation()}
          className="shrink-0 cursor-pointer rounded-sm text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:text-foreground"
        >
          <SquareTerminal size={14} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-sm">
        <p className="font-medium">Done from the IA CLI</p>
        <p className="mt-1 text-muted-foreground">
          {name} did this from the command-line client, signed in through a
          device they approved, on {format(new Date(at), 'PPP')} at {format(new Date(at), 'p')}.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The actor's avatar and name open the shared profile preview
 * with the log filter. The app's mark stands in for system events and an
 * empty seat for a person who no longer exists.
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
    return (
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {isAuditSystem(event) ? (
          <IaOrbitMark alt="" width={20} height={20} className="size-5 shrink-0 rounded-full" />
        ) : (
          <span aria-hidden className="size-5 shrink-0 rounded-full border border-dashed border-border" />
        )}
        <span className="truncate">{name}</span>
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PersonTrigger
        key={filterCount}
        person={{ ...actor, _id: actor.id, preferredName: actor.preferredName ?? undefined }}
        usersHref={`/admin/users?user=${encodeURIComponent(actor.id)}`}
        trigger={
          <PersonTriggerButton
            ref={triggerRef}
            person={actor}
            seed={actor.id}
            name={name}
            title={name}
            className="focus-visible:ring-inset"
            aria-label={`View ${name}'s profile`}
          />
        }
        actions={<Button type="button" size="sm" variant="ghost" onClick={() => { onFilter(actor.id, name); setFilterCount((count) => count + 1); }}>Filter by this person</Button>}
      />
      {event.client === 'cli' ? <CliMark name={name} at={event.createdAt} /> : null}
    </span>
  );
}
