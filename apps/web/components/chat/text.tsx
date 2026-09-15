import type { ReactNode } from "react";
import { cn } from "@goat-wallet/ui";

/**
 * Renders assistant text without a markdown library. Handles what the model
 * emits after the system prompt asks for plain text: paragraphs, "- " lists,
 * **bold**, `code`, and bare URLs. Everything else prints as written.
 */
export function Text({ text, className }: { text: string; className?: string }) {
  const blocks = splitBlocks(text);
  return (
    <div className={cn("space-y-2 text-[15px] leading-relaxed", className)}>
      {blocks.map((block, i) =>
        block.kind === "list" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {inline(block.text)}
          </p>
        ),
      )}
    </div>
  );
}

type Block = { kind: "p"; text: string } | { kind: "list"; items: string[] };

function splitBlocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split(/\n{2,}/)) {
    const lines = raw.split("\n");
    const isList = lines.length > 0 && lines.every((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l) || l.trim() === "");
    if (isList) {
      out.push({ kind: "list", items: lines.filter((l) => l.trim()).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")) });
    } else if (raw.trim()) {
      out.push({ kind: "p", text: raw });
    }
  }
  return out;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>)]+)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((chunk, i) => {
    if (!chunk) return null;
    if (chunk.startsWith("**") && chunk.endsWith("**")) return <strong key={i}>{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
          {chunk.slice(1, -1)}
        </code>
      );
    }
    if (/^https?:\/\//.test(chunk)) {
      const trailing = chunk.match(/[.,;:!?]+$/)?.[0] ?? "";
      const href = trailing ? chunk.slice(0, -trailing.length) : chunk;
      return (
        <span key={i}>
          <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-primary">
            {href}
          </a>
          {trailing}
        </span>
      );
    }
    return chunk;
  });
}
