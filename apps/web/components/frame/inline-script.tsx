"use client";

/**
 * A script that runs before hydration. The layout uses it to seed
 * `--device-scale` so the phone frame paints at the right size on the first
 * frame, without waiting for React.
 *
 * "text/plain" on the client avoids React's dev warning about script tags:
 * the server-rendered copy already ran, and the client never needs to.
 */
export function InlineScript({ html }: { html: string }) {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}
