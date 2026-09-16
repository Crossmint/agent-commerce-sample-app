import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The contact avatar in a chat header or next to a bubble. A brand logo when
 * one is given, else a neutral robot mark for "Your agent". With
 * `logoStyle="fill"` the file is a full app icon and covers the circle.
 */
export function ContactAvatar({
  size = 36,
  logo,
  logoStyle = "mark",
  className,
  ring = false,
}: {
  size?: number;
  logo?: string;
  logoStyle?: "fill" | "mark";
  className?: string;
  ring?: boolean;
}) {
  const fill = Boolean(logo) && logoStyle === "fill";
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white",
        fill ? "bg-white" : "bg-[#3a3a3c]",
        ring && "ring-2 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <Image
          src={logo}
          alt=""
          width={size}
          height={size}
          className={fill ? "object-cover" : "object-contain"}
          style={fill ? { width: size, height: size } : { width: size * 0.56, height: size * 0.56 }}
        />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: size * 0.56, height: size * 0.56 }}>
          <rect x="4" y="8" width="16" height="11" rx="3" />
          <path d="M12 8V4.5M9.5 4.5h5" />
          <circle cx="9" cy="13.5" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="13.5" r="1" fill="currentColor" stroke="none" />
          <path d="M2.5 12.5v2M21.5 12.5v2" />
        </svg>
      )}
    </span>
  );
}
