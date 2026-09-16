import Image from "next/image";
import { AddedTag, APPROVE_T, CardSelect, CheckBurst, delay, FauxButton, VisaMark } from "../approve-bits";
import { LockIcon } from "../chat/icons";
import type { ApproveLayoutProps, ApproveVariant, CardFormTheme } from "./types";

/*
 * The template's own theme: dark warm ground, one orange accent, square
 * corners. Same structure as `ApproveAgentCard` in @goat-wallet/ui: headline,
 * Purpose and Limit, "Choose card", a lock line, full-width Allow, quiet Deny.
 */
const C = {
  bg: "#14140f",
  card: "#1c1c15",
  text: "#f3efe6",
  muted: "#a39e90",
  border: "#2f2f26",
  input: "#34342a",
  primary: "#e8632b",
  onPrimary: "#fff8f2",
};

const form: CardFormTheme = {
  bg: C.bg,
  text: C.text,
  muted: C.muted,
  border: C.input,
  field: C.card,
  focus: C.primary,
  ring: "rgba(232, 99, 43, 0.28)",
  button: C.primary,
  buttonText: C.onPrimary,
  radius: 6,
  fieldRadius: 6,
};

function GoatApprove({ agentName = "Your agent", state }: ApproveLayoutProps) {
  return (
    <div className="flex h-full flex-col p-3 antialiased" style={{ background: C.bg, color: C.text }}>
      <div className="flex items-center gap-2 px-1 pt-0.5 text-[12px] font-semibold tracking-tight">
        <Image src="/brand/mark.png" alt="" width={18} height={18} className="size-[18px] rounded-sm" />
        yourplatform
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {state === "approved" ? (
          <div className="flex flex-col items-start gap-4 rounded-md border p-4" style={{ background: C.card, borderColor: C.border }}>
            <CheckBurst fill={C.primary} color={C.onPrimary} size={52} />
            <div className="landing-fade flex flex-col gap-1.5" style={delay(APPROVE_T.copy)}>
              <p className="text-[19px] leading-tight font-semibold tracking-tight">Approved.</p>
              <p className="text-[13px] leading-snug">{agentName} can spend up to $8.00.</p>
              <p className="text-[11px]" style={{ color: C.muted }}>
                Visa •••• 4242 · one purchase · expires in 24h
              </p>
            </div>
            <p className="landing-fade text-[11px]" style={{ ...delay(APPROVE_T.copy + 200), color: C.muted }}>
              You can close this tab.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 rounded-md border p-3.5" style={{ background: C.card, borderColor: C.border }}>
            <p className="text-[16px] leading-tight font-semibold tracking-tight">{agentName} is requesting to use your card</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
              <dt style={{ color: C.muted }}>Purpose</dt>
              <dd className="font-medium">Grande latte at Starbucks</dd>
              <dt style={{ color: C.muted }}>Limit</dt>
              <dd className="font-medium">$8.00</dd>
            </dl>

            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium">Choose card</span>
              {state === "empty" ? (
                <CardSelect radius={form.fieldRadius} background={C.bg} border={C.input} color={C.text} iconColor={C.muted} />
              ) : (
                <div aria-hidden className="landing-fade flex h-10 items-center gap-2 rounded-md border px-3 text-[12px]" style={{ borderColor: C.input, background: C.bg }}>
                  <VisaMark />
                  <span className="min-w-0 flex-1 truncate">Visa •••• 4242</span>
                  <AddedTag color={C.primary} />
                </div>
              )}
            </div>

            <p className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: C.muted }}>
              <LockIcon width={13} height={13} className="mt-px shrink-0" />
              Your card number is never shared with the agent or the store.
            </p>

            <div className="flex flex-col items-center gap-1.5">
              <FauxButton
                disabled={state === "empty"}
                ready={state === "card"}
                press={state === "card" ? APPROVE_T.allowPress : undefined}
                ringColor="rgba(232, 99, 43, 0.35)"
                className="h-10 w-full rounded-md text-[14px]"
                style={{ background: C.primary, color: C.onPrimary }}
              >
                Allow
              </FauxButton>
              <span className="text-[11px] font-semibold" style={{ color: C.muted }}>
                Deny
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const goat: ApproveVariant = { Screen: GoatApprove, form };
