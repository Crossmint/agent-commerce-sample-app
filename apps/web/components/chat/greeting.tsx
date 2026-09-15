import { Mascot } from "@goat-wallet/ui";

/** Empty state for a new chat. The mascot is the agent. */
export function Greeting({ suggestions, onPick }: { suggestions: string[]; onPick?: (text: string) => void }) {
  return (
    <div className="goat-backdrop flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <Mascot size={96} />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What should I buy for you?</h1>
        <p className="max-w-md text-muted-foreground">
          I ask for a budget on one of your cards. You approve it here. I never see your card number.
        </p>
      </div>
      {onPick ? (
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
