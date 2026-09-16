import Image from "next/image";
import { AddedTag, APPROVE_T, CheckBurst, delay, FauxButton, VisaMark } from "../approve-bits";
import { LockIcon } from "../chat/icons";
import type { ApproveLayoutProps, ApproveVariant, CardFormTheme } from "./types";

/*
 * GrokBot (grok.com, SpaceXAI), as grok.com looks in September 2026 in its
 * light theme: warm off-white #f9f8f7, #050505 text, hairline borders, a
 * clean sans (no mono), filled buttons in #050505 with white text (8px
 * corners here), Deny as plain text. The header carries the Grok wordmark
 * from grok.com's own header.
 */
const BG = "#f9f8f7";
const INK = "#050505";
const MUTED = "#636363";
const LINE = "#e5e3df";

const form: CardFormTheme = {
  bg: BG,
  text: INK,
  muted: MUTED,
  border: LINE,
  field: "#ffffff",
  focus: INK,
  ring: "rgba(20, 20, 19, 0.12)",
  button: INK,
  buttonText: "#ffffff",
  radius: 8,
  fieldRadius: 8,
};

function GrokBotApprove({ agentName = "GrokBot", state }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4 antialiased" style={{ background: BG, color: INK }}>
      <div className="flex items-center gap-2">
        <Image src="/logos/grok-wordmark.svg" alt="Grok" width={88} height={33} className="h-[18px] w-auto" />
        <span className="text-[11px] font-medium" style={{ color: MUTED }}>
          / {agentName}
        </span>
      </div>

      {state === "approved" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
          <CheckBurst fill={INK} size={56} />
          <div className="landing-fade flex flex-col gap-2" style={delay(APPROVE_T.copy)}>
            <p className="text-[21px] leading-[1.15] font-semibold tracking-tight">Approved.</p>
            <p className="text-[13px] leading-snug">{agentName} can spend up to $8.00.</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>
              Visa ···· 4242 · expires in 24h
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="flex flex-col gap-3 rounded-[10px] border bg-white p-3.5" style={{ borderColor: LINE }}>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Card access request
              </p>
              <p className="text-[30px] leading-none font-semibold tracking-tight tabular-nums">$8.00</p>
              <dl className="flex flex-col gap-1 text-[12px]">
                <Row k="Agent" v={agentName} />
                <Row k="Purpose" v="Grande latte" />
                <Row k="Expires" v="24h" />
              </dl>
              <div className="flex flex-col gap-1.5 border-t pt-2.5" style={{ borderColor: LINE }}>
                <span className="text-[11px]" style={{ color: MUTED }}>
                  Card
                </span>
                {state === "empty" ? (
                  <>
                    <div aria-hidden className="flex h-10 items-center rounded-[8px] border px-3 text-[12px]" style={{ borderColor: LINE, color: MUTED }}>
                      No cards yet
                    </div>
                    <FauxButton press={APPROVE_T.addPress} className="h-10 rounded-[8px] text-[13px] text-white" style={{ background: INK }}>
                      Add a card
                    </FauxButton>
                  </>
                ) : (
                  <div aria-hidden className="landing-fade flex h-10 items-center gap-2 rounded-[8px] border px-3 text-[12px]" style={{ borderColor: LINE }}>
                    <VisaMark />
                    <span className="min-w-0 flex-1 truncate">Visa ···· 4242</span>
                    <AddedTag color={INK} />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug" style={{ color: MUTED }}>
              <LockIcon width={12} height={12} className="mt-px shrink-0" />
              The card number is never shared with {agentName} or the store.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <FauxButton
              disabled={state === "empty"}
              ready={state === "card"}
              press={state === "card" ? APPROVE_T.allowPress : undefined}
              ringColor="rgba(20, 20, 19, 0.16)"
              className="h-11 rounded-[8px] text-[14px] text-white"
              style={{ background: INK }}
            >
              Allow
            </FauxButton>
            <p className="text-center text-[12px] font-medium" style={{ color: MUTED }}>
              Deny
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: MUTED }}>{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

export const grokbot: ApproveVariant = { Screen: GrokBotApprove, form };
