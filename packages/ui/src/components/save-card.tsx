"use client";

import * as React from "react";
import { CrossmintPaymentMethodManagement } from "@crossmint/client-sdk-react-ui";
import type { PaymentMethod, RegistrationRail } from "@goat-wallet/core";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { errorMessage } from "../api/client.js";
import { paymentMethodAppearanceFromTheme } from "../lib/appearance.js";
import { paymentMethodLabel, registrationRailLabel } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { useGoat } from "../provider.js";
import { Alert, AlertDescription, AlertTitle } from "./primitives/alert.js";
import { Badge, type BadgeProps } from "./primitives/badge.js";
import { Button } from "./primitives/button.js";
import { Spinner } from "./primitives/spinner.js";

type ManagementProps = React.ComponentProps<typeof CrossmintPaymentMethodManagement>;
export type PaymentMethodAppearance = NonNullable<ManagementProps["appearance"]>;
type SelectedPaymentMethod = Parameters<NonNullable<ManagementProps["onPaymentMethodSelected"]>>[0];

export interface SaveCardResult {
  paymentMethod: PaymentMethod;
  rails: RegistrationRail[];
}

export interface SaveCardProps {
  /** Fires after the card is saved and registered for agent cards. */
  onSaved?: (result: SaveCardResult) => void;
  onError?: (error: unknown) => void;
  /** Cardholder email for registration. Defaults to the signed-in user's email. */
  email?: string;
  /** ISO 3166-1 alpha-2. Default "US". */
  countryCode?: string;
  languageCode?: string;
  /** Passed to Crossmint. Defaults to the page theme. */
  appearance?: PaymentMethodAppearance;
  /** Show the result summary after saving. Default true. */
  showResult?: boolean;
  className?: string;
}

function railBadgeVariant(status: RegistrationRail["status"]): BadgeProps["variant"] {
  return status === "enabled" ? "success" : status === "pending" ? "warning" : "destructive";
}

/**
 * Saves a card with Crossmint's PCI component, then registers it for agent
 * cards on the GOAT server. Card numbers never touch your servers.
 */
export function SaveCard({
  onSaved,
  onError,
  email,
  countryCode = "US",
  languageCode,
  appearance,
  showResult = true,
  className,
}: SaveCardProps) {
  const { api, jwt, crossmint } = useGoat();
  const [phase, setPhase] = React.useState<"idle" | "registering" | "done" | "error">("idle");
  const [error, setError] = React.useState<unknown>(undefined);
  const [result, setResult] = React.useState<SaveCardResult | undefined>(undefined);
  const [themeAppearance, setThemeAppearance] = React.useState<PaymentMethodAppearance | undefined>(undefined);

  React.useEffect(() => {
    if (!appearance) setThemeAppearance(paymentMethodAppearanceFromTheme());
  }, [appearance]);

  const handleSelected = React.useCallback(
    async (selected: SelectedPaymentMethod) => {
      if (selected.type !== "card") return;
      setPhase("registering");
      setError(undefined);
      const paymentMethod: PaymentMethod = {
        paymentMethodId: selected.paymentMethodId,
        type: "card",
        default: selected.default,
        card: {
          brand: selected.card.brand,
          last4: selected.card.last4,
          expiration: selected.card.expiration,
        },
      };
      try {
        const resolvedEmail = email ?? (await api.me()).email;
        if (!resolvedEmail) throw new Error("No email on this account. Pass `email` to SaveCard.");
        const registered = await api.registerPaymentMethod(paymentMethod.paymentMethodId, {
          email: resolvedEmail,
          countryCode,
          languageCode,
        });
        const out = { paymentMethod, rails: registered.rails };
        setResult(out);
        setPhase("done");
        onSaved?.(out);
      } catch (e) {
        setError(e);
        setPhase("error");
        onError?.(e);
      }
    },
    [api, email, countryCode, languageCode, onSaved, onError],
  );

  if (!crossmint.clientApiKey) {
    return (
      <Alert variant="destructive" className={className}>
        <TriangleAlert />
        <AlertTitle>Saving cards is not set up</AlertTitle>
        <AlertDescription>The Crossmint client API key is missing.</AlertDescription>
      </Alert>
    );
  }

  if (!jwt) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Spinner /> Waiting for your session…
      </div>
    );
  }

  if (phase === "done" && result && showResult) {
    return (
      <div className={cn("flex flex-col gap-4 rounded-2xl border border-border bg-card p-5", className)}>
        <div className="flex items-center gap-3">
          <CircleCheck className="size-6 text-success" />
          <div>
            <p className="font-semibold">Saved {paymentMethodLabel(result.paymentMethod)}</p>
            <p className="text-sm text-muted-foreground">Agents can now ask to use it.</p>
          </div>
        </div>
        {result.rails.length ? (
          <div className="flex flex-wrap gap-1.5">
            {result.rails.map((r) => (
              <Badge key={`${r.rail}-${r.provider ?? ""}`} variant={railBadgeVariant(r.status)} title={r.error?.message}>
                {registrationRailLabel(r)} · {r.status}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {phase === "error" ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Card saved, but not registered for agents</AlertTitle>
          <AlertDescription>
            <p>{errorMessage(error)}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setPhase("idle")}>
              Try another card
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {phase === "registering" ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Registering your card for agents…
        </div>
      ) : null}
      <div className={cn(phase === "registering" && "pointer-events-none opacity-60")}>
        <CrossmintPaymentMethodManagement
          jwt={jwt}
          allowedModes={["new"]}
          allowedPaymentMethodTypes={["card"]}
          appearance={appearance ?? themeAppearance}
          onPaymentMethodSelected={handleSelected}
        />
      </div>
    </div>
  );
}
