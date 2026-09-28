import { describe, expect, it } from "vitest";
import { renderCallbackPage } from "../src/login.js";

describe("the callback page", () => {
  it("ends well on a success: a blue disc, and the caller's line under it", () => {
    const page = renderCallbackPage(200, "Logged in", "You can close this window.");
    expect(page).toContain("disc ok");
    expect(page).toContain("<h1>Logged in</h1>");
    expect(page).toContain("You can close this window.");
    // Nothing to fix, so nothing to say about running login again.
    expect(page).not.toContain("agent-commerce login");
    // The onramp look: one white card on the dot grid, the Crossmint logotype above.
    expect(page).toContain('class="card"');
    expect(page).toContain('aria-label="Crossmint"');
    expect(page).toContain("#4564FF");
  });

  it("shows a failure quietly, and says to run login again", () => {
    const page = renderCallbackPage(400, "Login failed", "access_denied: Consent is required");
    expect(page).toContain("disc no");
    expect(page).toContain("agent-commerce login");
    expect(page).not.toContain("disc ok");
  });

  it("treats a denial as an answer, not a breakage", () => {
    const page = renderCallbackPage(200, "Denied.", "The agent did not get a login.", "denied");
    expect(page).toContain("<h1>Denied.</h1>");
    expect(page).toContain("disc no");
    expect(page).not.toContain("Login failed");
    expect(page).toContain("if you change your mind");
  });

  it("escapes what the OAuth server sent", () => {
    const page = renderCallbackPage(400, "Login failed", '<img src=x onerror="alert(1)">');
    expect(page).not.toContain("<img src=x");
    expect(page).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
