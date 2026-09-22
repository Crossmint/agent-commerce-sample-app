import { redirect } from "next/navigation";

/** The wallet moved into the app page's desktop frame. */
export default function WalletRedirect() {
  redirect("/app?view=desktop");
}
