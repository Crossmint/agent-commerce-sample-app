"use client";

import { useEffect, useState } from "react";

export function Clock() {
  // 9:41 until mounted keeps SSR and the first client render equal.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = now.getHours() % 12 || 12;
      setTime(`${hours}:${String(now.getMinutes()).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-[17px] font-semibold tracking-tight tabular-nums" suppressHydrationWarning>
      {time ?? "9:41"}
    </span>
  );
}
