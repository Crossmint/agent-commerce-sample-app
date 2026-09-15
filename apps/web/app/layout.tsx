import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: { default: "GOAT", template: "%s · GOAT" },
  description: "Your cards. Your agents. You approve every budget.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
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
