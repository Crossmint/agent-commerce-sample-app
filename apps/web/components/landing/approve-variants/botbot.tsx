import Image from "next/image";
import { AddedTag, APPROVE_T, CardSelect, CheckBurst, delay, FauxButton, VisaMark } from "../approve-bits";
import { LockIcon } from "../chat/icons";
import type { ApproveLayoutProps, ApproveVariant, CardFormTheme } from "./types";

/*
 * BotBot (botbot.dev), an example agent messaged in its own app. A white
 * page, #0a0a0a ink, muted text at 60% ink, light warm-gray surfaces,
 * hairline borders, pill buttons filled #0a0a0a with white text, and the
 * BotBot mark (a black rounded square with two round white eyes and a small
 * antenna, original GOAT art) set inline before the name.
 */
export const BOTBOT_MARK = "/logos/botbot.svg";
const BG = "#ffffff";
const INK = "#0a0a0a";
const MUTED = "rgba(20, 20, 20, 0.6)";
const SURFACE = "#f5f5f3";
const LINE = "#e6e5e2";

const form: CardFormTheme = {
  bg: BG,
  text: INK,
  muted: MUTED,
  border: LINE,
  field: SURFACE,
  focus: INK,
  ring: "rgba(10, 10, 10, 0.12)",
  button: INK,
  buttonText: "#ffffff",
  radius: 9999,
  fieldRadius: 12,
};

/** The BotBot mark next to the name, one weight, tight tracking. */
export function BotBotWordmark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span className={className ? `inline-flex items-center gap-1.5 ${className}` : "inline-flex items-center gap-1.5"}>
      <Image src={BOTBOT_MARK} alt="" width={size} height={size} className="rounded-[4px]" style={{ width: size, height: size }} />
      <span className="font-medium tracking-tight" style={{ fontSize: size * 0.78, color: INK }}>
        BotBot
      </span>
    </span>
  );
}

function BotBotApprove({ state }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col px-4 pt-3 pb-3 antialiased" style={{ background: BG, color: INK }}>
      <BotBotWordmark size={18} />

      {state === "approved" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
          <CheckBurst fill={INK} size={56} />
          <div className="landing-fade flex flex-col gap-2" style={delay(APPROVE_T.copy)}>
            <p className="text-[21px] leading-[1.15] font-medium tracking-tight">Approved.</p>
            <p className="text-[13px] leading-snug">Your agent can spend up to $8.00.</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>
              You can close this tab.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="flex flex-col gap-2.5 rounded-[14px] border p-3.5" style={{ background: SURFACE, borderColor: LINE }}>
              <p className="text-[11px]" style={{ color: MUTED }}>
                Your agent is requesting to use your card
              </p>
              <p className="text-[26px] leading-none font-medium tracking-tight tabular-nums">$8.00</p>
              <dl className="flex flex-col gap-0.5 text-[11.5px]">
                <Row k="Purpose" v="Grande latte" />
                <Row k="Expires" v="24h" />
              </dl>
              <div className="flex flex-col gap-1.5 border-t pt-2.5" style={{ borderColor: LINE }}>
                <span className="text-[11px]" style={{ color: MUTED }}>
                  Choose card
                </span>
                {state === "empty" ? (
                  <CardSelect radius={form.fieldRadius} background={BG} border={LINE} color={INK} iconColor={MUTED} />
                ) : (
                  <div aria-hidden className="landing-fade flex h-10 items-center gap-2 rounded-[12px] border bg-white px-3 text-[12px]" style={{ borderColor: LINE }}>
                    <VisaMark />
                    <span className="min-w-0 flex-1 truncate">Visa ···· 4242</span>
                    <AddedTag color={INK} />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2.5 flex items-start gap-1.5 text-[10.5px] leading-snug" style={{ color: MUTED }}>
              <LockIcon width={12} height={12} className="mt-px shrink-0" />
              Your card is never shared with the agent.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <FauxButton
              disabled={state === "empty"}
              ready={state === "card"}
              press={state === "card" ? APPROVE_T.allowPress : undefined}
              ringColor="rgba(10, 10, 10, 0.16)"
              className="h-10 rounded-full text-[13.5px] font-medium text-white"
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
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}

export const botbot: ApproveVariant = { Screen: BotBotApprove, form };
