import { redirect } from "next/navigation";

/** An old chat link opens the same conversation inside the app page. */
export default async function ChatByIdRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app?view=desktop&chat=${encodeURIComponent(id)}`);
}
