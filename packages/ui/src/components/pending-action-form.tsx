"use client";

import * as React from "react";
import type { CrossmintProtectedInputRef } from "@crossmint/client-sdk-react-ui";
import type { CheckoutFormAnswer, RenderedAction, RenderedField } from "@agent-commerce/core";
import { cn } from "../lib/utils.js";
import { formatDateTime } from "../lib/format.js";
import { Button } from "./primitives/button.js";
import { Input } from "./primitives/input.js";
import { Label } from "./primitives/label.js";
import { NativeSelect } from "./primitives/native-select.js";
import { Spinner } from "./primitives/spinner.js";
import { ProtectedField } from "./protected-input.js";

export type FormAnswers = Record<string, CheckoutFormAnswer>;

export interface PendingActionFormProps {
  action: RenderedAction;
  /**
   * Fires with every field's answer, keyed by field name. A protected field's
   * answer is the `{ protectedInputId }` Crossmint's field returned, collected
   * on submit; the secret never reaches this app.
   */
  onSubmit: (answers: FormAnswers) => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  className?: string;
}

type Value = string | number | boolean | string[] | undefined;
type Values = Record<string, Value>;

/** The phone-screen field: tall, 12px corners, on the grey fill, no border. */
const FIELD = "h-12 rounded-xl border-0 bg-muted px-4 shadow-none";

function defaultsFor(fields: RenderedField[]): Values {
  const out: Values = {};
  for (const f of fields) {
    if (f.default !== undefined) out[f.name] = f.default;
    else if (f.kind === "boolean") out[f.name] = false;
    else if (f.kind === "multiselect") out[f.name] = [];
  }
  return out;
}

/** The fields still missing an answer, by label. Protected ones are checked by Crossmint's field on submit. */
function missingOf(fields: RenderedField[], values: Values): string[] {
  return fields
    .filter((f) => {
      const value = values[f.name];
      if (f.kind === "protected" || f.kind === "boolean") return false;
      if (f.kind === "multiselect") {
        const n = Array.isArray(value) ? value.length : 0;
        if (n === 0 && !f.required) return false;
        return n < (f.min ?? 0) || (f.max !== undefined && n > f.max);
      }
      if (f.kind === "number" && value !== undefined) {
        return typeof value !== "number" || !Number.isFinite(value) || (f.integer === true && !Number.isSafeInteger(value));
      }
      return f.required && (value === undefined || value === "");
    })
    .map((f) => f.label);
}

/** Most options a question may have and still show as buttons. */
const MAX_CHOICES = 8;

/** The one field of a question that is only a choice, when it is. Its options become buttons. */
function singleChoice(fields: RenderedField[]): RenderedField | undefined {
  const [only] = fields;
  if (fields.length !== 1 || !only || only.kind !== "select") return undefined;
  const n = only.options?.length ?? 0;
  return n > 0 && n <= MAX_CHOICES ? only : undefined;
}

/**
 * Renders a checkout's pending user action (shipping, size, a sign-in) from
 * its fields, as `renderPendingAction` in core lists them.
 *
 * A question that is one choice shows its options as buttons, and a tap
 * answers it. Everything else is a form with a submit button. A protected
 * field, such as a password, is Crossmint's own field: on submit, each one
 * is collected into Crossmint's vault, and the form sends only the ids.
 */
export function PendingActionForm({ action, onSubmit, submitting = false, submitLabel = "Continue", className }: PendingActionFormProps) {
  const [values, setValues] = React.useState<Values>(() => defaultsFor(action.fields));
  const [picked, setPicked] = React.useState<string | undefined>(undefined);
  // Optional secrets are left out until the user chooses to add them.
  const [included, setIncluded] = React.useState<ReadonlySet<string>>(() => requiredSecrets(action.fields));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [collecting, setCollecting] = React.useState(false);
  const refs = React.useRef(new Map<string, CrossmintProtectedInputRef | null>());

  // Start over for a new question, and only then. A poll hands back the same
  // question as a fresh object every few seconds; keying on the object would
  // wipe what the user is typing. Reset during render, the React pattern for
  // state derived from the previous render.
  const [shownId, setShownId] = React.useState(action.id);
  if (shownId !== action.id) {
    setShownId(action.id);
    setValues(defaultsFor(action.fields));
    setPicked(undefined);
    setIncluded(requiredSecrets(action.fields));
    setErrors({});
  }

  const busy = submitting || collecting;
  const update = (name: string, value: Value) => setValues((prev) => ({ ...prev, [name]: value }));
  const choice = singleChoice(action.fields);
  const missing = missingOf(action.fields, values);

  const submit = async () => {
    if (busy || missing.length > 0) return;
    const answers: FormAnswers = {};
    for (const f of action.fields) {
      const value = values[f.name];
      if (f.kind === "protected" || value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0 && !f.required) continue;
      answers[f.name] = value;
    }
    const secrets = action.fields.filter((f) => f.kind === "protected" && included.has(f.name));
    if (secrets.length > 0) {
      setCollecting(true);
      setErrors({});
      try {
        // Every field reports at once, so the user sees each problem together.
        const results = await Promise.all(
          secrets.map(async (f) => {
            const field = refs.current.get(f.name);
            if (!field) {
              return [f.name, { status: "unavailable", message: "The secure field is still loading. Try again." }] as const;
            }
            return [f.name, await field.collect()] as const;
          }),
        );
        const failed: Record<string, string> = {};
        for (const [name, result] of results) {
          if (result.status === "collected") answers[name] = result.input;
          else failed[name] = result.message;
        }
        if (Object.keys(failed).length > 0) {
          setErrors(failed);
          return;
        }
      } catch {
        // An unexpected SDK fault: say so, never the provider's payload.
        setErrors(Object.fromEntries(secrets.map((f) => [f.name, "The secure field is unavailable. Try again."])));
        return;
      } finally {
        setCollecting(false);
      }
    }
    await onSubmit(answers);
  };

  const heading = (
    <div className="flex flex-col gap-1">
      {action.title ? <h3 className="text-xl font-medium">{action.title}</h3> : null}
      {action.expiresAt ? (
        <p className="text-xs text-muted-foreground">Answer before {formatDateTime(action.expiresAt)}.</p>
      ) : null}
    </div>
  );

  if (choice) {
    return (
      <div className={cn("flex flex-col gap-5", className)}>
        {heading}
        <div role="group" aria-label={choice.label} className="flex flex-col gap-2">
          {choice.options!.map((o) => {
            const sending = submitting && picked === o.value;
            return (
              <Button
                key={o.value}
                type="button"
                size="xl"
                variant="secondary"
                className="w-full justify-start"
                disabled={submitting || o.disabled}
                onClick={() => {
                  setPicked(o.value);
                  void onSubmit({ [choice.name]: o.value });
                }}
              >
                {sending ? <Spinner /> : null}
                {o.label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {heading}
      <div className="flex flex-col gap-4">
        {action.fields.map((f) =>
          f.kind === "protected" && f.protectedField ? (
            <SecretField
              key={f.name}
              field={f}
              included={included.has(f.name)}
              onInclude={(include) =>
                setIncluded((prev) => {
                  const next = new Set(prev);
                  if (include) next.add(f.name);
                  else next.delete(f.name);
                  return next;
                })
              }
              collectorRef={(el) => {
                if (el) refs.current.set(f.name, el);
                else refs.current.delete(f.name);
              }}
              error={errors[f.name]}
              disabled={busy}
            />
          ) : (
            <Field key={f.name} field={f} value={values[f.name]} update={update} disabled={busy} />
          ),
        )}
      </div>
      {missing.length > 0 ? (
        <p className="text-xs text-muted-foreground">Still needed: {missing.join(", ")}</p>
      ) : null}
      <Button type="submit" size="xl" className="w-full" disabled={busy || missing.length > 0}>
        {busy ? <Spinner /> : null}
        {collecting ? "Securing…" : submitLabel}
      </Button>
    </form>
  );
}

function requiredSecrets(fields: RenderedField[]): ReadonlySet<string> {
  return new Set(fields.filter((f) => f.kind === "protected" && f.required).map((f) => f.name));
}

/** A protected field, or for an optional one, the choice to add it. */
function SecretField({
  field,
  included,
  onInclude,
  collectorRef,
  error,
  disabled,
}: {
  field: RenderedField;
  included: boolean;
  onInclude: (include: boolean) => void;
  collectorRef: React.Ref<CrossmintProtectedInputRef>;
  error?: string;
  disabled: boolean;
}) {
  const id = `paf-${field.name}`;
  return (
    <div className="flex flex-col gap-2">
      {field.required ? null : (
        <div className="flex items-center gap-3">
          <input
            id={`${id}-include`}
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={included}
            disabled={disabled}
            onChange={(e) => onInclude(e.target.checked)}
          />
          <Label htmlFor={`${id}-include`}>Add {field.label.toLowerCase()}</Label>
        </div>
      )}
      {included ? (
        <ProtectedField
          ref={collectorRef}
          field={field.protectedField!}
          error={error}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

function Field({
  field,
  value,
  update,
  disabled,
}: {
  field: RenderedField;
  value: Value;
  update: (name: string, value: Value) => void;
  disabled: boolean;
}) {
  const id = `paf-${field.name}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-destructive">*</span> : null}
    </Label>
  );

  switch (field.kind) {
    case "boolean":
      return (
        <div className="flex items-center gap-3">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-input accent-primary"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => update(field.name, e.target.checked)}
          />
          {label}
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
            value={typeof value === "string" ? value : ""}
            onChange={(e) => update(field.name, e.target.value === "" ? undefined : e.target.value)}
          >
            <option value="" disabled={field.required}>
              Choose…
            </option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      );
    case "multiselect": {
      const picked = Array.isArray(value) ? value : [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {field.label}
            {field.required ? <span className="text-destructive">*</span> : null}
          </legend>
          {field.options?.map((o) => (
            <div key={o.value} className="flex items-center gap-3">
              <input
                id={`${id}-${o.value}`}
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={picked.includes(o.value)}
                disabled={disabled || o.disabled}
                onChange={(e) =>
                  update(field.name, e.target.checked ? [...picked, o.value] : picked.filter((v) => v !== o.value))
                }
              />
              <Label htmlFor={`${id}-${o.value}`}>{o.label}</Label>
            </div>
          ))}
        </fieldset>
      );
    }
    case "number":
      return (
        <div className="flex flex-col gap-2">
          {label}
          <Input
            id={id}
            className={FIELD}
            type="number"
            inputMode={field.integer ? "numeric" : "decimal"}
            step={field.integer ? 1 : "any"}
            required={field.required}
            disabled={disabled}
            value={typeof value === "number" ? String(value) : ""}
            onChange={(e) => update(field.name, e.target.value === "" ? undefined : Number(e.target.value))}
          />
        </div>
      );
    default: {
      const shared = {
        id,
        required: field.required,
        disabled,
        placeholder: field.placeholder,
        autoComplete: field.autoComplete,
        value: typeof value === "string" ? value : "",
      };
      return (
        <div className="flex flex-col gap-2">
          {label}
          {field.multiline ? (
            <textarea
              {...shared}
              rows={3}
              className="min-h-24 rounded-xl border-0 bg-muted px-4 py-3 text-base shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
              onChange={(e) => update(field.name, e.target.value)}
            />
          ) : (
            <Input
              {...shared}
              className={FIELD}
              type={field.masked ? "password" : "text"}
              inputMode={field.inputMode}
              onChange={(e) => update(field.name, e.target.value)}
            />
          )}
        </div>
      );
    }
  }
}
