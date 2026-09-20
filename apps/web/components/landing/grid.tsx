import { cn } from "@/lib/cn";

/*
 * The Crossmint Agents grid motif: thin full-bleed hairlines, horizontal and
 * vertical, with a small green diamond where they cross. Content sits in the
 * cells. The hero draws a full cell; between sections one rule runs across
 * the page with a diamond at each content edge.
 */

/** The green diamond that marks a grid intersection. 14px. Inline copy of `/brand/agents/grid-node.svg`. */
export function GridNode({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 13.8113 13.8113" width={size} height={size} className={cn("shrink-0", className)} fill="none">
      <path
        fill="#05B959"
        d="M4.98582 1.08754C5.85499 -0.362515 7.9563 -0.362514 8.82547 1.08754L9.99819 3.04402C10.1874 3.35971 10.4516 3.62387 10.7673 3.8131L12.7237 4.98582C14.1738 5.85499 14.1738 7.9563 12.7237 8.82547L10.7673 9.99819C10.4516 10.1874 10.1874 10.4516 9.99819 10.7673L8.82547 12.7237C7.9563 14.1738 5.85498 14.1738 4.98582 12.7237L3.8131 10.7673C3.62387 10.4516 3.35971 10.1874 3.04402 9.99819L1.08754 8.82547C-0.362515 7.9563 -0.362514 5.85498 1.08754 4.98582L3.04402 3.8131C3.35971 3.62387 3.62387 3.35971 3.8131 3.04402L4.98582 1.08754Z"
      />
    </svg>
  );
}

/** A 1px hairline across the page, with a diamond where it meets each content edge. Use it between sections. */
export function GridRule({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-px w-full bg-hairline", className)}>
      <div className="relative mx-auto h-full w-full max-w-6xl px-4 sm:px-6">
        <GridNode className="absolute top-1/2 left-4 -translate-x-1/2 -translate-y-1/2 sm:left-6" />
        <GridNode className="absolute top-1/2 right-4 translate-x-1/2 -translate-y-1/2 sm:right-6" />
      </div>
    </div>
  );
}

/**
 * The lines and corner diamonds of one grid cell. Put it first inside a
 * `relative` block: the vertical lines follow the block's left and right
 * edges, the horizontal lines follow its top and bottom and bleed to the
 * viewport edges. The parent section clips them, so it needs
 * `overflow-hidden` and enough padding that the corner diamonds survive.
 *
 * `bleed` runs the verticals far past the block, for a cell tall enough that
 * the section edge cuts them off (the hero). Without it they stop on the
 * block's own rules, which is what a short cell wants.
 *
 * `top={false}` opens the cell: no rule across the top and no diamonds on it,
 * for a cell that starts under the nav, whose own border already draws that
 * line.
 */
export function GridCell({ bleed = true, top = true }: { bleed?: boolean; top?: boolean } = {}) {
  const line = "pointer-events-none absolute bg-hairline";
  const node = "pointer-events-none absolute";
  const vertical = bleed ? "-inset-y-[60rem]" : "inset-y-0";
  return (
    <div aria-hidden className="contents">
      {top ? <span className={cn(line, "top-0 left-1/2 h-px w-screen -translate-x-1/2")} /> : null}
      <span className={cn(line, "bottom-0 left-1/2 h-px w-screen -translate-x-1/2")} />
      <span className={cn(line, vertical, "left-0 w-px")} />
      <span className={cn(line, vertical, "right-0 w-px")} />
      {top ? (
        <>
          <GridNode className={cn(node, "top-0 left-0 -translate-x-1/2 -translate-y-1/2")} />
          <GridNode className={cn(node, "top-0 right-0 translate-x-1/2 -translate-y-1/2")} />
        </>
      ) : null}
      <GridNode className={cn(node, "bottom-0 left-0 -translate-x-1/2 translate-y-1/2")} />
      <GridNode className={cn(node, "bottom-0 right-0 translate-x-1/2 translate-y-1/2")} />
    </div>
  );
}
