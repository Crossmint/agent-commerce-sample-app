# @agent-commerce/core

Typed client for the Crossmint Agents APIs, plus the domain rules Agent Commerce adds on top.

```ts
import { CrossmintClient, selectRail, expiresInHours } from "@agent-commerce/core";

const crossmint = new CrossmintClient({
  clientApiKey: process.env.CROSSMINT_CLIENT_API_KEY,
  serverApiKey: process.env.CROSSMINT_SERVER_API_KEY,
  environment: "staging",
});

const user = { jwt: userJwt };
const cards = await crossmint.paymentMethods.list(user);
const intent = await crossmint.orderIntents.create(user, {
  paymentMethodId: cards.paymentMethods[0].paymentMethodId,
  amount: { value: "50.00", currency: "USD" },
  description: "Flight to SF",
  expiresAt: expiresInHours(24),
});
const rail = selectRail(intent);
```

Contains: `CrossmintClient`, Crossmint types, `selectRail`, encrypted-card key helpers,
`renderPendingAction` for checkout forms, and polling helpers. No auth, no storage, no HTTP routes.
