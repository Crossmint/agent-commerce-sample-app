import { Plus } from "lucide-react";
import { Section, SectionHeading } from "./section";

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "How is this different from Stripe Link?",
    a: "Link stores a shopper's card for checkout on Stripe merchants, for the shopper. This sample app is for agent platforms: the user saves a card once with your platform, agents request bounded budgets the user approves, the card network mints scoped tokens per merchant, and Crossmint can run the checkout at any store, not only Stripe merchants. You own the user relationship and the approval screen.",
  },
  {
    q: "Does the agent ever see the card number?",
    a: "No. Saving runs in Crossmint's PCI component. Checkouts are paid by Crossmint. A revealed credential is a scoped network token, and the sample app never prints it in a chat.",
  },
  {
    q: "Which card networks are supported?",
    a: "Visa Intelligent Commerce and Mastercard Agent Pay for enforced limits, plus an encrypted-card fallback where the limit is advisory.",
  },
  {
    q: "Can I use my own auth?",
    a: "Yes. Implement one UserAuth interface from @agent-commerce/auth. Stytch is the default adapter.",
  },
  {
    q: "Where does the code run?",
    a: "One Next.js app: the API (@agent-commerce/server), the UI (@agent-commerce/ui), the MCP endpoint, and the CLI. Deploy it on Vercel or any Node host.",
  },
  {
    q: "Is it production ready?",
    a: "It is a sample app. It runs against production Crossmint keys and real cards, and it shows the flows end to end, but review it before shipping it to your users.",
  },
];

/** Section `#faq`: native disclosure widgets, styled as cards. */
export function Faq() {
  return (
    <Section id="faq">
      <SectionHeading title="Questions" />
      <div className="flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group rounded-2xl bg-card ring-1 ring-foreground/10 open:bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left text-[16px] leading-snug font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6 sm:text-[17px] [&::-webkit-details-marker]:hidden">
              {q}
              <Plus aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45" strokeWidth={2.2} />
            </summary>
            <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted-foreground sm:px-6">{a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
