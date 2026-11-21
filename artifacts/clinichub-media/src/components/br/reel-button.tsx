/**
 * "Watch how it works" (Randy, Nov 21 2026 4:21 PM ET): one shared button that opens the /reel walkthrough in a modal.
 * The player (and the video bytes) load only on first intent: hover/focus prefetches the chunk, click opens it.
 * Same component on birchreserve.net and the Scale mirror; root-relative media paths are rewritten by the mirror.
 */
import { lazy, Suspense, useState } from "react";

const loadModal = () => import("./reel-modal");
const ReelModal = lazy(loadModal);

export function WatchHowItWorks({ className = "", testId = "watch-how-it-works", placement = "page" }: { className?: string; testId?: string; placement?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const show = () => {
    setMounted(true);
    setOpen(true);
  };
  return (
    <>
      <button
        type="button"
        onClick={show}
        onMouseEnter={() => void loadModal()}
        onFocus={() => void loadModal()}
        aria-haspopup="dialog"
        data-placement={placement}
        data-testid={testId}
        className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#0b1f3a]/15 bg-white/85 pl-1 pr-3.5 text-[13px] font-semibold text-[#0b1f3a] shadow-sm transition hover:border-[#0b1f3a]/35 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b1f3a] ${className}`}
      >
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-[#0b1f3a] text-[#C8F55A]">
          <svg viewBox="0 0 12 12" width="10" height="10" fill="currentColor"><path d="M3 1.6v8.8L10.2 6z" /></svg>
        </span>
        Watch how it works
        <span className="font-normal text-[#0b1f3a]/55">· 51s</span>
      </button>
      {mounted ? (
        <Suspense fallback={null}>
          <ReelModal open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
