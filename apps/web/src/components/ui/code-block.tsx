import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
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
          <span className="opacity-60">{colon}</span>
        </span>,
      );
    else if (string) out.push(<span key={key} className="text-foreground">{string}</span>);
    else if (literal || number) out.push(<span key={key} className="text-tone-social">{whole}</span>);
    else if (punctuation) out.push(<span key={key} className="text-muted-foreground/60">{whole}</span>);
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
  ({ json, children, className, ...props }, ref) => (
    <pre
      ref={ref}
      className={cn(
        "surface-raised rounded-lg px-4 py-3 font-mono text-xs leading-5 text-foreground",
        "whitespace-pre-wrap [overflow-wrap:anywhere]",
        className,
      )}
      {...props}
    >
      <code>{json !== undefined ? highlightJson(JSON.stringify(json, null, 2) ?? "undefined") : children}</code>
    </pre>
  ),
);
CodeBlock.displayName = "CodeBlock";

export { CodeBlock, type CodeBlockProps };
