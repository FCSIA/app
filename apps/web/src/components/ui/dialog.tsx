"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
  type ReactElement,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { fontWeights } from "@/lib/font-weight";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { useIcon } from "@/lib/icon-context";
import { spring, exitFallbackMs } from "@/lib/springs";
import { useShape } from "@/lib/shape-context";
import { useSizeVariant, typeClass } from "@/lib/size-context";
import { SurfaceProvider, useSurface } from "@/lib/surface-context";
import { surfaceClasses } from "@/lib/surface-classes";
import { Button } from "@/components/ui/button";
import { useFixedBottomVisualViewportOffset } from "@/components/ui/use-fixed-bottom-visual-viewport";

const DIALOG_OFFSET = 4;

const DialogOpenContext = createContext(false);

function Dialog({
  children,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: DialogPrimitive.DialogProps) {
  // Internal state always tracks changes, and the consumer's onOpenChange is
  // notified alongside it — a listener must not replace state handling, or an
  // uncontrolled dialog with an onOpenChange prop could never open. The Root
  // below is always controlled by `open`, so defaultOpen seeds our state
  // instead of being forwarded.
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const open = controlledOpen ?? uncontrolledOpen;
  const handleOpenChange = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <DialogOpenContext.Provider value={open}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogOpenContext.Provider>
  );
}

// Trigger and Close compose either way — `render={<Button/>}` (the
// library's composition API, shared with DropdownTrigger) or Radix-style
// `asChild` with a single child element — so one snippet works everywhere.
interface DialogSlotProps
  extends Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>, "asChild"> {
  /** Element to render as the control, e.g. a Button. */
  render?: ReactElement;
  /** Compose onto the single child element instead. */
  asChild?: boolean;
}

const DialogTrigger = forwardRef<HTMLButtonElement, DialogSlotProps>(
  ({ render, asChild, children, ...props }, ref) =>
    render ? (
      <DialogPrimitive.Trigger ref={ref} asChild {...props}>
        {render}
      </DialogPrimitive.Trigger>
    ) : (
      <DialogPrimitive.Trigger ref={ref} asChild={asChild} {...props}>
        {children}
      </DialogPrimitive.Trigger>
    )
);
DialogTrigger.displayName = "DialogTrigger";

const DialogClose = forwardRef<HTMLButtonElement, DialogSlotProps>(
  ({ render, asChild, children, ...props }, ref) =>
    render ? (
      <DialogPrimitive.Close ref={ref} asChild {...props}>
        {render}
      </DialogPrimitive.Close>
    ) : (
      <DialogPrimitive.Close ref={ref} asChild={asChild} {...props}>
        {children}
      </DialogPrimitive.Close>
    )
);
DialogClose.displayName = "DialogClose";

interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Fluid widths: short confirmation, form, or composed two-panel layout. */
  size?: "sm" | "lg" | "xl";
  /** Controls the dialog-owned content inset. Use `none` when a composed
   * primitive owns its internal layout and must meet the dialog edge. */
  padding?: "default" | "none";
  /** Classes applied to the dialog-owned close control when a composition
   * needs to align it with an internal header. */
  closeButtonClassName?: string;
  /** Portal target. When set, the overlay and panel render inside this element
   *  (positioned `absolute`) instead of covering the viewport (`fixed`). Pair
   *  with a `position: relative; overflow: hidden` container — and usually
   *  `<Dialog modal={false}>` — to scope a dialog to a bounded region, e.g. a
   *  docs preview. Defaults to the document body / full-viewport behaviour. */
  container?: HTMLElement | null;
  mobilePosition?: "center" | "top";
  /** Official Fluid composition: omit the close control when the child owns
   * its own dismissal hints. Existing dialogs keep the control by default. */
  showCloseButton?: boolean;
  /** Official top-anchored panel placement; distinct from phone-only placement. */
  position?: "center" | "top";
  /** `false` opens and closes instantly, through the same path reduced
   *  motion uses. For keyboard-summoned surfaces (the ⌘K command menu),
   *  where any open/close duration reads as delay. */
  animated?: boolean;
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  (
    {
      className,
      children,
      size = "sm",
      padding = "default",
      closeButtonClassName,
      container,
      mobilePosition = "center",
      showCloseButton = true,
      position = "center",
      animated = true,
      ...props
    },
    ref,
  ) => {
    const XIcon = useIcon("x");
    const open = useContext(DialogOpenContext);
    const shape = useShape();
    const substrate = useSurface();
    const dialogLevel = Math.min(substrate + DIALOG_OFFSET, 8);
    const [mounted, setMounted] = useState(false);
    const reduceMotion = useReducedMotion();
    const instant = reduceMotion || !animated;
    // We remove the framer-motion x/y transforms and use tailwind classes for
    // position so we can use sm: variants for desktop/mobile differences.
    const isTop = position === "top";
    const isMobileTop = mobilePosition === "top";
    const contentRef = useFixedBottomVisualViewportOffset(
      ref,
      !container && !isMobileTop && !isTop,
    );

    // Set during the render that opens it, so the portal mounts in the same
    // commit as `open` rather than one after.
    if (open && !mounted) setMounted(true);

    // Fallback release for the deferred unmount: onAnimationComplete on the
    // panel is the primary signal, but rAF-driven animation callbacks can
    // stall in throttled/background tabs — leaving an invisible full-screen
    // overlay (and Radix's scroll lock) in place. Both exit tweens run at
    // spring.slow.exit, so the fallback tracks that tier.
    useEffect(() => {
      if (open) return;
      const id = setTimeout(() => setMounted(false), exitFallbackMs(spring.slow));
      return () => clearTimeout(id);
    }, [open]);

    const handleExitComplete = () => {
      if (!open) setMounted(false);
    };

    if (!mounted) return null;

    return (
      <DialogPrimitive.Portal forceMount container={container ?? undefined}>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div
            className={cn(
              container ? "absolute" : "fixed",
              "inset-0 z-[var(--z-overlay,40)] bg-black/40 dark:bg-black/80"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: open ? 1 : 0 }}
            transition={instant ? { duration: 0 } : open ? spring.slow : spring.slow.exit}
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content ref={contentRef} asChild forceMount {...props}>
          <motion.div
            className={cn(
              container ? "absolute" : "fixed",
              "z-[var(--z-modal,50)]",
              // Mobile keeps the visual-viewport keyboard offset via the
              // individual `translate` property so it composes with
              // framer-motion's `transform: scale()`. Desktop centers with a
              // single `translate` value — a separate `sm:[translate:0_0]`
              // reset would override the centering and park the panel's
              // top-left at the viewport center.
              isTop
                ? "left-1/2 top-[12dvh] w-[calc(100%-2rem)] [translate:-50%_0]"
                : "[translate:0_var(--app-fixed-bottom-visual-viewport-offset,0px)] sm:[translate:-50%_-50%]",
              !isTop && (isMobileTop
                ? "inset-x-2 top-[calc(.5rem+env(safe-area-inset-top))] w-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)]"
                : "inset-x-2 bottom-[calc(.5rem+env(safe-area-inset-bottom))] w-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)]"),
              surfaceClasses(dialogLevel),
              "max-h-[calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain focus:outline-none",
              padding === "default" && "p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
              padding === "none" && "p-0",
              size === "sm" && (isTop ? "max-w-[400px]" : "sm:max-w-[400px]"),
              size === "lg" && (isTop ? "max-w-[540px]" : "sm:max-w-[540px]"),
              size === "xl" && (isTop ? "max-w-[880px]" : "sm:max-w-[880px]"),
              shape.container,
              className
            )}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{
              opacity: open ? 1 : 0,
              scale: open ? 1 : 0.97,
            }}
            transition={instant ? { duration: 0 } : open ? spring.slow : spring.slow.exit}
            onAnimationComplete={handleExitComplete}
          >
            <SurfaceProvider value={dialogLevel}>
              {children}
              {showCloseButton && (
                <DialogPrimitive.Close asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "absolute right-3 top-3",
                      closeButtonClassName,
                    )}
                  >
                    <XIcon />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogPrimitive.Close>
              )}
            </SurfaceProvider>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
DialogContent.displayName = "DialogContent";

function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 mb-4", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  // The title role of the type scale — see /docs/sizes.
  const compact = useSizeVariant() === "compact";
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        typeClass("title", compact ? "compact" : "default"),
        "text-foreground",
        className
      )}
      style={{ fontVariationSettings: fontWeights.semibold }}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

const DialogDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const compact = useSizeVariant() === "compact";
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        typeClass("body", compact ? "compact" : "default"),
        "text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
export type { DialogSlotProps as DialogTriggerProps, DialogSlotProps as DialogCloseProps };
