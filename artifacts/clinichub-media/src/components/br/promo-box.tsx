import { useEffect, useRef } from "react";
import { ensurePromo } from "@/lib/promo";

/** "Have a code?" (mode form), account box, or the thank-you banner (mode success). Same script as the server-rendered pages. */
export function PromoBox({ mode = "form" }: { mode?: "form" | "account" | "success" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ensurePromo();
    if (ref.current) window.BRPromo?.mount(ref.current, { mode });
  }, [mode]);
  return <div ref={ref} data-testid={`promo-${mode}`} />;
}
