"use client";

import { FileText, X } from "lucide-react";
import { Spinner, cn } from "@goat-wallet/ui";
import type { Attachment } from "@/lib/chat/types";

export function AttachmentPreview({
  attachment,
  uploading = false,
  onRemove,
  className,
}: {
  attachment: Attachment;
  uploading?: boolean;
  onRemove?: () => void;
  className?: string;
}) {
  const isImage = attachment.contentType.startsWith("image/");
  return (
    <div
      className={cn("group relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted", className)}
      title={attachment.name}
    >
      {isImage && attachment.url ? (
        // Blob URLs are remote and vary by store; next/image would need a remotePatterns entry per host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={attachment.url} alt={attachment.name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
          <FileText className="size-5" />
          <span className="w-full truncate text-center text-[10px]">{attachment.name}</span>
        </div>
      )}
      {uploading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Spinner />
        </div>
      ) : null}
      {onRemove && !uploading ? (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          onClick={onRemove}
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}
