import {
  decryptEncryptedCard,
  selectRail,
  toPublicJwk,
  type Amount,
  type CardCredentialValue,
  type Merchant,
  type MintCredentialInput,
  type OrderIntent,
  type RailKind,
} from "@goat-wallet/core";
import type { AuthenticatedUser } from "@goat-wallet/auth";
import type { Ctx } from "./context.js";
import { HttpError, invalidRequest } from "./errors.js";
import type { CredentialResponse } from "./types.js";

export interface MintOptions {
  /** Fixed amount, or a function of the order intent. Default: the full available amount. */
  amount?: Amount | ((orderIntent: OrderIntent) => Amount);
  /** Used only when the order intent has no merchant. */
  merchant?: Merchant;
  format?: "card";
  /** Needed for the spt rail. */
  networkBusinessProfile?: string;
  /** Rails to consider, in order. Default: the server's preference. */
  railPreference?: RailKind[];
}

export interface MintResult {
  response: CredentialResponse;
  /** Present when the rail produced card details. Never log this. */
  card?: CardCredentialValue;
  orderIntent: OrderIntent;
}

/**
 * Pick a rail and mint a credential from an agent card.
 * Shared by `POST /agent-cards/:id/credentials` and the checkout payment auto-answer.
 */
export async function mintFromAgentCard(
  ctx: Ctx,
  user: AuthenticatedUser,
  agentCardId: string,
  opts: MintOptions = {},
): Promise<MintResult> {
  const jwt = { jwt: user.jwt };
  const orderIntent = await ctx.crossmint.orderIntents.get(jwt, agentCardId);

  let preference = opts.railPreference ?? ctx.railPreference;
  if (!ctx.config.encryptedCardPrivateJwk) {
    preference = preference.filter((r) => r !== "encrypted-card");
  }
  const selection = selectRail(orderIntent, preference);
  if (!selection) {
    throw new HttpError(409, "no_usable_rail", "No rail on this agent card is active right now", {
      rails: orderIntent.rails,
      status: orderIntent.status,
    });
  }

  const amount: Amount =
    typeof opts.amount === "function"
      ? opts.amount(orderIntent)
      : (opts.amount ?? {
          value: orderIntent.amount.available,
          currency: orderIntent.amount.currency,
        });
  const merchant = !orderIntent.merchant && opts.merchant ? opts.merchant : undefined;

  const { rail, enforced } = selection;
  let input: MintCredentialInput;
  switch (rail.rail) {
    case "agentic-token":
      input = {
        rail: "agentic-token",
        provider: rail.provider,
        amount,
        credential: { format: opts.format ?? "card" },
        ...(merchant ? { merchant } : {}),
      };
      break;
    case "spt": {
      const networkBusinessProfile = opts.networkBusinessProfile;
      if (!networkBusinessProfile) {
        throw invalidRequest("The spt rail needs `networkBusinessProfile` in the body");
      }
      input = {
        rail: "spt",
        provider: "stripe",
        amount,
        credential: { format: "identifier", payload: { networkBusinessProfile } },
        ...(merchant ? { merchant } : {}),
      };
      break;
    }
    case "encrypted-card": {
      const privateJwk = ctx.config.encryptedCardPrivateJwk;
      if (!privateJwk) {
        throw new HttpError(409, "no_usable_rail", "The encrypted-card rail is not configured");
      }
      input = {
        rail: "encrypted-card",
        credential: { format: "card", publicKey: toPublicJwk(privateJwk) },
      };
      break;
    }
  }

  const credential = await ctx.crossmint.orderIntents.mintCredential(jwt, agentCardId, input);

  const response: CredentialResponse = { agentCardId, rail: rail.rail, enforced };
  let card: CardCredentialValue | undefined;

  if (credential.rail === "agentic-token") {
    response.provider = credential.provider;
    response.expiresAt = credential.expiresAt;
    if (credential.credential.format === "card") {
      card = credential.credential.value;
      response.card = card;
    } else {
      // Network tokens have no PAN. Expose the token so callers can still pay.
      response.token = credential.credential.value.paymentToken;
    }
  } else if (credential.rail === "spt") {
    response.provider = "stripe";
    response.token = credential.credential.value;
    response.expiresAt = credential.expiresAt;
  } else {
    const privateJwk = ctx.config.encryptedCardPrivateJwk!;
    card = await decryptEncryptedCard(credential.credential.value, privateJwk);
    response.card = card;
  }

  console.info("[goat] credential minted", {
    agentCardId,
    rail: rail.rail,
    provider: response.provider,
    amount,
    merchant: (merchant ?? orderIntent.merchant)?.name,
    enforced,
  });

  return { response, card, orderIntent };
}
