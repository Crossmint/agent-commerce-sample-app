import {
  decryptEncryptedCard,
  pendingVerificationRails,
  selectRail,
  toPublicJwk,
  type Amount,
  type CardCredentialValue,
  type Merchant,
  type MintCredentialInput,
  type OrderIntent,
  type RailKind,
} from "@agent-commerce/core";
import type { AuthenticatedUser } from "@agent-commerce/auth";
import type { Ctx } from "./context.js";
import { HttpError } from "./errors.js";
import type { CredentialResponse } from "./types.js";

export interface MintOptions {
  /** Fixed amount, or a function of the order intent. Default: the full available amount. */
  amount?: Amount | ((orderIntent: OrderIntent) => Amount);
  /** Used only when the order intent has no merchant. */
  merchant?: Merchant;
  format?: "card";
  /** Rails to consider, in order. Default: the server's preference. */
  railPreference?: RailKind[];
  /** Who asked, for the transactions list. Default: the server's `defaultRequester`. */
  requester?: string;
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
    const pending = pendingVerificationRails(orderIntent);
    if (pending.length) {
      throw new HttpError(
        409,
        "verification_required",
        "This agent card needs the user to verify it in the wallet before it can produce a card number. Ask them to open the approval link again.",
        { rails: orderIntent.rails, status: orderIntent.status },
      );
    }
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
  // Card networks issue a credential for a merchant. An open agent card has none,
  // so the caller must name one now. Fail early with a clear message.
  if (rail.rail === "agentic-token" && !orderIntent.merchant && !opts.merchant) {
    throw new HttpError(
      400,
      "merchant_required",
      "This agent card is not locked to a merchant. Pass `merchant` { name, url, countryCode } for the store you are about to pay.",
      { agentCardId },
    );
  }
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
    default:
      // `agentRails` strips spt, so this never runs; it keeps the switch total.
      throw new HttpError(409, "no_usable_rail", `Unsupported rail ${rail.rail}`);
  }

  const credential = await ctx.crossmint.orderIntents.mintCredential(jwt, agentCardId, input);

  const response: CredentialResponse = { agentCardId, rail: rail.rail as CredentialResponse["rail"], enforced };
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
  } else if (credential.rail === "encrypted-card") {
    const privateJwk = ctx.config.encryptedCardPrivateJwk!;
    card = await decryptEncryptedCard(credential.credential.value, privateJwk);
    response.card = card;
  } else {
    throw new HttpError(502, "crossmint_error", "Crossmint returned a rail Agent Commerce does not use");
  }

  /*
   * The transactions list. Recorded after the mint so a failed one leaves no
   * line, and awaited so the row is there by the time the caller can ask for
   * it. A store that cannot write must not fail the mint: the agent already
   * holds a live credential, and losing the audit line is the smaller harm.
   */
  try {
    await ctx.reveals.recordReveal({
      userId: user.userId,
      agentCardId,
      paymentMethodId: orderIntent.paymentMethodId,
      description: orderIntent.description,
      amount,
      merchant: orderIntent.merchant ?? merchant,
      rail: response.rail,
      provider: response.provider,
      enforced,
      requester: opts.requester,
    });
  } catch (e) {
    console.error("[agent-commerce] could not record the reveal", e);
  }

  console.info("[agent-commerce] credential minted", {
    agentCardId,
    rail: rail.rail,
    provider: response.provider,
    amount,
    merchant: (merchant ?? orderIntent.merchant)?.name,
    enforced,
  });

  return { response, card, orderIntent };
}
