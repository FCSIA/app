'use client';

import { isAdmin } from '~/apps/shared/roles';
import Link from 'next/link';
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { Copy, UserRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { UserProfileContent, UserProfileDialog, type UserProfilePerson } from '@/components/users/user-profile-dialog';
import { displayName } from '~/apps/shared/user-name';
import { useCurrentUser } from '@/lib/auth';
import { copyText } from '@/lib/share';
import { UserAvatar, type AvatarPerson, type UserAvatarSize } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

/**
 * The inline avatar-and-name that opens a person's preview. The hand cursor,
 * and the name's underline fading in mark the whole thing as one target. Pass it as PersonTrigger's `trigger`.
 */
export const PersonTriggerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  person: AvatarPerson;
  seed?: string;
  name: string;
  avatarSize?: UserAvatarSize;
}>(({ person, seed, name, avatarSize = 20, className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      'group/person flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-sm text-left text-foreground outline-none',
      'focus-visible:ring-1 focus-visible:ring-ring',
      className,
    )}
    {...props}
  >
    <UserAvatar person={person} seed={seed} size={avatarSize} className="shrink-0" />
    <span className="truncate underline decoration-transparent decoration-1 underline-offset-2 transition-[text-decoration-color] duration-150 ease-out group-hover/person:decoration-current group-data-[state=open]/person:decoration-current">
      {name}
    </span>
  </button>
));
PersonTriggerButton.displayName = 'PersonTriggerButton';

/** Click/tap profile preview shared by activity tables and person references. */
export function PersonTrigger({ person, actions, usersHref, roleName, trigger }: {
  person: UserProfilePerson;
  actions?: ReactNode;
  usersHref?: string;
  roleName?: string | null;
  trigger?: ReactElement;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { toast } = useToast();
  const currentUser = useCurrentUser();
  const isCurrentUser = currentUser?._id === person._id;
  return (
    <>
      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger asChild>
          {trigger ?? <Button type="button" variant="ghost" size="sm" className="max-w-full" aria-label={`View ${displayName(person)}'s profile`}>
            <span className="truncate">{displayName(person)}</span>
          </Button>}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0" aria-label={`${displayName(person)}'s profile`}>
          <UserProfileContent active={previewOpen} isCurrentUser={isCurrentUser} person={person} roleName={roleName} variant="preview" />
          <div className="flex flex-wrap gap-1 border-t border-border/60 p-2">
            {actions}
            <Button type="button" size="sm" variant="ghost" leadingIcon={UserRound} onClick={() => { setPreviewOpen(false); setProfileOpen(true); }}>Open profile</Button>
            {usersHref ? <Button asChild size="sm" variant="ghost"><Link href={usersHref}>Open in Users</Link></Button> : null}
            {isAdmin(currentUser) ? <Button type="button" size="sm" variant="ghost" leadingIcon={Copy} onClick={async () => {
              try { await copyText(person._id); toast({ title: 'Person ID copied' }); }
              catch { toast({ title: 'Could not copy the person ID', variant: 'destructive' }); }
            }}>Copy ID</Button> : null}
          </div>
        </PopoverContent>
      </Popover>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} isCurrentUser={isCurrentUser} person={person} roleName={roleName} />
    </>
  );
}
