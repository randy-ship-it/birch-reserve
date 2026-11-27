import { useEffect, useRef } from "react";
import { ensurePromo } from "@/lib/promo";

/** "Have a code?" (mode form), account box, or the thank-you banner (mode success). Same script as the server-rendered pages. */
export function PromoBox({ mode = "form", quiet = false }: { mode?: "form" | "account" | "success"; /** BR-83: collapsed small "Have a code?" link (still opens to the same field). */ quiet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ensurePromo();
    if (ref.current) window.BRPromo?.mount(ref.current, { mode, quiet });
  }, [mode, quiet]);
  return <div ref={ref} data-testid={`promo-${mode}`} />;
}
