"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FocusEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Mail,
  MapPin,
  Pencil,
  Phone,
  Receipt,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  buyerProfileProblems,
  normalizeBuyerProfile,
  type BuyerProfile,
  type BuyerProfileField,
} from "@agent-commerce/core";
import {
  Button,
  Input,
  Label,
  NativeSelect,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Skeleton,
  Spinner,
  errorMessage,
  useAgentCommerce,
  useBuyerProfile,
} from "@agent-commerce/ui";
import { CountryCodePicker, OWN_ESCAPE } from "@/components/country-code-picker";
import { cn } from "@/lib/cn";
import {
  COUNTRIES,
  callingCodeOf,
  flagOf,
  formatCallingCode,
  guessPhoneCountry,
  regionsOf,
  splitPhone,
} from "@/lib/countries";

/** The details sheet's title and line, the same wherever it opens. */
export const BUYER_DETAILS_TITLE = "Your details";
export const BUYER_DETAILS_NOTE = "Fill these in once. Your agent uses them at every checkout.";

/**
 * The buyer's name, contact and shipping address, which every checkout
 * starts with so the store does not ask. A card: the saved details with
 * Edit, or Set up when there are none. Both open the details sheet, the same
 * two steps the agent opens before a first purchase. The agent saves the
 * same profile when the user tells it their details in the chat.
 *
 * Saving makes a new profile rather than changing the old one (Crossmint has
 * no update call); the newest is the one checkouts use. Deleting removes all
 * of them, so the user starts over: the next purchase asks again.
 */
export function BuyerDetails({
  email,
  onEdit,
  className,
}: {
  email?: string;
  /**
   * Open the frame's own sheet with the form, the saved details in it, and
   * call `saved` once it saves. Leave it out for a desktop page: the card
   * opens a side sheet of its own.
   */
  onEdit?: (profile: BuyerProfile | undefined, saved: () => void) => void;
  className?: string;
}) {
  const { api } = useAgentCommerce();
  const profile = useBuyerProfile();
  const [open, setOpen] = useState(false);
  const saved = profile.data ?? undefined;
  const edit = () => (onEdit ? onEdit(saved, () => void profile.refetch()) : setOpen(true));

  if (profile.loading && profile.data === undefined) {
    return <Skeleton className={cn("h-40 w-full rounded-2xl", className)} />;
  }
  return (
    <>
      {saved ? (
        <Summary
          profile={saved}
          onEdit={edit}
          onDelete={async () => {
            await api.deleteBuyerProfile();
            await profile.refetch();
          }}
          className={className}
        />
      ) : (
        <NoDetails onSetUp={edit} className={className} />
      )}
      {onEdit ? null : (
        <BuyerDetailsSheet
          open={open}
          onOpenChange={setOpen}
          initial={saved}
          email={email}
          onSaved={async () => {
            await profile.refetch();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * The details sheet for a desktop page: docked to the right, the title with
 * a way out, the line under it, and the form. `headerAction` takes the close
 * button's place, such as Not now when the agent asked. The form mounts on
 * each opening, so it starts from the details as they are.
 */
export function BuyerDetailsSheet({
  open,
  onOpenChange,
  initial,
  email,
  submitLabel = "Save details",
  headerAction,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: BuyerProfile;
  email?: string;
  submitLabel?: string;
  headerAction?: ReactNode;
  onSaved: () => Promise<void> | void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        // An open list inside, such as the phone's countries, closes itself first.
        onEscapeKeyDown={(e) => {
          if ((e.target as Element | null)?.closest(`[${OWN_ESCAPE}]`)) e.preventDefault();
        }}
        className="w-full gap-6 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="pr-0">
          <div className="flex items-start gap-3">
            <SheetTitle className="flex-1">{BUYER_DETAILS_TITLE}</SheetTitle>
            {headerAction ?? (
              <SheetClose className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted-strong">
                <X className="size-4" />
                <span className="sr-only">Close</span>
              </SheetClose>
            )}
          </div>
          <SheetDescription>{BUYER_DETAILS_NOTE}</SheetDescription>
        </SheetHeader>
        {open ? (
          <BuyerDetailsForm
            initial={initial}
            email={email}
            submitLabel={submitLabel}
            onSaved={onSaved}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** No details yet: what they are for, and Set up, which opens the sheet. */
function NoDetails({ onSetUp, className }: { onSetUp: () => void; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <UserRound className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-foreground">No details yet</p>
        <p className="text-sm text-muted-foreground">
          Add your name, phone and shipping address once. Every checkout starts with them.
        </p>
      </div>
      <Button type="button" size="lg" onClick={onSetUp}>
        Set up
      </Button>
    </div>
  );
}

/**
 * The saved details as a card: who the buyer is at the top, with Edit, then
 * what a checkout uses, one row each: the phone, where orders ship, and the
 * billing address, which is the shipping one. Delete sits at the foot, and
 * asks first.
 */
function Summary({
  profile,
  onEdit,
  onDelete,
  className,
}: {
  profile: BuyerProfile;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { name, contact, shipping } = profile;
  const region = shipping.administrativeAreaCode?.split("-").pop();
  const country = COUNTRIES.find((c) => c.code === shipping.countryCode);
  const phone = contact.phone ? splitPhone(contact.phone, shipping.countryCode) : undefined;
  const initials = `${name.first.charAt(0)}${name.last.charAt(0)}`.toUpperCase();

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-base font-medium text-foreground">
            {name.first} {name.last}
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Mail aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onEdit}>
          <Pencil /> Edit
        </Button>
      </div>

      <dl className="flex flex-col border-t border-border/60">
        <Row icon={Phone} label="Phone">
          {contact.phone ? (
            phone ? (
              <span className="tabular-nums">
                <span aria-hidden className="mr-1.5">
                  {flagOf(phone.country)}
                </span>
                {formatCallingCode(callingCodeOf(phone.country) ?? "")} {phone.national}
              </span>
            ) : (
              <span className="tabular-nums">{contact.phone}</span>
            )
          ) : (
            <span className="text-warning">
              None yet. Stores often ask for one: edit to add it.
            </span>
          )}
        </Row>
        <Row icon={MapPin} label="Ships to">
          {shipping.addressLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <span className="block">
            {[shipping.locality, [region, shipping.postalCode].filter(Boolean).join(" ")]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span className="block">
            <span aria-hidden className="mr-1.5">
              {flagOf(shipping.countryCode)}
            </span>
            {country?.name ?? shipping.countryCode}
          </span>
        </Row>
        {/* What every checkout is told: bill the shipping address. */}
        <Row icon={Receipt} label="Billing">
          Same as shipping
        </Row>
      </dl>

      <div className="border-t border-border/60 bg-muted/40 px-4 py-3">
        {confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              Delete your details? The next purchase asks for them again.
            </p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={remove}
              >
                {busy ? <Spinner /> : <Trash2 />}
                Delete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
              >
                Keep them
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-destructive underline-offset-4 hover:underline"
          >
            <Trash2 aria-hidden className="size-3.5" />
            Delete details
          </button>
        )}
      </div>
    </div>
  );
}

/** One fact of the saved details: a round mark, what it is, and its value. */
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Phone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm text-foreground">{children}</dd>
      </div>
    </div>
  );
}

/**
 * The details as a form the browser can fill in. Every field carries its
 * standard `autocomplete` token and name, all in one section, so one pick
 * from the browser's saved addresses fills the name, the contact and the
 * address together. Country, state and province are lists, which autofill
 * matches by code or by name.
 *
 * It comes in two steps, for a first save and an edit alike: who the
 * buyer is, then where orders go. Each step is still one pick from the
 * browser's saved addresses, which fills every field it shows.
 */
export function BuyerDetailsForm({
  initial,
  email,
  onSaved,
  submitLabel = "Save details",
  className,
}: {
  initial?: BuyerProfile;
  email?: string;
  onSaved: () => Promise<void> | void;
  submitLabel?: string;
  className?: string;
}) {
  const { api } = useAgentCommerce();
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A saved number starts the picker at its own country; a new one at the browser's.
  const [savedPhone] = useState(() =>
    initial?.contact.phone ? splitPhone(initial.contact.phone, "US") : undefined,
  );
  const [phoneCountry, setPhoneCountry] = useState(
    () => savedPhone?.country ?? guessPhoneCountry(),
  );
  const [v, setV] = useState(() => ({
    first: initial?.name.first ?? "",
    last: initial?.name.last ?? "",
    email: initial?.contact.email ?? email ?? "",
    phone: savedPhone ? savedPhone.national : (initial?.contact.phone ?? ""),
    line1: initial?.shipping.addressLines[0] ?? "",
    line2: initial?.shipping.addressLines[1] ?? "",
    city: initial?.shipping.locality ?? "",
    region: initial?.shipping.administrativeAreaCode?.split("-").pop() ?? "",
    postalCode: initial?.shipping.postalCode ?? "",
    country: initial?.shipping.countryCode ?? "US",
  }));
  const [problems, setProblems] = useState<Partial<Record<FormKey, string>>>({});
  const set = (key: FormKey) => (e: { target: { value: string } }) => {
    let value = e.target.value;
    // A number typed or filled in with its country code moves the code to
    // the picker: "+44 20 7946 0958" picks GB and keeps "20 7946 0958".
    if (key === "phone") {
      const split = splitPhone(value, phoneCountry);
      if (split) {
        setPhoneCountry(split.country);
        value = split.national;
      }
    }
    setV((prev) => {
      const next = { ...prev, [key]: value };
      // A state from another country does not carry over. Autofill sets the
      // country before the state, so a filled state is not lost.
      if (key === "country" && value !== prev.country) {
        const kept = regionsOf(value.toUpperCase())?.options.some((r) => r.code === prev.region);
        if (!kept) next.region = "";
      }
      return next;
    });
    // A field the user is fixing stops showing its problem. The state is
    // checked against the country, so a new country clears it too.
    const cleared: FormKey[] = key === "country" ? [key, "region"] : [key];
    setProblems((prev) =>
      cleared.some((k) => prev[k])
        ? { ...prev, ...Object.fromEntries(cleared.map((k) => [k, undefined])) }
        : prev,
    );
  };
  const country = v.country.trim().toUpperCase();
  const regions = regionsOf(country);

  // A new step starts at its first field, where the browser offers to fill it.
  useEffect(() => {
    if (step === 0) return;
    form.current?.querySelector<HTMLElement>(`#${fieldId(STEPS[step]!.focus)}`)?.focus();
  }, [step]);

  /** The step a field is on. */
  const stepOf = (key: FormKey) => STEPS.findIndex((s) => s.keys.includes(key));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Optional outside the US and Canada, where autofill often puts in a
    // name ("Madrid") and Crossmint wants a code. A name is left out: the
    // postal code already says where the address is.
    const region = regions || /^[A-Za-z0-9]{1,3}$/.test(v.region.trim()) ? v.region : "";
    // Trimmed, with the state as ISO 3166-2 ("CA" in the US is "US-CA"), the form Crossmint wants.
    const input = normalizeBuyerProfile({
      label: "Home",
      name: { first: v.first, last: v.last },
      contact: { email: v.email, phone: withCallingCode(v.phone, phoneCountry) },
      shipping: {
        addressLines: [v.line1, v.line2],
        locality: v.city,
        administrativeAreaCode: region,
        postalCode: v.postalCode,
        countryCode: v.country,
      },
    });
    // Only this step and the ones before it count until the last.
    const found = buyerProfileProblems(input, { requirePhone: true }).filter(
      (p) => stepOf(FORM_KEY[p.field]) <= step,
    );
    if (found.length) {
      setProblems(Object.fromEntries(found.map((p) => [FORM_KEY[p.field], p.message])));
      const first = FORM_KEY[found[0]!.field];
      if (stepOf(first) !== step) setStep(stepOf(first));
      else form.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)?.focus();
      return;
    }
    setProblems({});
    if (!last) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await api.createBuyerProfile(input);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // The autocomplete token doubles as the name: password managers read names.
  const field = (key: FormKey) => ({
    id: fieldId(key),
    name: AUTOCOMPLETE[key],
    autoComplete: AUTOCOMPLETE[key],
    value: v[key],
    onChange: set(key),
    error: problems[key],
    className: FIELD,
  });

  // Once more on leaving the field, from what the field holds: a browser can
  // fill it without the input event the change handler hears, and leave the
  // code in the number.
  const splitOnBlur = (e: FocusEvent<HTMLInputElement>) => {
    const split = splitPhone(e.currentTarget.value, phoneCountry);
    if (!split) return;
    setPhoneCountry(split.country);
    setV((prev) => ({ ...prev, phone: split.national }));
  };

  const about = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" {...field("first")} required />
        <Field label="Last name" {...field("last")} required />
      </div>
      <Field label="Email" type="email" inputMode="email" {...field("email")} required />
      {/* Stores ask for a phone on most checkouts, for the delivery. */}
      <PhoneField
        label="Phone"
        type="tel"
        inputMode="tel"
        {...field("phone")}
        onBlur={splitOnBlur}
        required
        country={phoneCountry}
        onCountry={(c) => {
          setPhoneCountry(c);
          setProblems((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
        }}
        boxClassName={PICKER}
      />
    </>
  );

  const address = (
    <>
      <SelectField label="Country" {...field("country")} required>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <Field label="Address" {...field("line1")} required />
      <Field label="Apartment, suite (optional)" {...field("line2")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" {...field("city")} required />
        {regions ? (
          <SelectField label={regions.label} {...field("region")} required>
            <option value="" disabled>
              Choose
            </option>
            {regions.options.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </SelectField>
        ) : (
          <Field label="State or province (optional)" {...field("region")} />
        )}
      </div>
      <Field label="ZIP or postal code" {...field("postalCode")} required />
    </>
  );

  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      autoComplete="on"
      className={cn("flex flex-col gap-4", className)}
    >
      <StepHeader step={step} />
      {/* Keyed by step, so each one slides in. */}
      <div
        key={step}
        className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:animate-none"
      >
        {step === 0 ? about : address}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {/* The sheet's header closes it; the form only goes back, or on. */}
      <div className="flex gap-2">
        {step > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="xl"
            disabled={busy}
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            Back
          </Button>
        ) : null}
        <Button type="submit" size="xl" className="flex-1" disabled={busy}>
          {busy ? <Spinner /> : null}
          {last ? submitLabel : "Continue"}
        </Button>
      </div>
    </form>
  );
}

/**
 * The form's steps, in order, with the fields each one shows and
 * the one it starts at. Each is one pick from the browser's saved addresses.
 */
const STEPS: ReadonlyArray<{ title: string; keys: readonly FormKey[]; focus: FormKey }> = [
  { title: "About you", keys: ["first", "last", "email", "phone"], focus: "first" },
  {
    title: "Where should orders go?",
    keys: ["country", "line1", "line2", "city", "region", "postalCode"],
    focus: "line1",
  },
];

/** Where the form stands: a bar per step, filled up to this one, and its title. */
function StepHeader({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.title}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i <= step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </p>
        <h3 className="text-base font-medium text-foreground">{STEPS[step]!.title}</h3>
      </div>
    </div>
  );
}

/** The form's own names for its inputs. */
type FormKey =
  | "first"
  | "last"
  | "email"
  | "phone"
  | "line1"
  | "line2"
  | "city"
  | "region"
  | "postalCode"
  | "country";

/** Which input shows each problem the checks find. */
const FORM_KEY: Record<BuyerProfileField, FormKey> = {
  firstName: "first",
  lastName: "last",
  email: "email",
  phone: "phone",
  addressLine1: "line1",
  city: "city",
  region: "region",
  postalCode: "postalCode",
  countryCode: "country",
};

/**
 * The fields, as the phone's other forms draw them (logging in, adding a
 * card): tall enough to tap, and 16px at every width. iOS zooms the page
 * into a field whose text is smaller, and the kit's own field drops to 14px
 * on a wide screen, such as a phone on its side.
 */
const FIELD = "h-12 rounded-xl border-0 bg-muted px-4 text-base shadow-none md:text-base";

/** The phone's country picker, drawn as the field beside it. */
const PICKER = "h-12 rounded-xl bg-muted";

/**
 * The number as it is saved: with its country's calling code in front,
 * "+1 415 555 0100". A number that still starts with + keeps its own.
 */
function withCallingCode(national: string, country: string): string {
  const number = national.trim();
  const code = callingCodeOf(country);
  if (!number || !code || number.startsWith("+")) return number;
  return `+${code} ${number}`;
}

/** The standard autofill token for each input, in the one default section. */
const AUTOCOMPLETE: Record<FormKey, string> = {
  first: "given-name",
  last: "family-name",
  email: "email",
  phone: "tel",
  line1: "address-line1",
  line2: "address-line2",
  city: "address-level2",
  region: "address-level1",
  postalCode: "postal-code",
  country: "country",
};

const fieldId = (key: FormKey) => `buyer-${key}`;

function Field({
  label,
  id,
  error,
  ...input
}: { label: string; id: string; error?: string } & ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** A list in the same frame as `Field`: the label, the select, and its problem. */
function SelectField({
  label,
  id,
  error,
  children,
  ...select
}: { label: string; id: string; error?: string } & ComponentProps<typeof NativeSelect>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...select}
        // Room for the chevron, which a field's own padding would take.
        className={cn(select.className, "pr-10")}
      >
        {children}
      </NativeSelect>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The phone number with its country in front: a flag and the calling code,
 * which opens the list of countries, then the number. The number keeps the
 * `tel` autofill token, so the browser fills it whole; a number filled or
 * typed with its code moves the code to the picker. The picker is a button
 * with a list to search, which no browser fills: by code alone it could
 * land on another country of the same code.
 */
function PhoneField({
  label,
  id,
  error,
  country,
  onCountry,
  boxClassName,
  ...input
}: {
  label: string;
  id: string;
  error?: string;
  country: string;
  onCountry: (country: string) => void;
  boxClassName: string;
} & ComponentProps<typeof Input>) {
  const errorId = `${id}-error`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex gap-2">
        <CountryCodePicker value={country} onChange={onCountry} className={boxClassName} />
        <Input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
          className={cn("min-w-0 flex-1", input.className)}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
