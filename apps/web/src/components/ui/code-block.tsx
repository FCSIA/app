"use client";

import { Copy } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/share";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// CodeBlock — read-only code or data, raised off the surface it sits on.
// With `json`, keys recede and values carry the contrast, so the eye lands on
// what was stored rather than on the syntax around it.
// ---------------------------------------------------------------------------

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g;

function highlightJson(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [whole, string, colon, literal, number, punctuation] = match;
    const key = `${at}`;
    if (string && colon)
      out.push(
        <span key={key} className="text-muted-foreground">
          {string}
          {colon}
        </span>,
      );
    else if (string) out.push(<span key={key} className="text-foreground">{string}</span>);
    else if (literal || number) out.push(<span key={key} className="text-tone-social">{whole}</span>);
    else if (punctuation) out.push(<span key={key} className="text-muted-foreground">{whole}</span>);
    last = at + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface CodeBlockProps extends HTMLAttributes<HTMLPreElement> {
  /** Shown formatted and tinted. Takes precedence over `children`. */
  json?: unknown;
  children?: ReactNode;
}

const CodeBlock = forwardRef<HTMLPreElement, CodeBlockProps>(
  ({ json, children, className, ...props }, ref) => {
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
    const resetCopy = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const reduceMotion = useReducedMotion();
    const copyMessage = copyStatus === "copied" ? "JSON copied" : copyStatus === "error" ? "Could not copy JSON" : "";

    useEffect(() => () => clearTimeout(resetCopy.current), []);
    const text = json === undefined ? undefined : (JSON.stringify(json, null, 2) ?? "undefined");

    async function copyJson() {
      if (text === undefined) return;
      try {
        await copyText(text);
        setCopyStatus("copied");
      } catch {
        setCopyStatus("error");
      }
      clearTimeout(resetCopy.current);
      resetCopy.current = setTimeout(() => setCopyStatus("idle"), 1800);
    }

    return (
      <div className="relative rounded-lg bg-[hsl(var(--foreground)/0.045)] shadow-[inset_0_1px_hsl(var(--foreground)/0.10)]">
        <pre
          ref={ref}
          className={cn(
            "px-3 py-2 font-mono text-xs leading-5 text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]",
            text !== undefined && "pr-12",
            className,
          )}
          {...props}
        >
          <code>{text === undefined ? children : highlightJson(text)}</code>
        </pre>
        {text !== undefined ? (
          <>
            <Button
              type="button"
              size="icon-compact"
              variant="ghost"
              aria-label="Copy JSON"
              title={copyMessage || "Copy JSON"}
              className="absolute right-1.5 top-1.5"
              onClick={copyJson}
            >
              <span aria-hidden className="grid size-3.5 place-items-center">
                <span className={cn(
                  "col-start-1 row-start-1 transition-[opacity,scale] duration-100 ease-out motion-reduce:transition-none",
                  copyStatus !== "idle" && "scale-90 opacity-0",
                )}>
                  <Copy />
                </span>
                <span className={cn(
                  "col-start-1 row-start-1 transition-opacity duration-100 ease-out motion-reduce:transition-none",
                  copyStatus === "idle" && "opacity-0",
                  copyStatus === "error" && "text-destructive",
                )}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <motion.path
                      d={copyStatus === "error" ? "M7 7L17 17M17 7L7 17" : "M5 12L10 17L19 8"}
                      initial={false}
                      animate={{ pathLength: copyStatus === "idle" ? 0 : 1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
                    />
                  </svg>
                </span>
              </span>
            </Button>
            <span className="sr-only" role="status">{copyMessage}</span>
          </>
        ) : null}
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

export { CodeBlock, type CodeBlockProps };
