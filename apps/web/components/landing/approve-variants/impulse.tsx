import Image from "next/image";
import { AddedTag, APPROVE_T, CardSelect, CheckBurst, delay, FauxButton } from "../approve-bits";
import { ChevronDownIcon, LockIcon } from "../chat/icons";
import type { ApproveLayoutProps, ApproveVariant, CardFormTheme } from "./types";

/*
 * Impulse (impulse.app), an example agent that lives in iMessage. A white
 * page, near-black text, "Impulse is requesting to use your card", plain
 * "Purpose:" and "Limit:" lines, a "Choose card" heading over a select with
 * a small card thumbnail and a chevron, the lock line, and one large
 * full-width orange Allow (#ff5a1f to #f4511e, 12px corners, bold white).
 * The mark is a dark rounded tile with a white bolt (original GOAT art).
 */
const ORANGE = "linear-gradient(180deg, #ff5a1f 0%, #f4511e 100%)";
const INK = "#0d0d0d";
const MUTED = "#6b6b6b";
const LINE = "#d9d9d9";

const form: CardFormTheme = {
  bg: "#ffffff",
  text: INK,
  muted: MUTED,
  border: LINE,
  field: "#ffffff",
  focus: "#f4511e",
  ring: "rgba(244, 81, 30, 0.22)",
  button: ORANGE,
  buttonText: "#ffffff",
  radius: 12,
  fieldRadius: 12,
};

function ImpulseApprove({ agentName = "Impulse", logo, state }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col bg-white px-4 pt-3 pb-4 antialiased" style={{ color: INK }}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-tight">
        {logo ? <Image src={logo} alt="" width={18} height={18} className="size-[18px] rounded-[4px] border border-black/10" /> : null}
        {agentName}
      </div>

      {state === "approved" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-5">
          <CheckBurst fill={ORANGE} size={60} />
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
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 pt-5">
            <p className="text-[18px] leading-[1.2] font-semibold tracking-tight">Your agent is requesting to use your card</p>

            <div className="flex flex-col gap-1 text-[12px] leading-snug">
              <p>
                <span style={{ color: MUTED }}>Purpose:</span> Grande latte at Starbucks
              </p>
              <p>
                <span style={{ color: MUTED }}>Limit:</span> $8.00
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium">Choose card</span>
              {state === "empty" ? (
                <CardSelect className="h-11 text-[12.5px]" radius={form.fieldRadius} background="#ffffff" border={LINE} color={INK} iconColor={MUTED} />
              ) : (
                <div aria-hidden className="landing-fade flex h-11 items-center gap-2.5 rounded-[12px] border px-3 text-[12.5px]" style={{ borderColor: LINE }}>
                  <span className="inline-flex h-[18px] w-[27px] shrink-0 flex-col justify-between overflow-hidden rounded-[3px] bg-gradient-to-br from-[#1a1f71] to-[#0b0e3a] p-[3px]">
                    <span className="block h-[3px] w-full rounded-[1px] bg-white/25" />
                    <span className="block h-[3px] w-[45%] rounded-[1px] bg-white/60" />
                  </span>
                  <span className="flex-1 truncate">Visa ••••4242</span>
                  <AddedTag color="#f4511e" />
                  <ChevronDownIcon width={16} height={16} style={{ color: MUTED }} />
                </div>
              )}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: MUTED }}>
              <LockIcon width={13} height={13} className="mt-px shrink-0" />
              Your card is never shared with the agent.
            </p>
          </div>

          <FauxButton
            disabled={state === "empty"}
            ready={state === "card"}
            press={state === "card" ? APPROVE_T.allowPress : undefined}
            ringColor="rgba(244, 81, 30, 0.3)"
            className="h-11 rounded-[12px] text-[15px] font-bold text-white"
            style={{ background: ORANGE }}
          >
            Allow
          </FauxButton>
        </>
      )}
    </div>
  );
}

export const impulse: ApproveVariant = { Screen: ImpulseApprove, form };
