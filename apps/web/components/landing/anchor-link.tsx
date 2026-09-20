"use client";

import type { ReactNode } from "react";

/**
 * A link to a section of this page.
 *
 * Neither a plain anchor nor `next/link` does the right thing here. The
 * router treats a hash change as arriving at the page and scrolls the page
 * into view, which drags the window back to the top a moment after the jump;
 * and `next/link` ignores a click on the hash it is already on, so the second
 * press did nothing. This scrolls the section itself and writes the hash
 * without telling the router, so it behaves the same on every click.
 *
 * `scrollIntoView` honours the section's `scroll-mt`, so the heading clears
 * the nav. A section that is not on the page yet falls through to the
 * browser's own jump.
 */
export function AnchorLink({ href, className, children }: { href: `#${string}`; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(href.slice(1));
        if (!target || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        history.replaceState(null, "", href);
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
