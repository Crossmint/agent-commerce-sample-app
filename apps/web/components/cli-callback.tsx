"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardHeader, CardTitle } from "@goat-wallet/ui";

export function CliCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const [copied, setCopied] = useState(false);
  if (error || !code) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertTitle>Login did not finish</AlertTitle>
        <AlertDescription>{error ?? "No code was returned. Run `goat login --code` again."}</AlertDescription>
      </Alert>
    );
  }
  const value = state ? `code=${code}&state=${state}` : code;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the user can select the text */
    }
  }
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Almost there</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">Paste this into your terminal.</p>
        <code className="block select-all break-all rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          {value}
        </code>
        <Button onClick={copy} className="w-full">
          {copied ? "Copied" : "Copy"}
        </Button>
        <p className="text-xs text-muted-foreground">You can close this window after pasting.</p>
      </CardContent>
    </Card>
  );
}
