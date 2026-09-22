"use client";

import * as React from "react";
import type { RenderedAction, RenderedField } from "@agent-commerce/core";
import { cn } from "../lib/utils.js";
import { formatDateTime } from "../lib/format.js";
import { Button } from "./primitives/button.js";
import { Input } from "./primitives/input.js";
import { Label } from "./primitives/label.js";
import { NativeSelect } from "./primitives/native-select.js";
import { Spinner } from "./primitives/spinner.js";

export interface PendingActionFormProps {
  action: RenderedAction;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  className?: string;
}

type Values = Record<string, unknown>;

/** The phone-screen field: tall, 12px corners, on the grey fill, no border. */
const FIELD = "h-12 rounded-xl border-0 bg-muted px-4 shadow-none";

function getAt(values: Values, path: string[]): unknown {
  let cur: unknown = values;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function setAt(values: Values, path: string[], value: unknown): Values {
  if (path.length === 0) return values;
  const [head, ...rest] = path as [string, ...string[]];
  const next = { ...values };
  if (rest.length === 0) {
    next[head] = value;
  } else {
    const child = next[head];
    next[head] = setAt(typeof child === "object" && child !== null ? (child as Values) : {}, rest, value);
  }
  return next;
}

function defaultsFor(fields: RenderedField[], acc: Values = {}): Values {
  let out = acc;
  for (const f of fields) {
    if (f.kind === "object" && f.children) out = defaultsFor(f.children, out);
    else if (f.default !== undefined) out = setAt(out, f.path, f.default);
    else if (f.kind === "boolean") out = setAt(out, f.path, false);
  }
  return out;
}

/**
 * Renders a checkout's pending user action (shipping, size, a question) from
 * its JSON Schema, walked into fields by `renderPendingAction` in core.
 */
export function PendingActionForm({ action, onSubmit, submitting = false, submitLabel = "Continue", className }: PendingActionFormProps) {
  const [values, setValues] = React.useState<Values>(() => defaultsFor(action.fields));

  React.useEffect(() => {
    setValues(defaultsFor(action.fields));
  }, [action.id, action.fields]);

  const update = (path: string[], value: unknown) => setValues((prev) => setAt(prev, path, value));

  return (
    <form
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit(values);
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-medium">{action.title}</h3>
        {action.description ? <p className="text-sm text-muted-foreground">{action.description}</p> : null}
        {action.expiresAt ? (
          <p className="text-xs text-muted-foreground">Answer before {formatDateTime(action.expiresAt)}.</p>
        ) : null}
      </div>
      <FieldList fields={action.fields} values={values} update={update} disabled={submitting} />
      <Button type="submit" size="xl" className="w-full" disabled={submitting}>
        {submitting ? <Spinner /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

function FieldList({
  fields,
  values,
  update,
  disabled,
}: {
  fields: RenderedField[];
  values: Values;
  update: (path: string[], value: unknown) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => (
        <Field key={f.path.join(".")} field={f} values={values} update={update} disabled={disabled} />
      ))}
    </div>
  );
}

function Field({
  field,
  values,
  update,
  disabled,
}: {
  field: RenderedField;
  values: Values;
  update: (path: string[], value: unknown) => void;
  disabled: boolean;
}) {
  const id = `paf-${field.path.join("-")}`;
  const value = getAt(values, field.path);
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-destructive">*</span> : null}
    </Label>
  );
  const help = field.description ? <p className="text-xs text-muted-foreground">{field.description}</p> : null;

  switch (field.kind) {
    case "object":
      return (
        <fieldset className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-medium">{field.label}</legend>
          {help}
          <FieldList fields={field.children ?? []} values={values} update={update} disabled={disabled} />
        </fieldset>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={Boolean(value)}
            required={field.required}
            disabled={disabled}
            onChange={(e) => update(field.path, e.target.checked)}
          />
          {label}
          {help}
        </div>
      );
    case "select":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <NativeSelect
            id={id}
            className={FIELD}
            required={field.required}
            disabled={disabled}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              const match = field.options?.find((o) => String(o.value) === raw);
              update(field.path, match ? match.value : raw);
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {field.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          {help}
        </div>
      );
    case "array":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            className={FIELD}
            required={field.required}
            disabled={disabled}
            placeholder="Separate items with commas"
            value={Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value : ""}
            onChange={(e) =>
              update(
                field.path,
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
          {help}
        </div>
      );
    case "number":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            className={FIELD}
            type="number"
            inputMode="decimal"
            required={field.required}
            disabled={disabled}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => update(field.path, e.target.value === "" ? undefined : Number(e.target.value))}
          />
          {help}
        </div>
      );
    default: {
      const type =
        field.kind === "email" ? "email" : field.kind === "url" ? "url" : field.kind === "date" ? (field.format === "date-time" ? "datetime-local" : "date") : "text";
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            className={FIELD}
            type={type}
            required={field.required}
            disabled={disabled}
            pattern={field.pattern}
            value={typeof value === "string" ? value : value === undefined || value === null ? "" : String(value)}
            onChange={(e) => update(field.path, e.target.value)}
          />
          {help}
        </div>
      );
    }
  }
}
