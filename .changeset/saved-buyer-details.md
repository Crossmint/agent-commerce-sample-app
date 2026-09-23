---
"@agent-commerce/server": minor
"@agent-commerce/core": minor
---

Checkouts start with the buyer's saved details.

The server attaches the user's newest buyer profile to every checkout that names none, so the store fills in the name, email and shipping address instead of asking. `POST /v1/buyer-profiles` makes the new profile the one to use; new `GET /v1/buyer-profile` reads it. Reading it fails quietly: the run goes ahead, and the store asks.

Core gains `checkouts.listBuyerProfiles` and `BuyerProfileList`, and `BuyerProfile` carries `createdAt` and `updatedAt`. Its tool docs gain `save_buyer_profile`, a chat-only tool: the agent saves the details the first time the user gives a full name and address. The chat prompt now carries the user's email and saved details, so the agent answers those questions itself.
