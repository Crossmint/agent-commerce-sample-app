import Image from "next/image";
import { AddedTag, APPROVE_T, CardSelect, CheckBurst, delay, FauxButton, VisaMark } from "../approve-bits";
import { LockIcon } from "../chat/icons";
import type { ApproveLayoutProps, ApproveVariant, CardFormTheme } from "./types";

/*
 * Lumen (lumen.ai), an example agent with a light, Meta-style UI that lives
 * in Instagram Direct: an off-white (#fcfcfc) page, the Lumen mark at the
 * top (a blue-to-violet circle with a white spark, original GOAT art),
 * near-black text on a cool gray scale, and one blue call to action. The
 * button carries a blue gradient (#0082FB to #0064E0 to #0040DC), 12px
 * corners.
 */
const MARK = "/logos/lumen.svg";
const BLUE = "linear-gradient(135deg, #0082FB 0%, #0064E0 60%, #0040DC 100%)";
const BG = "#fcfcfc";
const INK = "#111112";
const MUTED = "#717477";
const LINE = "#e0e2e4";
const FIELD = "#f3f4f5";

const form: CardFormTheme = {
  bg: BG,
  text: INK,
  muted: MUTED,
  border: LINE,
  field: "#ffffff",
  focus: "#0064e0",
  ring: "rgba(0, 100, 224, 0.2)",
  button: BLUE,
  buttonText: "#ffffff",
  radius: 12,
  fieldRadius: 12,
};

function LumenApprove({ state }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col px-4 pt-3 pb-4 antialiased" style={{ background: BG, color: INK }}>
      <Image src={MARK} alt="" width={26} height={26} className="size-[26px]" />

      {state === "approved" ? (
        <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-5">
          <CheckBurst fill={BLUE} size={60} />
          <div className="landing-fade flex flex-col gap-2" style={delay(APPROVE_T.copy)}>
            <p className="text-[21px] leading-[1.15] font-semibold tracking-tight">Approved.</p>
            <p className="text-[13px] leading-snug">Your agent can spend up to $8.00.</p>
            <p className="text-[11.5px]" style={{ color: MUTED }}>
              You can close this tab.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col pt-4">
            <p className="text-[17px] leading-[1.2] font-semibold tracking-tight">Your agent is requesting to use your card</p>
            <p className="mt-3 text-[34px] leading-none font-bold tracking-tight tabular-nums">$8.00</p>
            <p className="mt-1.5 text-[12px]" style={{ color: MUTED }}>
              Grande latte at Starbucks
            </p>

            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: MUTED }}>
                Choose card
              </span>
              {state === "empty" ? (
                <CardSelect className="h-11 text-[12.5px]" radius={form.fieldRadius} background={FIELD} border={FIELD} color={INK} iconColor={MUTED} />
              ) : (
                <div aria-hidden className="landing-fade flex h-11 items-center gap-2.5 rounded-[12px] px-3" style={{ background: FIELD }}>
                  <VisaMark />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[12.5px] font-medium">Visa •••• 4242</span>
                    <span className="text-[10.5px]" style={{ color: MUTED }}>
                      Default card
                    </span>
                  </span>
                  <AddedTag color="#0064e0" />
                </div>
              )}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[10.5px] leading-snug" style={{ color: MUTED }}>
              <LockIcon width={12} height={12} className="mt-px shrink-0" />
              Your card is never shared with the agent.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <FauxButton
              disabled={state === "empty"}
              ready={state === "card"}
              press={state === "card" ? APPROVE_T.allowPress : undefined}
              ringColor="rgba(0, 100, 224, 0.22)"
              className="h-11 rounded-[12px] text-[14px] text-white"
              style={{ background: BLUE }}
            >
              Allow
            </FauxButton>
            <p className="text-center text-[11.5px] font-medium" style={{ color: MUTED }}>
              Not now
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export const lumen: ApproveVariant = { Screen: LumenApprove, form };
