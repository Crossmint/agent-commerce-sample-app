---
"@agent-commerce/cli": patch
---

The browser page at the end of `agent-commerce login` is no longer bare HTML. It stands on the same ground as the sign-in screen it came from: the dotted off-white, the content in one cell of hairlines with a green diamond at each corner, the pixel wordmark above it, and a disc that says how it went — green with a check when the login lands, quiet grey with a cross when the OAuth server sends back an error, which then says to run `agent-commerce login` again.

Everything is inline, since the little callback server has no assets to serve. `renderCallbackPage` is exported for its test, which also pins the escaping: the title and body carry text from the OAuth server.
