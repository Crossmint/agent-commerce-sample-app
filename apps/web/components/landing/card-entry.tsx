import type { CSSProperties, ReactNode } from "react";
import { CARD_T, delay, FauxButton, Typed, VisaMark } from "./approve-bits";
import type { CardFormTheme } from "./approve-variants/types";
import { LockIcon } from "./chat/icons";

const NUMBER = "4242 4242 4242 4242";
const EXPIRY = "12/29";
const CVC = "•••";
const NAME = "Alex Rivera";
const ZIP = "10001";

/**
 * The card entry page, modeled on the real save-card step (Crossmint's PCI
 * form): Card number, Expiry, CVC, Name on card, ZIP, and a Save card
 * button. The digits type in one by one, the Visa mark appears once the
 * number is complete, and the focus ring moves down the form as each field
 * fills. `theme` restyles it for each brand. Not a real form: a picture.
 */
export function CardEntryScreen({ theme, agentName = "Your agent" }: { theme: CardFormTheme; agentName?: string }) {
  const t = theme;
  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4 antialiased" style={{ background: t.bg, color: t.text }}>
      <div className="flex flex-col gap-0.5">
        <p className="text-[17px] leading-tight font-semibold tracking-tight">Add a card</p>
        <p className="text-[11px] leading-snug" style={{ color: t.muted }}>
          {agentName} will be able to use it after you approve.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        <Field theme={t} label="Card number" from={CARD_T.number - 120} to={CARD_T.brand} trailing={<VisaMark at={CARD_T.brand} />}>
          <Typed text={NUMBER} at={CARD_T.number} speed={CARD_T.numberSpeed} className="tabular-nums" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field theme={t} label="Expiry" from={CARD_T.expiry} to={CARD_T.cvc} placeholder="MM/YY">
            <Typed text={EXPIRY} at={CARD_T.expiry + 40} speed={58} className="tabular-nums" />
          </Field>
          <Field theme={t} label="CVC" from={CARD_T.cvc} to={CARD_T.name} placeholder="123">
            <Typed text={CVC} at={CARD_T.cvc + 40} speed={64} />
          </Field>
        </div>
        <Field theme={t} label="Name on card" from={CARD_T.name} to={CARD_T.zip}>
          <Typed text={NAME} at={CARD_T.name + 40} speed={CARD_T.nameSpeed} />
        </Field>
        <Field theme={t} label="ZIP" from={CARD_T.zip} to={CARD_T.save} placeholder="00000">
          <Typed text={ZIP} at={CARD_T.zip + 40} speed={58} className="tabular-nums" />
        </Field>
      </div>

      <div className="flex flex-col gap-2.5">
        <FauxButton press={CARD_T.save} className="h-12 text-[14px]" style={{ background: t.button, color: t.buttonText, borderRadius: t.radius }}>
          Save card
        </FauxButton>
        <p className="flex items-center justify-center gap-1 text-[10px]" style={{ color: t.muted }}>
          <LockIcon width={10} height={10} strokeWidth={2.5} />
          Card details go straight to the PCI vault.
        </p>
      </div>
    </div>
  );
}

/**
 * One field. The focus ring shows from `from` to `to`. A placeholder sits in
 * the box until typing starts; a caret blinks at the end while focused.
 */
function Field({ theme: t, label, from, to, placeholder, trailing, children }: { theme: CardFormTheme; label: string; from: number; to: number; placeholder?: string; trailing?: ReactNode; children: ReactNode }) {
  const focus = { ...delay(from), "--dur": `${Math.max(to - from, 1)}ms`, "--field-border": t.border, "--field-focus": t.focus, "--field-ring": t.ring } as CSSProperties;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium" style={{ color: t.muted }}>
        {label}
      </span>
      <span
        className="landing-focus relative flex h-10 items-center border px-3 text-[12.5px]"
        style={{ ...focus, background: t.field, borderColor: t.border, borderRadius: t.fieldRadius }}
      >
        {placeholder ? (
          <span aria-hidden className="landing-vanish absolute left-3" style={{ ...delay(from + 40), color: t.muted }}>
            {placeholder}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 items-center overflow-hidden">
          {children}
          <span className="landing-caret" style={focus} />
        </span>
        {trailing ? <span className="ml-2 shrink-0">{trailing}</span> : null}
      </span>
    </label>
  );
}

/** Field values, for the accessible label of the whole screen. */
export const CARD_ENTRY_SUMMARY = `a card form filling in with ${NUMBER}, ${EXPIRY}, ${NAME}, ${ZIP}`;
