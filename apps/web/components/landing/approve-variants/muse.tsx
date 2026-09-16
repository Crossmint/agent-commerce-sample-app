import Image from "next/image";
import { LockIcon } from "../chat/icons";
import type { ApproveLayoutProps } from "./types";

const GRADIENT = "bg-[linear-gradient(120deg,#f58529_0%,#dd2a7b_45%,#8134af_100%)]";

/**
 * Muse: a dark screen with the Instagram gradient used as an accent. Brand
 * row on top, the amount large, purpose, a card row, and a gradient Allow
 * with 8px corners.
 */
export function MuseApprove({ agentName = "Muse", logo }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-[#0b0b0d] px-4 pt-4 pb-4 text-white antialiased">
      <div className="flex items-center gap-2">
        <span className={`inline-flex size-6 items-center justify-center rounded-full ${GRADIENT}`}>
          {logo ? <Image src={logo} alt="" width={14} height={14} className="size-3.5" /> : null}
        </span>
        <span className="text-[13px] font-semibold tracking-tight">{agentName}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-7">
        <p className="text-[11px] font-medium text-[#a8a8a8]">{agentName} wants to spend up to</p>
        <p className="mt-1 text-[40px] leading-none font-bold tracking-tight tabular-nums">$8.00</p>
        <p className="mt-2.5 text-[12.5px] text-[#d1d1d1]">Grande latte at Starbucks</p>

        <div className="mt-6 flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
          <span className={`inline-flex h-[22px] w-[34px] shrink-0 flex-col justify-end rounded-[4px] p-[4px] ${GRADIENT}`}>
            <span className="block h-[3px] w-[55%] rounded-[1px] bg-white/70" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[12.5px] font-medium">Visa •••• 4242</span>
            <span className="text-[10.5px] text-[#a8a8a8]">Default card</span>
          </span>
          <span className="text-[11px] font-medium text-[#a8a8a8]">Change</span>
        </div>

        <p className="mt-4 flex items-start gap-1.5 text-[10.5px] leading-snug text-[#a8a8a8]">
          <LockIcon width={12} height={12} className="mt-px shrink-0" />
          The card number stays in the vault. {agentName} never sees it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div aria-hidden className={`flex h-11 items-center justify-center rounded-[8px] text-[14px] font-semibold text-white ${GRADIENT}`}>
          Allow
        </div>
        <p className="text-center text-[11px] font-medium text-[#a8a8a8]">Not now</p>
      </div>
    </div>
  );
}
