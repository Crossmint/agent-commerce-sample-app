import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronLeft, Lock } from "lucide-react";
import { CardBadge, delay, FauxButton, Typed, typedFor } from "./bits";
import { STORY } from "./story";

/*
 * Saved cards. The page opens empty, "Add a card" presses, the Crossmint
 * card form slides up as a sheet and fills itself in, Save presses, the
 * sheet leaves, and the new card sits in the list. One CSS timeline from
 * mount, about six seconds.
 */

const NUMBER = "4242 4242 4242 4242";
const EXPIRY = "12/29";
const CVC = "•••";
const NAME = "Alex Rivera";

const T = (() => {
  const addPress = 300;
  const sheet = 650;
  const number = sheet + 500;
  const expiry = number + typedFor(NUMBER, 58) + 200;
  const cvc = expiry + typedFor(EXPIRY, 70) + 220;
  const name = cvc + typedFor(CVC, 80) + 220;
  const save = name + typedFor(NAME, 46) + 320;
  const leave = save + 450;
  const saved = leave + 350;
  return { addPress, sheet, number, expiry, cvc, name, save, leave, saved };
})();

/** When the saved card has landed, ms from mount. */
export const CARDS_END = T.saved + 400;

export function CardsScreen() {
  const sheetTiming = { ...delay(T.sheet), "--leave": `${T.leave}ms` } as CSSProperties;
  return (
    <div className="relative flex h-full flex-col bg-background text-foreground">
      <div className="flex items-center gap-1 px-3 pt-11 pb-1">
        <ChevronLeft className="size-5" strokeWidth={2} />
        <span className="text-[12.5px] font-medium">Wallet</span>
      </div>
      <div className="flex flex-col gap-1 px-5 pt-3">
        <h2 className="text-[22px] leading-[1.2] font-medium tracking-[-0.02em]">Saved cards</h2>
        <p className="text-[11.5px] text-muted-foreground">Cards your agents can ask to use.</p>
      </div>

      <div className="relative mt-4 flex flex-col gap-3 px-5">
        {/* The empty state goes when the card arrives. */}
        <div
          className="landing-vanish flex flex-col items-center gap-1 rounded-2xl bg-muted px-4 py-6 text-center"
          style={delay(T.saved)}
        >
          <span className="text-[12px] font-medium">No cards yet</span>
          <span className="text-[11px] text-muted-foreground">
            Add one and your agents can ask to use it.
          </span>
        </div>
        <div
          className="landing-pop absolute inset-x-5 top-0 flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
          style={delay(T.saved)}
        >
          <CardBadge />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12.5px] leading-tight font-semibold">{STORY.card}</span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">
              Expires {EXPIRY} · Default
            </span>
          </div>
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 px-5 pb-9">
        <FauxButton press={T.addPress} className="w-full">
          Add a card
        </FauxButton>
        <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Lock className="size-2.5" strokeWidth={2.5} />
          Saved in Crossmint&rsquo;s PCI vault
        </p>
      </div>

      {/* The card form, Crossmint's PCI component, as a sheet that comes and goes. */}
      <div
        aria-hidden
        className="landing-scrim-leave absolute inset-0 z-30 bg-black/10"
        style={sheetTiming}
      />
      <div
        className="landing-sheet-leave absolute inset-x-0 bottom-0 z-40 flex flex-col gap-3 rounded-t-[calc(var(--radius)+18px)] bg-background px-5 pt-3 pb-7"
        style={sheetTiming}
      >
        <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-muted-strong" />
        <div className="flex flex-col gap-0.5">
          <p className="text-[17px] leading-tight font-semibold tracking-[-0.02em]">Add a card</p>
          <p className="text-[11px] text-muted-foreground">
            The number goes straight to Crossmint. It never touches this app.
          </p>
        </div>
        <Field
          label="Card number"
          from={T.number - 150}
          to={T.expiry}
          trailing={<CardBadge at={T.expiry - 150} />}
        >
          <Typed text={NUMBER} at={T.number} speed={58} className="tabular-nums" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Expiry" from={T.expiry} to={T.cvc} placeholder="MM/YY">
            <Typed text={EXPIRY} at={T.expiry + 60} speed={70} className="tabular-nums" />
          </Field>
          <Field label="CVC" from={T.cvc} to={T.name} placeholder="123">
            <Typed text={CVC} at={T.cvc + 60} speed={80} />
          </Field>
        </div>
        <Field label="Name on card" from={T.name} to={T.save}>
          <Typed text={NAME} at={T.name + 60} speed={46} />
        </Field>
        <FauxButton press={T.save} className="mt-1 h-11 w-full">
          Save card
        </FauxButton>
      </div>
    </div>
  );
}

/**
 * One field. The focus ring shows from `from` to `to`. A placeholder sits in
 * the box until typing starts; a caret blinks at the end while focused.
 */
function Field({
  label,
  from,
  to,
  placeholder,
  trailing,
  children,
}: {
  label: string;
  from: number;
  to: number;
  placeholder?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const focus = { ...delay(from), "--dur": `${Math.max(to - from, 1)}ms` } as CSSProperties;
  return (
    <span className="flex flex-col gap-1">
      <span className="text-[10.5px] leading-tight font-medium text-muted-foreground">{label}</span>
      <span
        className="landing-focus relative flex h-9 items-center rounded-xl border border-border bg-background px-3 text-[12px]"
        style={focus}
      >
        {placeholder ? (
          <span
            aria-hidden
            className="landing-vanish absolute left-3 text-muted-foreground"
            style={delay(from + 40)}
          >
            {placeholder}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 items-center overflow-hidden">
          {children}
          <span className="landing-caret" style={focus} />
        </span>
        {trailing ? <span className="ml-2 shrink-0">{trailing}</span> : null}
      </span>
    </span>
  );
}
