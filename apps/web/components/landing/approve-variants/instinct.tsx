import Image from "next/image";
import { ChevronDownIcon, LockIcon } from "../chat/icons";
import type { ApproveLayoutProps } from "./types";

/**
 * Instinct: a clean light screen. Headline, Purpose and Limit as plain lines,
 * a card select with a small card image, the lock line, and one large orange
 * full-width Allow with 12px corners.
 */
export function InstinctApprove({ agentName = "Instinct", logo }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-white px-4 pt-4 pb-4 text-[#111] antialiased">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
        {logo ? <Image src={logo} alt="" width={16} height={16} className="size-4 brightness-0" /> : null}
        {agentName}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
        <p className="text-[19px] leading-[1.2] font-semibold tracking-tight">{agentName} is requesting to use your card</p>

        <div className="flex flex-col gap-1 text-[12.5px] leading-snug">
          <p>
            <span className="text-[#6b6b6b]">Purpose:</span> Grande latte at Starbucks
          </p>
          <p>
            <span className="text-[#6b6b6b]">Limit:</span> $200
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium">Choose card</span>
          <div aria-hidden className="flex h-11 items-center gap-2.5 rounded-[12px] border border-[#d9d9d9] px-3 text-[12.5px]">
            <span className="inline-flex h-[18px] w-[27px] shrink-0 flex-col justify-between overflow-hidden rounded-[3px] bg-gradient-to-br from-[#4b2a8f] to-[#1d123f] p-[3px]">
              <span className="block h-[3px] w-full rounded-[1px] bg-white/25" />
              <span className="block h-[3px] w-[45%] rounded-[1px] bg-white/60" />
            </span>
            <span className="flex-1 truncate">Truist ••••9054</span>
            <ChevronDownIcon width={16} height={16} className="text-[#6b6b6b]" />
          </div>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[#6b6b6b]">
          <LockIcon width={13} height={13} className="mt-px shrink-0" />
          Your card number is never shared with the agent or the store.
        </p>
      </div>

      <div aria-hidden className="flex h-12 items-center justify-center rounded-[12px] bg-[#f4511e] text-[15px] font-semibold text-white">
        Allow
      </div>
    </div>
  );
}
