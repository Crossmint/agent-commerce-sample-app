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
 * Walk a pending action's JSON Schema into a flat, neutral field list.
 * The UI renders inputs from it. The CLI prints prompts from it. Neither
 * hardcodes field names, so shipping, sizes, and payment all render the same way.
 */
export function renderPendingAction(action: PendingUserAction): RenderedAction {
  return {
    id: action.id,
    type: action.type ?? action.kind ?? "input",
    title: action.title ?? action.responseSchema.title ?? humanize(action.type ?? action.kind ?? "Input needed"),
    description: action.description ?? action.responseSchema.description,
    expiresAt: action.expiresAt,
    fields: renderSchemaFields(action.responseSchema),
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

/** Is this pending action asking for card details? Used to let the server answer it. */
export function isPaymentAction(action: PendingUserAction): boolean {
  const type = `${action.type ?? ""} ${action.kind ?? ""}`.toLowerCase();
  if (/payment|card/.test(type)) return true;
  const keys = Object.keys(action.responseSchema.properties ?? {}).map((k) => k.toLowerCase());
  return keys.some((k) => /cardnumber|card_number|^pan$|^number$|cvc|cvv|expir/.test(k));
}

/**
 * Build the `values` for a payment action from a card credential by matching
 * common field names in the response schema.
 */
export function fillPaymentAction(
  action: PendingUserAction,
  card: { number: string; expirationMonth: string; expirationYear: string; cvc: string; holderName?: string },
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const props = action.responseSchema.properties ?? {};
  for (const key of Object.keys(props)) {
    const k = key.toLowerCase();
    if (/cardnumber|card_number|^pan$|^number$/.test(k)) values[key] = card.number;
    else if (/expmonth|expirationmonth|expirymonth|expiry_month|exp_month/.test(k)) values[key] = card.expirationMonth;
    else if (/expyear|expirationyear|expiryyear|expiry_year|exp_year/.test(k)) values[key] = card.expirationYear;
    else if (/^expir(y|ation)$|^exp$/.test(k)) values[key] = `${card.expirationMonth}/${card.expirationYear.slice(-2)}`;
    else if (/cvc|cvv|securitycode|security_code/.test(k)) values[key] = card.cvc;
    else if (/holder|nameoncard|cardholder/.test(k) && card.holderName) values[key] = card.holderName;
  }
  return values;
}
