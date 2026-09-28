import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist_Mono, Mona_Sans, Space_Grotesk } from "next/font/google";
import { InlineScript } from "@/components/frame/inline-script";
import { crossmintEnvironment } from "@/lib/env";
import { Providers } from "./providers";
import "./globals.css";

/** Display face for figures and headlines. Body text uses the system stack. */
const monaSans = Mona_Sans({ subsets: ["latin"], variable: "--font-mona" });

/** The faces the two other example brands use: Nova is set in Space Grotesk, Maple's headings in Fraunces. */
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-nova", weight: ["400", "500", "600", "700"] });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-maple", weight: ["400", "500", "600"], style: ["normal", "italic"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Agent Commerce Sample App", template: "%s · Agent Commerce Sample App" },
  description: "All the APIs you need to enable agentic commerce for your agent platform. Powered by Crossmint.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      // The inline script sets --device-scale on <html> before hydration.
      suppressHydrationWarning
      className={`${monaSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${fraunces.variable} h-full font-sans antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-app-canvas text-foreground">
        {/* Formula must match components/frame/device-frame.tsx. */}
        <InlineScript html="(function(){try{var m=window.innerWidth>=1536?96:40;var s=Math.max(0.35,Math.min(1,(window.innerHeight-m)/886));document.documentElement.style.setProperty('--device-scale',String(s));}catch(e){}})();" />
        <Providers
          crossmintClientApiKey={process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY}
          crossmintEnvironment={crossmintEnvironment()}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
