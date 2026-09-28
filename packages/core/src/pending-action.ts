import type { JsonSchema, PendingUserAction } from "./types.js";

export type FieldKind = "text" | "number" | "boolean" | "select" | "email" | "url" | "date" | "object" | "array";

export interface RenderedField {
  name: string;
  path: string[];
  label: string;
  description?: string;
  kind: FieldKind;
  required: boolean;
  options?: Array<{ value: unknown; label: string }>;
  default?: unknown;
  format?: string;
  pattern?: string;
  children?: RenderedField[];
}

export interface RenderedAction {
  id: string;
  type: string;
  title: string;
  description?: string;
  expiresAt?: string;
  fields: RenderedField[];
}

/**
 * Walk an input request's JSON Schema into a flat, neutral field list.
 * The UI renders inputs from it. The CLI prints prompts from it. Neither
 * hardcodes field names, so shipping, sizes, and payment all render the same way.
 */
export function renderPendingAction(action: PendingUserAction): RenderedAction {
  const schema = action.responseSchema ?? {};
  return {
    id: action.id,
    type: "input_response",
    title: action.question || schema.title || "Input needed",
    description: action.question && schema.title ? schema.title : schema.description,
    expiresAt: action.expiresAt,
    fields: renderSchemaFields(schema),
  };
}

export function renderSchemaFields(schema: JsonSchema, parentPath: string[] = []): RenderedField[] {
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  return Object.entries(props).map(([name, sub]) => renderField(name, sub, required.has(name), parentPath));
}

function renderField(name: string, schema: JsonSchema, required: boolean, parentPath: string[]): RenderedField {
  const path = [...parentPath, name];
  const kind = fieldKind(schema);
  const field: RenderedField = {
    name,
    path,
    label: schema.title ?? humanize(name),
    description: schema.description,
    kind,
    required,
    default: schema.default,
    format: schema.format,
    pattern: schema.pattern,
  };
  const options = enumOptions(schema);
  if (options) field.options = options;
  if (kind === "object") field.children = renderSchemaFields(schema, path);
  return field;
}

function fieldKind(schema: JsonSchema): FieldKind {
  if (enumOptions(schema)) return "select";
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
  switch (type) {
    case "boolean":
      return "boolean";
    case "number":
    case "integer":
      return "number";
    case "object":
      return "object";
    case "array":
      return "array";
    default:
      if (schema.format === "email") return "email";
      if (schema.format === "uri" || schema.format === "url") return "url";
      if (schema.format === "date" || schema.format === "date-time") return "date";
      return "text";
  }
}

function enumOptions(schema: JsonSchema): Array<{ value: unknown; label: string }> | undefined {
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => ({ value, label: typeof value === "string" ? humanize(value) : String(value) }));
  }
  const variants = schema.oneOf ?? schema.anyOf;
  if (variants && variants.every((v) => "const" in v)) {
    return variants.map((v) => ({ value: v.const, label: v.title ?? String(v.const) }));
  }
  return undefined;
}

export function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Is this the checkout's payment step? A payment input request says so
 * (`interaction.kind: "payment"`); the server answers it with an order
 * intent, and no caller ever sees it. A form asking for card fields counts
 * too, so it never reaches a caller either: decided by the field names, never
 * by the question text alone, since "which card" as a choice is not a
 * payment form.
 */
/** Field names and titles that ask for a password, in the languages stores ask in. */
const PASSWORD_FIELD = /pass(word|code|phrase)|passwd|\bpwd\b|contraseña|mot de passe|kennwort|passwort|senha/i;

/**
 * True when a plain form asks for a password: a store agent that could not
 * raise a protected request (the project has protected inputs off) asks in a
 * form instead. It is never answered with values: Agent Checkouts does not
 * fill a password from them, and the secret would pass through the app and
 * the agent. Decline it, or suggest another way, such as a guest checkout.
 */
export function asksPasswordInForm(action: Pick<PendingUserAction, "responseSchema" | "protected">): boolean {
  if (action.protected) return false;
  const props = (action.responseSchema?.properties ?? {}) as Record<
    string,
    { type?: unknown; title?: unknown; enum?: unknown; oneOf?: unknown; anyOf?: unknown }
  >;
  return Object.entries(props).some(([key, field]) => {
    // A choice ("password or passkey?") is fine to answer; only free text can hold the secret.
    const freeText = field?.type === "string" && !field.enum && !field.oneOf && !field.anyOf;
    return freeText && (PASSWORD_FIELD.test(key) || PASSWORD_FIELD.test(String(field.title ?? "")));
  });
}

/** True when the store asks for a secret the buyer types into Crossmint's protected field, never into a form. */
export function isProtectedAction(action: Pick<PendingUserAction, "protected">): boolean {
  return Boolean(action.protected);
}

export function isPaymentAction(action: Pick<PendingUserAction, "responseSchema" | "payment">): boolean {
  if (action.payment) return true;
  const keys = Object.keys(action.responseSchema?.properties ?? {}).map((k) => k.toLowerCase());
  return keys.some((k) => /cardnumber|card_number|^pan$|^number$|cvc|cvv|securitycode|security_code|expir/.test(k));
}
