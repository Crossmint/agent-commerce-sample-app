import type { ComponentType } from "react";

/**
 * Where the approval page is in its mini-sequence.
 * - empty: no saved card yet. "No cards yet" and an "Add a card" button.
 * - card: Visa •••• 4242 was just added. Allow is live, then pressed.
 * - approved: the success page with the check.
 */
export type ApproveState = "empty" | "card" | "approved";

export interface ApproveLayoutProps {
  /** Name of the agent asking. Default "Your agent". */
  agentName?: string;
  /** Agent logo under `public/`. */
  logo?: string;
  state: ApproveState;
}

/**
 * Colors and corners for the card entry form, so each brand's form matches
 * its approval page. Colors are CSS values.
 */
export interface CardFormTheme {
  bg: string;
  text: string;
  muted: string;
  border: string;
  /** Field background. */
  field: string;
  /** Focused field border and the ring around it. */
  focus: string;
  ring: string;
  /** Primary button background (a color or a gradient) and its text. */
  button: string;
  buttonText: string;
  /** Button and field corner radius in px. */
  radius: number;
  fieldRadius: number;
}

export interface ApproveVariant {
  Screen: ComponentType<ApproveLayoutProps>;
  form: CardFormTheme;
}
