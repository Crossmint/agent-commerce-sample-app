"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { Pencil, UserRound } from "lucide-react";
import type { BuyerProfile, BuyerProfileInput } from "@agent-commerce/core";
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
  const set = (key: keyof typeof v) => (e: { target: { value: string } }) =>
    setV((prev) => ({ ...prev, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const country = v.country.trim().toUpperCase();
    const region = v.region.trim().toUpperCase();
    const input: BuyerProfileInput = {
      label: "Home",
      name: { first: v.first.trim(), last: v.last.trim() },
      contact: { email: v.email.trim(), phone: v.phone.trim() },
      shipping: {
        addressLines: [v.line1.trim(), v.line2.trim()].filter(Boolean),
        locality: v.city.trim(),
        // ISO 3166-2, the form Crossmint wants: "CA" in the US is "US-CA".
        ...(region
          ? { administrativeAreaCode: region.includes("-") ? region : `${country}-${region}` }
          : {}),
        postalCode: v.postalCode.trim(),
        countryCode: country,
      },
    };
    try {
      await api.createBuyerProfile(input);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          value={v.first}
          onChange={set("first")}
          required
          autoComplete="given-name"
        />
        <Field
          label="Last name"
          value={v.last}
          onChange={set("last")}
          required
          autoComplete="family-name"
        />
      </div>
      <Field
        label="Email"
        type="email"
        value={v.email}
        onChange={set("email")}
        required
        autoComplete="email"
      />
      {/* Stores ask for a phone on most checkouts, for the delivery. */}
      <Field
        label="Phone"
        type="tel"
        value={v.phone}
        onChange={set("phone")}
        required
        autoComplete="tel"
      />
      <Field
        label="Address"
        value={v.line1}
        onChange={set("line1")}
        required
        autoComplete="address-line1"
      />
      <Field
        label="Apartment, suite (optional)"
        value={v.line2}
        onChange={set("line2")}
        autoComplete="address-line2"
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="City"
          value={v.city}
          onChange={set("city")}
          required
          autoComplete="address-level2"
        />
        <Field
          label="State (optional)"
          value={v.region}
          onChange={set("region")}
          autoComplete="address-level1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="ZIP or postal code"
          value={v.postalCode}
          onChange={set("postalCode")}
          required
          autoComplete="postal-code"
        />
        <Field
          label="Country code"
          value={v.country}
          onChange={set("country")}
          required
          maxLength={2}
          pattern="[A-Za-z]{2}"
          title="Two letters, such as US"
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

function Field({ label, ...input }: { label: string } & ComponentProps<typeof Input>) {
  const id = `buyer-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} {...input} />
    </div>
  );
}
