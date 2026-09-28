"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Button, ConnectedAgents, Dialog, DialogContent, DialogTitle, type ConnectedAgentSession } from "@agent-commerce/ui";
import { LoginForm } from "@/components/login-form";
import { loginNext, type Choice } from "./types";

/**
 * The sessions block the MCP and CLI panels end with. Signed in, it lists
 * every connected agent with a way to log one out. Signed out, one button
 * opens the login in a dialog, since these panels are not phones.
 */
export function ConnectedAgentsBlock({
  choice,
  signedIn,
  sessions,
  sessionsNote,
  revokeSession,
  onSignedIn,
}: {
  /** The frame the login should come back to. */
  choice: Choice;
  signedIn: boolean;
  sessions: ConnectedAgentSession[];
  sessionsNote?: string;
  revokeSession: (sessionId: string) => Promise<void>;
  onSignedIn: () => void;
}) {
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">Connected agents</h2>
        <p className="text-sm text-muted-foreground">{sessionsNote ?? "Each CLI or MCP login is a session. Revoke one to log that agent out."}</p>
      </div>
      {signedIn ? (
        <ConnectedAgents sessions={sessions} onRevoke={revokeSession} />
      ) : (
        <>
          <Button type="button" size="xl" className="w-full" onClick={() => setLoginOpen(true)}>
            <LogIn /> Log in
          </Button>
          <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogTitle className="sr-only">Log in</DialogTitle>
              <LoginForm
                next={loginNext(choice)}
                onSignedIn={() => {
                  setLoginOpen(false);
                  onSignedIn();
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </section>
  );
}
