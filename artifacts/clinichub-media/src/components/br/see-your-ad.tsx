/**
 * "See your ad on a live hub" (Nov 21 2026, attention review): type a brand name and/or add a logo and the ad card
 * on a real hub screenshot becomes yours, instantly. Client-side only: the name and the image never leave the browser
 * (the logo is an object URL, nothing is uploaded or stored). Reuses HubMock + HUB_MOCKS, the same mock the intake uses.
 * It is labelled an illustrative mock, makes no performance claim and sells nothing by itself.
 */
import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { HubMock } from "@/components/br/two-lane";
import { mockBadge } from "@/components/br/next-step";
import { HUB_KEYS, HUB_MOCKS, type HubKey } from "@/lib/hub-mocks";
import { trackAttn } from "@/lib/attention";
import { siteUrl } from "@/lib/siteSkin";
import { RETAIL_MICRO_HUBS } from "../../../../api-server/src/lib/hubLadder";

const MAX_BYTES = 3 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function SeeYourAd({ testId = "see-your-ad", initial = "drho" }: { testId?: string; initial?: HubKey }) {
  const [hub, setHub] = useState<HubKey>(initial);
  const [auto, setAuto] = useState(true);
  /** Rotate through the whole ladder until the visitor picks a hub, types or adds a logo (never with reduced motion). */
  useEffect(() => {
    if (!auto || typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setHub((cur) => HUB_KEYS[(HUB_KEYS.indexOf(cur) + 1) % HUB_KEYS.length]), 4500);
    return () => window.clearInterval(t);
  }, [auto]);
  const [brand, setBrand] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const clearLogo = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setLogo(null);
    if (file.current) file.current.value = "";
  };
  const onFile = (f: File | undefined) => {
    setAuto(false);
    setErr("");
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { setErr("Use a PNG, JPG, WebP or GIF."); return; }
    if (f.size > MAX_BYTES) { setErr("Keep it under 3 MB."); return; }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(f);
    setLogo(urlRef.current);
    trackAttn("preview.logo", { once: true });
  };
  return (
    <div data-testid={testId}>
      <form className="flex gap-2" onSubmit={(e) => e.preventDefault()} aria-label="Preview your brand on a live hub">
        <label className="sr-only" htmlFor={`${testId}-name`}>Your brand name</label>
        <input
          id={`${testId}-name`}
          value={brand}
          maxLength={40}
          autoComplete="off"
          placeholder="Type your brand name"
          onChange={(e) => { setAuto(false); setBrand(e.target.value); trackAttn("preview.type", { once: true }); }}
          className="h-12 min-w-0 flex-1 rounded-full border-2 border-[#0b1f3a]/20 bg-white px-5 text-base font-semibold text-[#0b1f3a] outline-none placeholder:font-normal focus:border-[#0b1f3a] focus:ring-2 focus:ring-lime-300"
          data-testid={`${testId}-input`}
        />
        <input ref={file} type="file" accept={OK_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid={`${testId}-file`} />
        {logo ? (
          <button type="button" onClick={clearLogo} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#0b1f3a]/20 bg-white px-4 text-sm font-bold text-[#0b1f3a] hover:border-[#0b1f3a]" data-testid={`${testId}-clear`}>
            <X className="size-4" aria-hidden /> Remove logo
          </button>
        ) : (
          <button type="button" onClick={() => file.current?.click()} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[#0b1f3a]/20 bg-white px-4 text-sm font-bold text-[#0b1f3a] hover:border-[#0b1f3a]" data-testid={`${testId}-upload`}>
            <ImagePlus className="size-4" aria-hidden /> Add logo
          </button>
        )}
      </form>
      <p className="mt-1.5 text-[12px] text-foreground/60" role={err ? "alert" : undefined}>{err || "Stays in your browser. Nothing is uploaded."}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#F1D58F] bg-[#FFF4DB] px-2.5 py-1 text-[11px] font-bold text-[#8A5A00]" data-testid="mock-badge">{mockBadge(hub)}</span>
        <div className="flex max-w-full items-center gap-1.5 overflow-x-auto text-[11px] font-bold uppercase tracking-wider [scrollbar-width:none]" role="group" aria-label="Live hub">
          {HUB_KEYS.map((h) => (
            <button key={h} type="button" aria-pressed={hub === h} onClick={() => { setAuto(false); setHub(h); trackAttn("preview.hub", { once: true }); }} className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1 ${hub === h ? "bg-[#0b1f3a] text-white" : "bg-white text-foreground/70 ring-1 ring-foreground/15"}`} data-testid={`mock-hub-${h}`}>
              {HUB_MOCKS[h].tab}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2" onPointerDown={() => setAuto(false)}><HubMock brand={brand} logo={logo} hub={hub} category="Your category" badge={mockBadge(hub)} /></div>
      <p className="mt-1.5 text-[12px] font-semibold"><a href={siteUrl("/hubs")} data-mirror-keep className="text-[#0b1f3a] underline underline-offset-2" data-testid={`${testId}-see-all`}>See all {HUB_KEYS.length + RETAIL_MICRO_HUBS.length} hubs</a> <span className="font-normal text-foreground/60">· {HUB_KEYS.length} shown here: Live now and Activating example mockups</span></p>
    </div>
  );
}
