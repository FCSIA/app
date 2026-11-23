"use client";

import { Copy } from "lucide-react";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
    const { toast } = useToast();
    const text = json === undefined ? undefined : (JSON.stringify(json, null, 2) ?? "undefined");

    async function copyJson() {
      if (text === undefined) return;
      try {
        await copyText(text);
        toast({ title: "JSON copied" });
      } catch {
        toast({ title: "Could not copy JSON", variant: "destructive" });
      }
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
          <Button
            type="button"
            size="icon-compact"
            variant="ghost"
            aria-label="Copy JSON"
            title="Copy JSON"
            className="absolute right-1.5 top-1.5"
            onClick={copyJson}
          >
            <Copy />
          </Button>
        ) : null}
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

export { CodeBlock, type CodeBlockProps };
