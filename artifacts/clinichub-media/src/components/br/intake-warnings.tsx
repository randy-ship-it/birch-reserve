/** Friday v1.2 §7 warnings[] (only when Friday ignored part of an answer), shown gently. Never blocks submit. */
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { WARN_EVENT } from "@/lib/fridayBrandIntake";

const friendly = (w: string) =>
  /^geo/i.test(w) ? "We couldn't read your markets answer, so we'll confirm where you sell and ship when we review." : /^category/i.test(w) ? "We'll confirm your category when we review." : "Part of your answer wasn't used. We'll confirm it with you when we review.";

let last: string[] = [];
if (typeof window !== "undefined") window.addEventListener(WARN_EVENT, (e) => (last = [...new Set(((e as CustomEvent<string[]>).detail ?? []).map(friendly))]));

export function IntakeWarnings({ testId = "intake-warnings" }: { testId?: string }) {
  const [w, setW] = useState<string[]>(last);
  useEffect(() => {
    const f = (e: Event) => setW([...new Set(((e as CustomEvent<string[]>).detail ?? []).map(friendly))]);
    window.addEventListener(WARN_EVENT, f);
    return () => window.removeEventListener(WARN_EVENT, f);
  }, []);
  if (!w.length) return null;
  return (
    <div role="status" data-testid={testId} className="mt-3 flex items-start gap-2 rounded-xl bg-[#FAF8F3] p-3 text-[13px] text-[#5E6B64]">
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>{w.map((x) => <p key={x}>{x}</p>)}</div>
    </div>
  );
}
