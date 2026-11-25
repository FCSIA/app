'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { FLUSH_MAIN_CLASS } from '@/components/layout/app-main';

type AdminPageLayoutProps = {
  title: string;
  children: ReactNode;
};

/** Viewport-height admin workspace; each page owns its own scrolling. */
export function AdminPageLayout({ title, children }: AdminPageLayoutProps) {
  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      }
      viewportMode="visual"
      mainClassName={FLUSH_MAIN_CLASS}
      pageTransitionClassName="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-2 lg:p-8 lg:pt-2 has-[[data-slot=table-footer]]:pb-0">
        {children}
      </div>
    </AppShell>
  );
}
