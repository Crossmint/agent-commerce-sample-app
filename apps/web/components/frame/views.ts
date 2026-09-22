import { MessageCircle, Monitor, Plug, Smartphone, Terminal } from "lucide-react";

/*
 * The five experiences and their names. A plain module, no "use client", so
 * a server component can read the `view` search param without pulling the
 * switcher's client bundle along.
 */

export const VIEWS = ["mobile", "desktop", "messaging", "mcp", "cli"] as const;
export type View = (typeof VIEWS)[number];

export const VIEW_META: Record<View, { label: string; icon: typeof Smartphone }> = {
  mobile: { label: "Mobile", icon: Smartphone },
  desktop: { label: "Desktop", icon: Monitor },
  messaging: { label: "Messaging app", icon: MessageCircle },
  mcp: { label: "Agent MCP", icon: Plug },
  cli: { label: "CLI skill", icon: Terminal },
};

export function isView(v: string | null | undefined): v is View {
  return VIEWS.includes(v as View);
}

/** Reads a `view` param, accepting the old `imessage` name for the messaging view. */
export function parseView(v: string | null | undefined, fallback: View = "mobile"): View {
  if (v === "imessage") return "messaging";
  return isView(v) ? v : fallback;
}

/** The chat apps the messaging view can imitate. */
export const MESSAGING_APPS = ["imessage", "whatsapp", "instagram"] as const;
export type MessagingApp = (typeof MESSAGING_APPS)[number];

/** `logo` is served from /logos and carries the app's own brand color. */
export const MESSAGING_APP_META: Record<MessagingApp, { label: string; logo: string }> = {
  imessage: { label: "iMessage", logo: "/logos/imessage.svg" },
  whatsapp: { label: "WhatsApp", logo: "/logos/whatsapp.svg" },
  instagram: { label: "Instagram", logo: "/logos/instagram.svg" },
};

export function isMessagingApp(v: string | null | undefined): v is MessagingApp {
  return MESSAGING_APPS.includes(v as MessagingApp);
}
