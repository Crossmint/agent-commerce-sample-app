import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import localFont from "next/font/local";
import { crossmintEnvironment } from "@/lib/env";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display type: headlines and the "agents" word in the lockup. */
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

/** The GOAT pixel wordmark. Self-hosted; see app/fonts/SOURCES.md. */
const vcrOsdMono = localFont({
  src: "./fonts/vcr-osd-mono.woff2",
  variable: "--font-vcr",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GOAT", template: "%s · GOAT" },
  description: "Your cards. Your agents. You approve every budget.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} ${vcrOsdMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
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
