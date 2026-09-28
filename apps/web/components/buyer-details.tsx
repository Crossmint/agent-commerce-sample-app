"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { Pencil, UserRound } from "lucide-react";
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
  Skeleton,
  Spinner,
  errorMessage,
  useAgentCommerce,
  useBuyerProfile,
} from "@agent-commerce/ui";
import { cn } from "@/lib/cn";

/**
 * The buyer's name, contact and shipping address, which every checkout
 * starts with so the store does not ask. Shown as a summary with an Edit
 * button once saved, as a form before. The agent saves the same profile when
 * the user tells it their details in the chat.
 *
 * Saving makes a new profile rather than changing the old one (Crossmint has
 * no update call); the newest is the one checkouts use.
 */
export function BuyerDetails({ email, className }: { email?: string; className?: string }) {
  const profile = useBuyerProfile();
  const [editing, setEditing] = useState(false);

  if (profile.loading && profile.data === undefined) {
    return <Skeleton className={cn("h-40 w-full rounded-2xl", className)} />;
  }
  const saved = profile.data ?? undefined;
  if (saved && !editing) {
    return <Summary profile={saved} onEdit={() => setEditing(true)} className={className} />;
  }
  return (
    <DetailsForm
      initial={saved}
      email={email}
      className={className}
      onCancel={saved ? () => setEditing(false) : undefined}
      onSaved={async () => {
        await profile.refetch();
        setEditing(false);
      }}
    />
  );
}

function Summary({
  profile,
  onEdit,
  className,
}: {
  profile: BuyerProfile;
  onEdit: () => void;
  className?: string;
}) {
  const { name, contact, shipping } = profile;
  const region = [shipping.administrativeAreaCode?.split("-").pop(), shipping.postalCode]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserRound className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <p className="font-medium text-foreground">
          {name.first} {name.last}
        </p>
        {shipping.addressLines.map((line) => (
          <p key={line} className="text-muted-foreground">
            {line}
          </p>
        ))}
        <p className="text-muted-foreground">
          {[shipping.locality, region, shipping.countryCode].filter(Boolean).join(", ")}
        </p>
        <p className="text-muted-foreground">
          {[contact.email, contact.phone].filter(Boolean).join(" · ")}
        </p>
        {contact.phone ? null : (
          <p className="text-warning">
            No phone number yet. Stores often ask for one: edit to add it.
          </p>
        )}
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
        <Pencil /> Edit
      </Button>
    </div>
  );
}

function DetailsForm({
  initial,
  email,
  onSaved,
  onCancel,
  className,
}: {
  initial?: BuyerProfile;
  email?: string;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
  className?: string;
}) {
  const { api } = useAgentCommerce();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState(() => ({
    first: initial?.name.first ?? "",
    last: initial?.name.last ?? "",
    email: initial?.contact.email ?? email ?? "",
    phone: initial?.contact.phone ?? "",
    line1: initial?.shipping.addressLines[0] ?? "",
    line2: initial?.shipping.addressLines[1] ?? "",
    city: initial?.shipping.locality ?? "",
    region: initial?.shipping.administrativeAreaCode?.split("-").pop() ?? "",
    postalCode: initial?.shipping.postalCode ?? "",
    country: initial?.shipping.countryCode ?? "US",
  }));
  const [problems, setProblems] = useState<Partial<Record<FormKey, string>>>({});
  const set = (key: FormKey) => (e: { target: { value: string } }) => {
    setV((prev) => ({ ...prev, [key]: e.target.value }));
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
  const regionLabel =
    country === "US" ? "State" : country === "CA" ? "Province" : "State or province (optional)";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    // Trimmed, with the state as ISO 3166-2 ("CA" in the US is "US-CA"), the form Crossmint wants.
    const input = normalizeBuyerProfile({
      label: "Home",
      name: { first: v.first, last: v.last },
      contact: { email: v.email, phone: v.phone },
      shipping: {
        addressLines: [v.line1, v.line2],
        locality: v.city,
        administrativeAreaCode: v.region,
        postalCode: v.postalCode,
        countryCode: v.country,
      },
    });
    const found = buyerProfileProblems(input, { requirePhone: true });
    if (found.length) {
      setProblems(Object.fromEntries(found.map((p) => [FORM_KEY[p.field], p.message])));
      e.currentTarget
        .querySelector<HTMLInputElement>(`#${fieldId(FORM_KEY[found[0]!.field])}`)
        ?.focus();
      return;
    }
    setProblems({});
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

  const field = (key: FormKey) => ({
    id: fieldId(key),
    value: v[key],
    onChange: set(key),
    error: problems[key],
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" {...field("first")} required autoComplete="given-name" />
        <Field label="Last name" {...field("last")} required autoComplete="family-name" />
      </div>
      <Field label="Email" type="email" {...field("email")} required autoComplete="email" />
      {/* Stores ask for a phone on most checkouts, for the delivery. */}
      <Field label="Phone" type="tel" {...field("phone")} required autoComplete="tel" />
      <Field label="Address" {...field("line1")} required autoComplete="address-line1" />
      <Field label="Apartment, suite (optional)" {...field("line2")} autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" {...field("city")} required autoComplete="address-level2" />
        <Field
          label={regionLabel}
          {...field("region")}
          required={country === "US" || country === "CA"}
          autoComplete="address-level1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="ZIP or postal code"
          {...field("postalCode")}
          required
          autoComplete="postal-code"
        />
        <Field
          label="Country code"
          {...field("country")}
          required
          maxLength={2}
          autoComplete="country"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner /> : null}
          Save details
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
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
