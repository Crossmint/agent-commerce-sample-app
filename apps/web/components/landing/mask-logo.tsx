import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * A one-color logo that takes the current text color. The SVG is a CSS
 * mask over a `currentColor` fill, so the theme colors it: an `<img>` of
 * an SVG cannot inherit `color`. Give it a `width` and `height` in px
 * (the file's aspect ratio) or size it with classes. An empty `label` marks
 * it decorative.
 */
export function MaskLogo({ src, label, width, height, className, style }: { src: string; label: string; width?: number; height?: number; className?: string; style?: CSSProperties }) {
  const url = `url("${src}")`;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width,
        height,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        ...style,
      }}
    />
  );
}
