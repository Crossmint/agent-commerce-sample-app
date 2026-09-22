import Image from "next/image";
import Link from "next/link";
import { BookOpen, Mail } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@agent-commerce/ui";
import { GitHubMark } from "@/components/landing/social-marks";
import { DOCS_URL, GITHUB_URL } from "@/components/landing/links";
import { cn } from "@/lib/cn";

const CONTACT_SALES_URL = "https://www.crossmint.com/contact/sales";

const LINK_BUTTON_CLASS =
  "flex size-10 items-center justify-center rounded-lg border border-border bg-background shadow-[0px_1px_2px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0px_2px_6px_rgba(0,0,0,0.08)]";

// Matches the phone mockup's zoom-in.
const HEADER_ENTER_DELAY_MS = 400;

function HeaderLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={LINK_BUTTON_CLASS}>
          {children}
        </a>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The logo card in the top left corner of every framed page: the Crossmint
 * logotype, then Docs, GitHub and Contact sales as icon buttons.
 */
export function SiteHeader({ animate = true }: { animate?: boolean }) {
  return (
    <div
      className={cn("flex items-center gap-2.5 rounded-[10px] border border-border bg-background/80 p-1.5 backdrop-blur", animate && "enter-down enter-down-far")}
      style={animate ? { animationDelay: `${HEADER_ENTER_DELAY_MS}ms` } : undefined}
    >
      <Link href="/" aria-label="Agent Commerce Sample App home" className="flex items-center justify-center rounded-[6px] px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Image src="/crossmint.svg" alt="Crossmint" width={117} height={22} priority />
      </Link>
      <div className="flex items-center gap-1.5">
        <HeaderLink href={DOCS_URL} label="Docs">
          <BookOpen className="size-5 text-foreground" />
        </HeaderLink>
        <HeaderLink href={GITHUB_URL} label="GitHub">
          <GitHubMark className="size-5 text-foreground" />
        </HeaderLink>
        <HeaderLink href={CONTACT_SALES_URL} label="Contact sales">
          <Mail className="size-5 text-foreground" />
        </HeaderLink>
      </div>
    </div>
  );
}
