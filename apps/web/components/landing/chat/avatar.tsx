import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * The contact avatar in a chat header or next to a bubble. A brand logo when
 * one is given, else a neutral robot mark for "Your agent".
 */
export function ContactAvatar({ size = 36, logo, className, ring = false }: { size?: number; logo?: string; className?: string; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#3a3a3c] text-white", ring && "ring-2 ring-white/10", className)}
      style={{ width: size, height: size }}
    >
      {logo ? (
        <Image src={logo} alt="" width={size} height={size} className="object-contain" style={{ width: size * 0.56, height: size * 0.56 }} />
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
