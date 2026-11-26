/**
 * /intake/reel: the reel landing page under /intake so scalehealth.ca/intake/reel serves it through the mirror with Scale
 * chrome, Scale Squirrel and Scale-direct CTAs (Randy t419u, Nov 21 2026 5:03 PM). birchreserve.net/reel stays the
 * static page in public/reel; this page uses the same v5 files, captions, tiles and transcript.
 * On the Scale skin every CTA stays under /intake (kit, /intake/_m/exclusive, /intake/_m/media-kit) so a checkout started
 * here is Scale Health direct (sold_by=scale).
 */
import { useEffect, useRef } from "react";
import { usePageMeta } from "@/components/br/ui";
import { HubAlerts } from "@/components/br/hub-alerts";
import { SurfaceTypes } from "@/components/br/surface-types";
import { ScaleAdUnitLockup } from "@/components/br/scale-ad-unit-lockup";
import { useCurrency } from "@/lib/currency";
import { isScaleSkin } from "@/lib/siteSkin";

const R = "/reel";
/** The Scale skin plays its own render: same reel, but the last slide is Scale's three exclusive private channels (Randy, Nov 21 2026 5:38 PM). */
const SCALE_END = "Three exclusive private channels: branded hubs, our digital and brick-and-mortar provider network across Canada and the USA, and Calm Joints, our recovery store, with Street Team ambassadors. Download your monetization kit for a free customized assessment for your business.";
const REEL_FILES = (scale: boolean) => scale
  ? { v: `${R}/scale-ad-system-9x16.mp4`, h: `${R}/scale-ad-system-16x9.mp4`, vtt: `${R}/captions-scale-en.vtt`, len: "One-minute walkthrough" }
  : { v: `${R}/birch-scale-ad-system-9x16.mp4`, h: `${R}/birch-scale-ad-system-16x9.mp4`, vtt: `${R}/captions-en.vtt`, len: "50-second walkthrough" };
const TRANSCRIPT =
  "Hey guys, here's the Scale Health ad system. One distribution network, for brands and for hubs. Starting as a supplier only? Stay performance-only, and earn when your products sell across our distribution channels. Maximize that exposure by activating your own audience, with a co-branded hub. Your dashboard shows your audience. Then tap our targeted audiences with open inventory, and crush it with yours. Ready for ads? Go deep where you know you'll convert, in front of the right audiences for your brand. Upload your ad, check out through Birch Reserve, and watch views, clicks and claims in your own cockpit. Recovery is live now. Longevity, sleep, fitness, food and nutrition, medi-spa, mental health and pets are coming next. One distribution system. Birch Reserve, plus Scale Health.";

const I = {
  box: <><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" /><path d="M12 11v10" /></>,
  home: <><path d="M3 10.5L12 4l9 6.5" /><path d="M5 9.5V20h14V9.5" /><path d="M9.5 20v-5h5v5" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" strokeDasharray="2.5 2" /></>,
};

const TILES: { k: string; h: string; p: React.ReactNode; d: string; ds?: string; icon: keyof typeof I }[] = [
  { k: "01 · Supplier", h: "Start performance-only", p: "Earn when your products sell across our channels. Pay on results.", d: "No CPC or CPM on performance-only. Channels include branded ScaleHealth.ca hubs, a private digital and brick-and-mortar retail network, and the Ontario Street Team. You approve every placement.", icon: "box" },
  { k: "02 · Co-branded hub", h: "Activate your audience", p: "Your own hub and dashboard. Add our targeted audiences on top.", d: "The dashboard shows your audience and campaigns. Tap network audiences with open inventory. Ads appear on your hub only if you approve them; the hub ad in the video is a labelled example placement.", icon: "home" },
  { k: "03 · Ads", h: "Go deep where you convert", p: "Pick the right audiences, check out, and watch your own cockpit.", d: "Ads run on ScaleHealth.ca and Birch Reserve pages. Upload your ad, check out, a person reviews it, then it runs. Views, clicks and claims update in your dashboard. No guaranteed reach or results.", icon: "target" },
  {
    k: "04 · Categories", h: "Recovery first, more next", icon: "grid", ds: "Which categories",
    p: <><span className="mr-1 inline-block rounded-full bg-[#BDEFD0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#173D2B]">Live · Recovery</span><span className="inline-block rounded-full bg-[#eef0ea] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#33445c]">Coming next · 7 more</span></>,
    d: "Queued: Longevity, Sleep, Fitness, Food & Nutrition, Medi-spa, Mental Health and Pets. No launch dates.",
  },
];

function Tile({ t }: { t: (typeof TILES)[number] }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-2xl border border-[#D3D7DE] bg-white p-4" data-testid="reel-tile">
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-[#071A39] text-[#C8F55A]">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{I[t.icon]}</svg>
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/60">{t.k}</span>
      <h3 className="font-display text-xl leading-tight">{t.h}</h3>
      <p className="text-sm text-foreground/75">{t.p}</p>
      <details className="mt-auto border-t border-foreground/10 pt-2 text-sm">
        <summary className="cursor-pointer font-semibold">{t.ds ?? "Details"}</summary>
        <p className="mt-1.5 text-foreground/75">{t.d}</p>
      </details>
    </article>
  );
}

export default function BrIntakeReel() {
  const scale = isScaleSkin();
  const F = REEL_FILES(scale);
  const transcript = scale ? TRANSCRIPT.replace("One distribution system. Birch Reserve, plus Scale Health.", SCALE_END) : TRANSCRIPT;
  const { currency } = useCurrency();
  const C = currency.toUpperCase();
  usePageMeta("Watch: how the Scale Health ad system works | Birch Reserve", `A ${scale ? "one-minute" : "50-second"} walkthrough: start performance-only as a supplier, activate your own audience with a co-branded hub, then run targeted ads. Recovery is live, more categories are next.`);
  // On the Scale skin every link stays under /intake, so the visit and any checkout stay on scalehealth.ca (Scale direct).
  const kit = `/intake?utm_source=reel&utm_medium=${scale ? "scale_reel" : "reel"}`;
  const exclusive = `${scale ? "/intake/_m" : ""}/exclusive?currency=${currency}&utm_source=reel&utm_medium=${scale ? "scale_reel" : "reel"}`;
  const talk = `${scale ? "/intake/_m" : ""}/buycalc?sku=reserve-490#reserve`;
  const v = useRef<HTMLVideoElement>(null);
  const h = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    for (const el of [v.current, h.current]) {
      if (!el) continue;
      const on = () => { for (const t of Array.from(el.textTracks)) t.mode = "showing"; };
      on();
      el.textTracks.addEventListener?.("addtrack", on);
    }
  }, []);
  const btn = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-center text-[15px] font-bold sm:w-auto";
  const Ctas = ({ dark = false, where }: { dark?: boolean; where: string }) => (
    <div className="flex flex-wrap items-center gap-2.5">
      <a href={kit} className={`${btn} bg-[#C8F55A] text-[#071A39]`} data-testid={`reel-${where}-kit`}>Get my free monetization kit →</a>
      <a href={exclusive} className={`${btn} ${dark ? "border border-white/40 text-white" : "bg-[#071A39] text-white"}`} data-testid={`reel-${where}-exclusive`}>Reserve ${"1,900"} {C} exclusive</a>
      <a href={talk} className={`${btn} border ${dark ? "border-white/40 text-white" : "border-[#c9cfc2] bg-white text-[#071A39]"}`} data-testid={`reel-${where}-talk`}>Buy ads now</a>
    </div>
  );
  return (
    <div className={`bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_55%)] ${scale ? "reel-s" : ""}`} data-testid="intake-reel">
      <style>{`.reel-pl{max-width:min(420px,calc((100vh - 300px) * 9 / 16 + 18px));max-width:min(420px,calc((100dvh - 300px) * 9 / 16 + 18px))}@media (min-width:768px){.reel-pl{max-width:calc((100vh - 250px) * 16 / 9 + 18px);max-width:calc((100dvh - 250px) * 16 / 9 + 18px)}}.reel-s .reel-pl{max-width:min(420px,calc((100dvh - 380px) * 9 / 16 + 18px))}@media (min-width:768px){.reel-s .reel-pl{max-width:calc((100dvh - 300px) * 16 / 9 + 18px)}}`}</style>
      <section className="container mx-auto max-w-5xl px-4 pt-5 md:pt-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/55">{F.len}<span className="hidden sm:inline"> · {scale ? "Scale Health + Birch Reserve" : "Birch Reserve + Scale Health"}</span></p>
        <h1 className="mt-1.5 font-display text-[2rem] leading-[1.05] md:text-5xl">One distribution system, for brands and hubs.</h1>
        {scale ? <ScaleAdUnitLockup className="mt-3" /> : null}
        <div className="reel-pl mx-auto mt-4 rounded-[18px] border border-[#D3D7DE] bg-white p-2 shadow-[0_14px_34px_-18px_rgba(7,26,57,.25)]" data-testid="reel-player">
          <video key={F.h} ref={h} className="hidden aspect-video w-full rounded-xl bg-[#0B1B38] md:block" controls playsInline preload="metadata" poster={`${R}/poster-16x9.jpg`} aria-label="How the Scale Health ad system works, 16:9">
            <source src={F.h} type="video/mp4" />
            <track kind="captions" src={F.vtt} srcLang="en" label="English" default />
          </video>
          <video key={F.v} ref={v} className="block aspect-[9/16] w-full rounded-xl bg-[#0B1B38] md:hidden" controls playsInline preload="metadata" poster={`${R}/poster.jpg`} aria-label="How the Scale Health ad system works, 9:16">
            <source src={F.v} type="video/mp4" />
            <track kind="captions" src={F.vtt} srcLang="en" label="English" default />
          </video>
        </div>
        <div className="mt-4"><Ctas where="hero" /></div>
        <p className="mt-2.5 text-[13px] text-foreground/60">Captions on. Example brand and figures in the video are labelled EXAMPLE, not results.</p>
      </section>
      <div className="container mx-auto max-w-5xl px-4 pt-9"><SurfaceTypes /></div>
      <div className="container mx-auto max-w-5xl px-4 pt-6"><HubAlerts compact where="reel" pagePath="/intake/reel" /></div>
      <section className="container mx-auto max-w-5xl px-4 pb-12 pt-9">
        <h2 className="font-display text-2xl md:text-3xl">How it works, in four steps.</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 min-[481px]:grid-cols-2 lg:grid-cols-4" data-testid="reel-tiles">{TILES.map((t) => <Tile key={t.k} t={t} />)}</div>
        <div className="mt-7 grid items-center gap-4 rounded-[20px] bg-[#071A39] p-5 text-white md:grid-cols-[1fr_auto] md:p-6" data-testid="reel-band">
          <div>
            <h2 className="font-display text-2xl leading-tight md:text-3xl">See what it means for your brand.</h2>
            <p className="mt-1.5 text-sm text-white/75">Free kit: your supplier exposure and hub earnings, estimated and reviewed by a person.</p>
          </div>
          <Ctas dark where="band" />
        </div>
        <div className="mt-6 divide-y divide-foreground/10 rounded-2xl border border-[#D3D7DE] bg-white px-5 py-2 text-sm">
          <details className="py-2.5"><summary className="cursor-pointer font-semibold">What the $1,900 exclusive reserve is</summary><p className="mt-1.5 text-foreground/75">An exclusive display reserve: one brand per category. It holds an exclusive package pending your insertion order, all of it counts toward that package, and it is refunded if another brand commits first. Nothing runs until the IO is signed. Shown in your currency.</p></details>
          <details className="py-2.5" data-testid="reel-transcript"><summary className="cursor-pointer font-semibold">Transcript</summary><p className="mt-1.5 text-foreground/75">{transcript}</p></details>
        </div>
        <p className="mt-5 max-w-3xl text-[13px] text-foreground/60">Northline Recovery, its hub and all dashboard figures in the video are examples, labelled EXAMPLE, not results. The hub placement shown is an example of how an ad could look, and runs only with the hub owner's approval. Upcoming categories are queued, with no launch dates. Channel figures are modelled estimates from listed partners, not a delivery promise. No guarantee of views, clicks, sales or results. Prices in the video are in USD.</p>
      </section>
    </div>
  );
}
