import { redirect } from "next/navigation";

/** The chat moved into the app page. */
export default function ChatRedirect() {
  redirect("/app?view=desktop");
}
