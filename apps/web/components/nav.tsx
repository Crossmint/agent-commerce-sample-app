import Link from "next/link";
import { GoatLockup } from "./brand";
import { SignOutButton } from "./sign-out-button";

export interface NavProps {
  email?: string;
  chatEnabled?: boolean;
}

export function Nav({ email, chatEnabled = false }: NavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center" aria-label="GOAT home">
          <GoatLockup size="sm" />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <Link href="/wallet" className="hover:text-foreground">
            Wallet
          </Link>
          <Link href="/cards/new" className="hover:text-foreground">
            Add card
          </Link>
          {chatEnabled ? (
            <Link href="/chat" className="hover:text-foreground">
              Chat
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {email ? <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span> : null}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
