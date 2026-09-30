import { z } from "zod";

export const amountSchema = z.object({
  value: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Use a decimal string like "50.00"'),
  currency: z.string().length(3),
});

export const merchantSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  countryCode: z.string().length(2),
  categoryCode: z.string().optional(),
  acquirerBin: z.string().optional(),
});

export const registerCardSchema = z.object({
  email: z.string().email().optional(),
  countryCode: z.string().length(2).default("US"),
  languageCode: z.string().optional(),
});

export const createRequestSchema = z.object({
  amount: amountSchema,
  description: z.string().min(1).max(500),
  merchant: merchantSchema.optional(),
  expiresInHours: z
    .number()
    .positive()
    .max(24 * 365)
    .optional(),
  requester: z.string().min(1).max(100).optional(),
});

export const approveSchema = z.object({
  paymentMethodId: z.string().min(1),
  email: z.string().email().optional(),
  countryCode: z.string().length(2).optional(),
});

export const credentialsSchema = z.object({
  amount: amountSchema.optional(),
  merchant: merchantSchema.optional(),
  format: z.literal("card").optional(),
});

const decimalAmount = z.string().regex(/^\d+(\.\d{1,6})?$/);

/**
 * Body of POST /v1/checkouts. `startUrl` and `task` mirror Crossmint's
 * `request`; `url` and `request` are accepted as their older names.
 */
export const createCheckoutSchema = z
  .object({
    startUrl: z.string().url().optional(),
    url: z.string().url().optional(),
    task: z.string().min(1).max(20000).optional(),
    request: z.string().min(1).max(20000).optional(),
    // Optional: a checkout can start without a card and get one at its
    // payment step, when the user chooses a payment method.
    agentCardId: z.string().min(1).optional(),
    // What the purchase is, in a few words: shown when the user approves the payment.
    purpose: z.string().trim().min(1).max(80).optional(),
    // The most the run may cost, including shipping and tax. Optional: a run
    // paid from an agent card costs at most what the card has left, and any
    // other run at most the server's default ceiling.
    maxCost: z
      .object({
        amount: decimalAmount,
        currency: z.string().length(3),
      })
      .optional(),
    /** The store's currency, for the default ceiling when there is no maxCost and no agent card. */
    currency: z.string().length(3).optional(),
    buyerProfileId: z.string().min(1).optional(),
    /** Overrides the user's own profile, which the server otherwise attaches. */
    browserProfileId: z.string().min(1).optional(),
    /** Start signed out, ignoring the user's saved merchant logins. */
    freshBrowser: z.boolean().optional(),
    merchantGuidance: z.string().min(1).max(20000).optional(),
  })
  .refine((b) => Boolean(b.startUrl ?? b.url), {
    message: "startUrl is required",
    path: ["startUrl"],
  });

/**
 * Body of POST /v1/checkouts/:id/messages. With `requestId`: answer the open
 * input request (`submit` with `values`, `decline`, or `alternative` with
 * `text`). A protected request, such as a password, is submitted with the
 * `protectedInputId` Crossmint's protected field returned, never with values.
 * Without `requestId`: a free-text note to the agent.
 */
export const checkoutMessageSchema = z
  .object({
    requestId: z.string().min(1).optional(),
    action: z.enum(["submit", "decline", "alternative"]).optional(),
    values: z.record(z.string(), z.unknown()).optional(),
    protectedInputId: z.string().min(1).max(200).optional(),
    text: z.string().min(1).max(20000).optional(),
    messageId: z.string().min(1).max(200).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.requestId) {
      const action = b.action ?? "submit";
      if (action === "submit" && !b.values && !b.protectedInputId)
        ctx.addIssue({
          code: "custom",
          path: ["values"],
          message: "values are required to submit",
        });
      if (b.protectedInputId && (action !== "submit" || b.values))
        ctx.addIssue({
          code: "custom",
          path: ["protectedInputId"],
          message: "protectedInputId is a submit of its own, with no values",
        });
      if (action === "alternative" && !b.text)
        ctx.addIssue({
          code: "custom",
          path: ["text"],
          message: "text is required for an alternative",
        });
    } else if (b.protectedInputId) {
      ctx.addIssue({
        code: "custom",
        path: ["requestId"],
        message: "requestId is required with protectedInputId",
      });
    } else if (!b.text) {
      ctx.addIssue({ code: "custom", path: ["text"], message: "text or requestId is required" });
    }
  });

/** Body of the older POST /v1/checkouts/:id/actions/:actionId. */
/** Body of POST /v1/checkouts/:id/agent-card: pay the run from a card the user already has. */
export const checkoutAgentCardSchema = z.object({
  agentCardId: z.string().min(1),
});

export const submitActionSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export const buyerProfileSchema = z.object({
  label: z.string().min(1),
  name: z.object({ first: z.string().min(1), last: z.string().min(1) }),
  contact: z.object({ email: z.string().email(), phone: z.string().optional() }),
  shipping: z.object({
    addressLines: z.array(z.string().min(1)).min(1),
    locality: z.string().min(1),
    administrativeAreaCode: z.string().optional(),
    postalCode: z.string().min(1),
    countryCode: z.string().length(2),
  }),
});
