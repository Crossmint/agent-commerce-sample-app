import Image from "next/image";
import type { ApproveLayoutProps } from "./types";

/**
 * GrokBot: near-black, white text, minimal. One thin-border card with the
 * request, a monospace amount, and a white Allow on black.
 */
export function GrokBotApprove({ agentName = "GrokBot", logo }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-[#050505] px-4 pt-4 pb-4 text-white antialiased">
      <div className="flex items-center gap-2 text-[13px] font-semibold tracking-tight">
        {logo ? <Image src={logo} alt="" width={16} height={16} className="size-4" /> : null}
        {agentName}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className="flex flex-col gap-4 rounded-[10px] border border-[#2a2a2a] p-4">
          <p className="text-[11px] text-[#8b8b8b]">Card access request</p>
          <p className="font-mono text-[34px] leading-none font-medium tracking-tight tabular-nums">$8.00</p>
          <dl className="flex flex-col gap-2 text-[12px]">
            <Row k="Agent" v={agentName} />
            <Row k="Purpose" v="Grande latte" />
            <Row k="Card" v="Visa ···· 4242" mono />
            <Row k="Expires" v="24h" mono />
          </dl>
        </div>
        <p className="mt-3 text-[10.5px] leading-snug text-[#8b8b8b]">The card number is never shared with {agentName} or the store.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div aria-hidden className="flex h-11 items-center justify-center rounded-[8px] bg-white text-[14px] font-semibold text-black">
          Allow
        </div>
        <div aria-hidden className="flex h-11 items-center justify-center rounded-[8px] border border-[#2a2a2a] text-[13px] font-medium text-[#d1d1d1]">
          Deny
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[#8b8b8b]">{k}</dt>
      <dd className={mono ? "font-mono text-[11.5px]" : ""}>{v}</dd>
    </div>
  );
}
