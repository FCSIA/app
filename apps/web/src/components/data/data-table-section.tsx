'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Pins a table header directly under its `DataTableSection` toolbar. The
 * header paints the main surface so rows scroll beneath it, and draws its
 * bottom edge as an inset shadow because collapsed borders do not stick.
 */
export const PINNED_TABLE_HEADER =
  'sticky top-(--table-sticky-top,0px) z-20 bg-(--app-main-bg) [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]';

/**
 * The admin data-table anatomy, taken from the audit log: a toolbar pinned to
 * the top of the tab's scroll viewport, then the table (or list) on the main
 * surface with no card frame. Place it directly in an `AdminScrollTabPanel`;
 * the toolbar pulls up into that viewport's top padding so rows never show
 * above it. A footer fills short lists to the viewport height and stays
 * below the visible rows while a long list scrolls.
 */
export function DataTableSection({
  label,
  toolbar,
  footer,
  footerClassName,
  children,
  className,
}: {
  label: string;
  toolbar: ReactNode;
  footer?: ReactNode;
  footerClassName?: string;
  children: ReactNode;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    // Sticky offsets start below the viewport's top padding; the toolbar's
    // negative top pulls it into that padding, so the header sits that much
    // higher. Its height changes with chips, tabs, and errors.
    const observer = new ResizeObserver(() =>
      sectionRef.current?.style.setProperty(
        '--table-sticky-top',
        `${toolbar.offsetHeight + Number.parseFloat(getComputedStyle(toolbar).top)}px`,
      ),
    );
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={cn(
        'flex min-w-0 flex-col [--data-table-substrate:var(--app-main-bg)]',
        footer != null && 'min-h-[100cqh]',
        className,
      )}
    >
      <div
        ref={toolbarRef}
        data-slot="table-toolbar"
        className={cn(
          'sticky -top-3 z-30 -mt-3 flex flex-col gap-2 bg-(--app-main-bg) pb-3 pt-3',
          'after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:from-black/15 after:to-transparent after:opacity-0 motion-safe:after:transition-opacity dark:after:from-black/35',
          'group-data-[at-scroll-start=false]/admin-scroll:after:opacity-100',
        )}
      >
        {toolbar}
      </div>
      {children}
      {footer != null ? (
        <div
          data-slot="table-footer"
          className={cn(
            'sticky bottom-0 z-20 mt-auto bg-(--app-main-bg) py-3',
            'before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-3 before:bg-linear-to-t before:from-black/15 before:to-transparent before:opacity-0 motion-safe:before:transition-opacity dark:before:from-black/35',
            'group-data-[at-scroll-end=false]/admin-scroll:before:opacity-100',
            footerClassName,
          )}
        >
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** The toolbar's live record count, e.g. "12 reports" or "40/120 users". */
export function DataTableCount({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 text-xs tabular-nums text-muted-foreground" role="status" aria-live="polite">
      {children}
    </span>
  );
}
