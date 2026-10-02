import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPendingAction, type CheckoutField } from "@agent-commerce/core";
import { PendingActionForm } from "../src/components/pending-action-form.js";
import { AgentCommerceProvider } from "../src/provider.js";

// Crossmint's field is its own iframe and its SDK loads only in a browser: stand in for it.
vi.mock("@crossmint/client-sdk-react-ui", () => ({
  CrossmintProvider: ({ children }: { children: React.ReactNode }) => children,
  CrossmintProtectedInput: React.forwardRef(function CrossmintProtectedInput(
    props: { field: { key: string } },
    _ref,
  ) {
    return <div data-crossmint-protected-input={props.field.key} />;
  }),
}));

const option = (value: string, selected = false) => ({
  value,
  label: value.toUpperCase(),
  disabled: false,
  selected,
  placeholder: false,
});

function render(fields: CheckoutField[]): string {
  const action = renderPendingAction({ id: "req_1", question: "A few details", fields });
  return renderToStaticMarkup(
    <AgentCommerceProvider getJwt={async () => null} crossmintClientApiKey="ck_test">
      <PendingActionForm action={action} onSubmit={() => undefined} />
    </AgentCommerceProvider>,
  );
}

describe("PendingActionForm", () => {
  it("renders each typed field as its own control", () => {
    const html = render([
      {
        key: "email",
        label: "Email",
        required: true,
        handling: "standard",
        input: { kind: "text", autoComplete: "email" },
      },
      {
        key: "notes",
        label: "Notes",
        required: false,
        handling: "standard",
        input: { kind: "text", multiline: true },
      },
      {
        key: "quantity",
        label: "Quantity",
        required: true,
        handling: "standard",
        input: { kind: "integer" },
      },
      {
        key: "gift",
        label: "Gift",
        required: false,
        handling: "standard",
        input: { kind: "boolean" },
      },
      {
        key: "size",
        label: "Size",
        required: true,
        handling: "standard",
        input: {
          kind: "choice",
          selection: { kind: "one" },
          options: [option("s"), option("m", true)],
        },
      },
      {
        key: "extras",
        label: "Extras",
        required: false,
        handling: "standard",
        input: {
          kind: "choice",
          selection: { kind: "many", min: 0 },
          options: [option("bag"), option("card")],
        },
      },
    ]);
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain("<textarea");
    expect(html).toContain('step="1"');
    expect(html).toContain('type="checkbox"');
    // The store's preselected option is the default.
    expect(html).toMatch(/<option value="m" selected="">M<\/option>/);
    expect(html).toContain("BAG");
    // Required fields with no answer yet hold the submit button back.
    expect(html).toContain("Still needed: Email, Quantity");
  });

  it("renders a protected field as Crossmint's secure field, never a plain input", () => {
    const html = render([
      {
        key: "email",
        label: "Email",
        required: true,
        handling: "standard",
        input: { kind: "text" },
      },
      {
        key: "password",
        label: "Password",
        required: true,
        handling: "protected",
        input: { kind: "text", display: "masked" },
      },
    ]);
    expect(html).toContain("Password");
    // Server markup stops at the session wait: the secure field mounts in the browser, with the JWT.
    expect(html).toContain("Waiting for your session");
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain('id="paf-password"');
  });

  it("leaves an optional protected field out until the user adds it", () => {
    const html = render([
      {
        key: "code",
        label: "Gift card PIN",
        required: false,
        handling: "protected",
        input: { kind: "text" },
      },
    ]);
    expect(html).toContain("Add gift card pin");
    expect(html).not.toContain("Waiting for your session");
  });
});
