/**
 * "Details" toggle (Randy, Nov 19 2026 10:54 AM ET: less content). Small print, methodology and disclaimers live
 * here, collapsed by default; key numbers stay on the page. Native <details>, so it works without JS and in print.
 */
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function Details({ children, label = "Details", testId, dark, className = "" }: { children: ReactNode; label?: string; testId?: string; dark?: boolean; className?: string }) {
  return (
    <details data-testid={testId} className={`group mt-3 text-[12px] leading-relaxed ${dark ? "text-white/70" : "text-foreground/60"} ${className}`}>
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1 font-semibold underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden ${dark ? "text-white/80" : "text-foreground/70"}`}>
        <ChevronDown className="size-3.5 transition group-open:rotate-180" aria-hidden />{label}
      </summary>
      <div className="mt-2 space-y-1.5">{children}</div>
    </details>
  );
}
