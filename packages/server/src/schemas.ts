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

export const createCheckoutSchema = z.object({
  url: z.string().url(),
  request: z.string().max(2000).optional(),
  agentCardId: z.string().min(1),
  maxCost: z.object({
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    currency: z.string().length(3),
  }),
  buyerProfileId: z.string().min(1).optional(),
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
