/** Lazy chunk for WatchHowItWorks: Radix dialog (focus trap, Esc, click outside), captions on, poster, no autoplay. */
import * as D from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { isScaleSkin } from "@/lib/siteSkin";
import scaleLogo from "@assets/brand/scalehealth-logo-srgb-v2.png";

/** One-line swap point: the reel files live at fixed paths under /reel (v5 is live there). */
const R = "/reel";
const FMT = {
  v: { src: `${R}/birch-scale-ad-system-9x16.mp4`, poster: `${R}/poster.jpg`, w: 1080, h: 1920 },
  h: { src: `${R}/birch-scale-ad-system-16x9.mp4`, poster: `${R}/poster-16x9.jpg`, w: 1920, h: 1080 },
};

function useNarrow() {
  const q = "(max-width: 767px)";
  const [n, setN] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setN(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return n;
}

export default function ReelModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const narrow = useNarrow();
  const f = narrow ? FMT.v : FMT.h;
  const vid = useRef<HTMLVideoElement>(null);
  const scale = isScaleSkin();
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    const on = () => {
      for (const t of Array.from(v.textTracks)) t.mode = "showing";
    };
    on();
    v.textTracks.addEventListener?.("addtrack", on);
    return () => v.textTracks.removeEventListener?.("addtrack", on);
  }, [open, f.src]);
  useEffect(() => {
    if (!open) {
      vid.current?.pause();
      return;
    }
    // Native video controls swallow Escape while focused, so listen in the capture phase too.
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [open, onOpenChange]);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[1000] bg-[#071A39]/75 backdrop-blur-[2px]" data-testid="reel-modal-overlay" />
        <D.Content
          data-testid="reel-modal"
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[1001] flex -translate-x-1/2 -translate-y-1/2 flex-col gap-2 outline-none"
          style={narrow ? { width: `min(92vw, calc((100dvh - 120px) * ${f.w / f.h}))` } : { width: `min(90vw, 1040px, calc((100dvh - 140px) * ${f.w / f.h}))` }}
        >
          <div className="flex items-center justify-between gap-3 text-white">
            <D.Title className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              {scale ? (
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1"><img src={scaleLogo} alt="ScaleHealth" width={354} height={68} className="h-3.5 w-auto" data-testid="reel-modal-scale-logo" /></span>
              ) : null}
              <span className="truncate">How the {scale ? "" : "Scale Health "}ad system works</span>
            </D.Title>
            <D.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" aria-label="Close video" data-testid="reel-modal-close">
              <svg viewBox="0 0 14 14" width="14" height="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
            </D.Close>
          </div>
          <div className="overflow-hidden rounded-xl bg-black shadow-2xl" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
            <video key={f.src} ref={vid} className="block h-full w-full" controls playsInline preload="metadata" poster={f.poster} data-testid="reel-modal-video">
              <source src={f.src} type="video/mp4" />
              <track kind="captions" src={`${R}/captions-en.vtt`} srcLang="en" label="English" default />
            </video>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] leading-snug text-white/70">
            <span>Example brand and figures, labelled EXAMPLE. Not results. Prices in USD.</span>
            <a href="/reel" className="font-semibold text-white underline underline-offset-4 hover:no-underline" data-testid="reel-modal-full-page">Open full page ↗</a>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
