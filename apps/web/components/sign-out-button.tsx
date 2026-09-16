"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStytch } from "@stytch/nextjs";
import { Button, Spinner } from "@goat-wallet/ui";

export function SignOutButton() {
  const stytch = useStytch();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await stytch.session.revoke();
        } finally {
          router.replace("/");
          router.refresh();
        }
      }}
    >
      {busy ? <Spinner /> : null}
      Sign out
    </Button>
  );
}
