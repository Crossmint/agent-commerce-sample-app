import { redirect } from "next/navigation";

/** Transactions live under Cards in the app page's desktop frame. */
export default function TransactionsRedirect() {
  redirect("/app?view=desktop");
}
