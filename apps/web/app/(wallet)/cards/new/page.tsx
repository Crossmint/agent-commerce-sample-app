import type { Metadata } from "next";
import { NewCard } from "@/components/new-card";

export const metadata: Metadata = { title: "Add a card" };

export default function NewCardPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Add a card</h1>
        <p className="text-muted-foreground">Saved in Crossmint&apos;s vault. Agents only ever get a bounded budget.</p>
      </div>
      <NewCard />
    </div>
  );
}
