# @goat-wallet/auth

One interface, `UserAuth`, with `verify(jwt)` and optional `refresh(session)`.

- `@goat-wallet/auth/stytch`: default adapter. Verifies Stytch session JWTs and Connected Apps access tokens.
- `@goat-wallet/auth/jwks`: any provider with a JWKS URL.
- `@goat-wallet/auth/oauth`: PKCE helpers the CLI and MCP client use to log in as the user.

Bring your own auth: implement `verify`, register your JWKS in the Crossmint console, done.
