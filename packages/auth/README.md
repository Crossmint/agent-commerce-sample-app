# @agent-commerce/auth

One interface, `UserAuth`, with `verify(jwt)` and optional `refresh(session)`.

- `@agent-commerce/auth/stytch`: default adapter. Verifies Stytch session JWTs and Connected Apps access tokens.
- `@agent-commerce/auth/jwks`: any provider with a JWKS URL.
- `@agent-commerce/auth/oauth`: PKCE helpers the CLI and MCP client use to log in as the user.

Bring your own auth: implement `verify`, register your JWKS in the Crossmint console, done.
