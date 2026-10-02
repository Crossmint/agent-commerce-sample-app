import type { CheckoutField, CheckoutProtectedField, CheckoutTextInput, PendingUserAction } from "./types.js";

/**
 * `select`: one option value. `multiselect`: a list of option values.
 * `protected`: a secret the buyer types into Crossmint's protected field;
 * only the app's own UI answers it, never an agent.
 */
export type FieldKind = "text" | "number" | "boolean" | "select" | "multiselect" | "protected";

export interface RenderedField {
  /** The field's `key`: what its answer is keyed by. */
  name: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  /** On `select` and `multiselect`: the options that can be picked. Placeholder options are left out. */
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  /** On `multiselect`: how many to pick. */
  min?: number;
  max?: number;
  /** On `number`: whole numbers only. */
  integer?: boolean;
  /** On `text`: several lines. */
  multiline?: boolean;
  /** On `text`: hide what is typed. */
  masked?: boolean;
  placeholder?: string;
  autoComplete?: CheckoutTextInput["autoComplete"];
  inputMode?: CheckoutTextInput["inputMode"];
  /** What the store preselected, when it did. */
  default?: string | string[];
  /** On `protected`: the descriptor to hand `CrossmintProtectedInput` as its `field`, unchanged. */
  protectedField?: CheckoutProtectedField;
}

export interface RenderedAction {
  id: string;
  type: string;
  title: string;
  expiresAt?: string;
  fields: RenderedField[];
}

/**
 * An input request's fields as a flat, neutral list. The UI renders inputs
 * from it. The CLI prints prompts from it. Neither hardcodes field names, so
 * shipping, sizes, and sign-in all render the same way.
 */
export function renderPendingAction(action: PendingUserAction): RenderedAction {
  return {
    id: action.id,
    type: "input_response",
    title: action.question || "Input needed",
    expiresAt: action.expiresAt,
    fields: action.fields.map(renderField),
  };
}

export function renderField(field: CheckoutField): RenderedField {
  const base = { name: field.key, label: field.label || humanize(field.key), required: field.required };
  if (field.handling === "protected") return { ...base, kind: "protected", protectedField: field };
  const input = field.input;
  switch (input.kind) {
    case "boolean":
      return { ...base, kind: "boolean" };
    case "number":
    case "integer":
      return { ...base, kind: "number", ...(input.kind === "integer" ? { integer: true } : {}) };
    case "choice": {
      const options = input.options
        .filter((o) => !o.placeholder)
        .map((o) => ({ value: o.value, label: o.label, ...(o.disabled ? { disabled: true } : {}) }));
      const selected = input.options.filter((o) => o.selected && !o.placeholder).map((o) => o.value);
      if (input.selection.kind === "many") {
        return {
          ...base,
          kind: "multiselect",
          options,
          min: input.selection.min,
          ...(input.selection.max !== undefined ? { max: input.selection.max } : {}),
          ...(selected.length ? { default: selected } : {}),
        };
      }
      return { ...base, kind: "select", options, ...(selected[0] !== undefined ? { default: selected[0] } : {}) };
    }
    default:
      return {
        ...base,
        kind: "text",
        ...(input.multiline ? { multiline: true } : {}),
        ...(input.display === "masked" ? { masked: true } : {}),
        ...(input.placeholder ? { placeholder: input.placeholder } : {}),
        ...(input.autoComplete ? { autoComplete: input.autoComplete } : {}),
        ...(input.inputMode ? { inputMode: input.inputMode } : {}),
      };
  }
}

export function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** The fields the buyer types into Crossmint's protected field. */
export function protectedFields(action: Pick<PendingUserAction, "fields">): CheckoutProtectedField[] {
  return action.fields.filter((f): f is CheckoutProtectedField => f.handling === "protected");
}

/**
 * True when the form has a protected field, such as the password of the
 * buyer's account at the store. Only the app's own UI answers it: the buyer
 * types each secret into Crossmint's protected field, and the app sends the
 * whole form with the ids those fields return. An agent never answers it,
 * though it may decline it or suggest another way.
 */
export function isProtectedAction(action: Pick<PendingUserAction, "fields">): boolean {
  return protectedFields(action).length > 0;
}

/** Field names and labels that ask for a password, in the languages stores ask in. */
const PASSWORD_FIELD = /pass(word|code|phrase)|passwd|\bpwd\b|contraseña|mot de passe|kennwort|passwort|senha/i;

/**
 * True when a standard field, one the caller answers with a plain value,
 * looks like a password: masked, a password autocomplete, or a password
 * name or label. Agent Checkouts asks for a password as a protected field;
 * this guards against one that slips through as plain text. It is never
 * answered with values, since the secret would pass through the app and the
 * agent. Decline it, or suggest another way, such as a guest checkout.
 */
export function asksPasswordInForm(action: Pick<PendingUserAction, "fields">): boolean {
  return action.fields.some((field) => {
    // A choice ("password or passkey?") is fine to answer; only free text can hold the secret.
    if (field.handling !== "standard" || field.input.kind !== "text") return false;
    const { display, autoComplete } = field.input;
    return (
      display === "masked" ||
      autoComplete === "current-password" ||
      autoComplete === "new-password" ||
      PASSWORD_FIELD.test(field.key) ||
      PASSWORD_FIELD.test(field.label)
    );
  });
}

/**
 * True for the run's payment request (`interaction.kind === "payment"`): the
 * one answered with an order intent, never with card fields.
 */
export function isPaymentRequest(action: Pick<PendingUserAction, "payment">): boolean {
  return Boolean(action.payment);
}

/**
 * True when a plain form, not a payment request, asks for card details. It
 * is never answered with them, and never with an order intent: that answer
 * does not fit a form. Decline it, or ask for another way to pay.
 */
export function asksCardInForm(action: Pick<PendingUserAction, "fields" | "payment">): boolean {
  return !action.payment && isPaymentAction(action);
}

/** True for the payment request, or a form that asks for card details. Card fields never answer either. */
export function isPaymentAction(action: Pick<PendingUserAction, "fields" | "payment">): boolean {
  if (action.payment) return true;
  const keys = action.fields.map((f) => f.key.toLowerCase());
  return keys.some((k) => /cardnumber|card_number|^pan$|^number$|cvc|cvv|securitycode|security_code|expir/.test(k));
}
