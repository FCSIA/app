'use client';

import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

type AdminScrollPanelProps = {
  label: string;
  children: ReactNode;
};

/** Standard admin page body; the page owns vertical scrolling. */
export function AdminScrollPanel({ label, children }: AdminScrollPanelProps) {
  return (
    <section aria-label={`${label} administration`} className="-mx-1 flex min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* Keep the existing content alignment, with room inside the clipping
          viewport for controls' outset focus rings on every edge. */}
      <ScrollArea
        className="min-h-0 min-w-0 flex-1"
        viewportClassName="group/admin-scroll [container-type:size] px-1 pb-6 pt-3 has-[[data-slot=table-footer]]:pb-0"
      >
        {children}
      </ScrollArea>
    </section>
  );
}
