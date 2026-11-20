/**
 * Marketplace signals (Randy t291u, Nov 20 2026): "Categories we serve", "Questions brands ask" and a quiet activity
 * pulse. Honesty rules (BR): the categories and questions are evergreen copy (no claim that a named or specific brand
 * asked or bought). The pulse shows ONLY real anonymized server events from /v1/activity-pulse (lib/activityPulse.ts)
 * and renders nothing when the server says show:false (fewer than 3 real events in the window). Never padded.
 * Shared by birchreserve.net and the Scale mirror (scalehealth.ca/intake): no site name in the copy.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Apple, Bed, Brain, ChevronDown, Dumbbell, HeartPulse, Microscope, Soup, X } from "lucide-react";
import { STARTER_BLOCK } from "@/components/br/start-small";
import { AGENCY_TEST } from "../../../../api-server/src/lib/twoLane";
import { DEPOSIT_TIERS } from "../../../../api-server/src/lib/sponsorKit";
import { RATE_SURFACES, fmtUsd } from "../../../../api-server/src/lib/overhaul/pricing";

const NAVY = "#0b1f3a";

export const SERVED_CATEGORIES = [
  { name: "Pain relief / topicals", sub: "Creams, patches, cold and heat therapy", icon: HeartPulse },
  { name: "Recovery hardware", sub: "Massage guns, compression, rollers", icon: Dumbbell },
  { name: "Nutrition", sub: "Protein, supplements, hydration", icon: Apple },
  { name: "Sleep", sub: "Sleep aids, mattresses, trackers", icon: Bed },
  { name: "Meal prep", sub: "Prepared meals, meal kits", icon: Soup },
  { name: "Women’s health", sub: "Hormone, pelvic, prenatal, menopause", icon: Activity },
  { name: "Men’s health", sub: "Performance, hormone, longevity", icon: Brain },
  { name: "Diagnostics / services", sub: "Testing, clinics, programs", icon: Microscope },
] as const;

/** 8 seat categories as a light, horizontally scrollable strip on mobile, a grid on desktop. */
export function CategoriesWeServe({ dark = false }: { dark?: boolean }) {
  return (
    <section data-testid="categories-we-serve" aria-labelledby="cats-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="cats-h" className={`font-display text-2xl leading-tight md:text-3xl ${dark ? "text-white" : "text-[#0b1f3a]"}`}>Categories we serve</h2>
        <p className={`text-[12px] ${dark ? "text-white/60" : "text-foreground/55"}`}>Shared seats. A premium slot locks one brand per category.</p>
      </div>
      <ul className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {SERVED_CATEGORIES.map((c) => (
          <li key={c.name} className="flex min-w-[200px] snap-start items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-foreground/10 md:min-w-0" data-testid="served-category">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[#0b1f3a]"><c.icon className="size-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold leading-tight text-[#0b1f3a]">{c.name}</span>
              <span className="block truncate text-[12px] text-foreground/60">{c.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const landing = RATE_SURFACES.find((s) => s.key === "landing")!;
const packs = DEPOSIT_TIERS.map((t) => `${fmtUsd(t.usd)} (${fmtUsd(Math.round(t.usd * (1 + t.bonusPct / 100)))} credit)`).join(", ");

/** Evergreen FAQ, answered against the live terms. Not presented as recent or specific brands' questions. */
export const BRAND_QUESTIONS = [
  { q: "Can we see our card on a live hub before paying?", a: "Yes. The illustrative mock on this page shows the card format on the live DR-HO’S physio and SOLE hubs. The free Monetization Kit and the $190 USD 7-day look show your own card before you commit to a reserve or pack." },
  { q: "Does the $190 look or $490 reserve count toward a bigger pack?", a: "Yes. A paid $190 look or $490 reserve counts in full toward any sponsorship pack bought within 30 days of that payment. The $190 look also converts in full to the $490 reserve within 7 days; otherwise it is refunded." },
  { q: "What are the sponsorship packs?", a: `${packs} USD. Bonus is media credit only, no cash value. Packs are refundable until 14 days before the IO launch date.` },
  { q: "How does reporting work with our UTM links?", a: "You send UTM-tagged links and an optional promo code. Reports show views, clicks, UTM-tagged visits and promo-code redemptions, per hub and surface. Aggregate only: never who saw your card. Reports go out on the schedule your IO sets." },
  { q: "Shared category seat or premium lock?", a: "The $490 reserve is a shared category seat: more than one brand can sit in a category. Only a premium slot ($25K–$50K USD, inquire only) locks one brand per category." },
  { q: "Can an agency prepay a client test?", a: `Yes. ${fmtUsd(AGENCY_TEST.lowUsd)}–${fmtUsd(AGENCY_TEST.highUsd)} USD per client on a pre-filled IO request, no card. ${AGENCY_TEST.cashPct}% cash to the agency of record. One IO per client.` },
  { q: "How is a view block priced?", a: `At each surface’s starter CPM (hub landing page from $${landing.cpmStarter[0]}), less a bundle discount when you add surfaces. 100K modelled views on the landing page start at ${fmtUsd(STARTER_BLOCK.startingUsd)} USD. Your IO sets the final rate.` },
  { q: "Do you guarantee impressions or results?", a: "No. Reach and view figures are modelled planning estimates, not delivery promises. Nothing runs until you sign the insertion order, which names the hub, surface and dates." },
] as const;

export function QuestionsBrandsAsk() {
  return (
    <section data-testid="questions-brands-ask" aria-labelledby="qba-h">
      <h2 id="qba-h" className="font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">Questions brands ask</h2>
      <div className="mt-3 grid items-start gap-2 md:grid-cols-2">
        {BRAND_QUESTIONS.map((x) => (
          <details key={x.q} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-foreground/10" data-testid="brand-question">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-bold leading-snug text-[#0b1f3a] [&::-webkit-details-marker]:hidden">
              {x.q}
              <ChevronDown className="mt-0.5 size-4 shrink-0 text-[#0b1f3a]/60 transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/75">{x.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

const FEED_URL = "/v1/activity-pulse";
type PulseEvent = { who: string; region: string | null; action: string; ago: string; age_h?: number };
type Feed = { show: boolean; events: PulseEvent[] };
const OFF_KEY = "br_pulse_off"; // localStorage: "1" = visitor turned the feed off (persists across visits)
// Fast feed (Randy, Nov 20 4:52 PM): one toast, content swaps every 1–1.5s with a quick crossfade; first after ~2s.
// prefers-reduced-motion: slower (every 4s) and no fade or movement.
const FIRST_MS = 2000;
const swapMs = (reduced: boolean) => (reduced ? 4000 : 1000 + Math.round(Math.random() * 500));
const FADE_MS = 160;
const INTERACTIVE = "a,button,input,select,textarea,label,form,[role=button],[role=link],[role=dialog],iframe";

/** Weighted pick, newest favoured (half-weight every ~2 weeks). Cycles the whole pool before repeating, never the same event twice in a row. */
function pickNext(events: PulseEvent[], used: Set<number>, last: number): number {
  if (used.size >= events.length) used.clear();
  const all = events.map((e, i) => ({ i, w: Math.pow(0.5, (e.age_h ?? i * 24) / (24 * 14)) }));
  let list = all.filter((x) => !used.has(x.i) && x.i !== last);
  if (!list.length) list = all.filter((x) => x.i !== last);
  if (!list.length) list = all;
  let r = Math.random() * list.reduce((a, x) => a + x.w, 0);
  for (const x of list) {
    r -= x.w;
    if (r <= 0) return x.i;
  }
  return list[list.length - 1]!.i;
}

/** True when the box sits over any visible control (CTA, form field, chat squirrel, call button, sticky bar). */
function overlapsControl(box: HTMLElement | null): boolean {
  if (!box) return false;
  const r = box.getBoundingClientRect();
  if (!r.width) return false;
  const pad = 6;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(INTERACTIVE))) {
    if (box.contains(el) || el.closest("[data-testid^=activity-pulse]")) continue;
    const o = el.getBoundingClientRect();
    if (!o.width || !o.height || o.bottom < 0 || o.top > window.innerHeight) continue;
    if (o.left < r.right + pad && o.right > r.left - pad && o.top < r.bottom + pad && o.bottom > r.top - pad) {
      const cs = window.getComputedStyle(el);
      if (cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05) return true;
    }
  }
  return false;
}

const readOff = () => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Live activity feed (Randy t294u–t295u, Nov 20 4:52 PM): ONE small toast at the left edge (mid-height on desktop,
 * upper-middle on mobile) whose line swaps every 1–1.5s with a quick crossfade: "[blurred] · Physio clinic, Ontario ·
 * is exploring hosting a hub · 2d ago". The blurred "name" is a fixed placeholder shape, never a real name: the API
 * carries no names (lib/activityPulse.ts). Real events only: show:false, an error or an empty list renders nothing.
 * The toast steps aside (fades out, no clicks) whenever it would sit over a CTA, form field, the squirrel, the call
 * button or a sticky bar, and comes back once the page scrolls clear. "Hide activity" or the X turns it off for good
 * (localStorage); a tiny "Activity" pill turns it back on.
 */
/**
 * mode "fixed" (default): side toast. desktopOnly hides it below md, for pages that also place an inline instance.
 * mode "inline" (mobile, Randy Nov 20 4:54 PM): sits in a divider gap between sections, in the page flow, so it never
 * covers a card, CTA, form, squirrel or call button. Shown below md only.
 */
export function ActivityPulse({ mode = "fixed", desktopOnly = false, className = "" }: { mode?: "fixed" | "inline"; desktopOnly?: boolean; className?: string } = {}) {
  const inline = mode === "inline";
  const [feed, setFeed] = useState<Feed | null>(null);
  const [i, setI] = useState(-1);
  const [fading, setFading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [off, setOff] = useState(readOff);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  useEffect(() => {
    let live = true;
    fetch(FEED_URL, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Feed | null) => {
        if (live && d && d.show === true && Array.isArray(d.events) && d.events.length) setFeed(d);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!feed || off) return;
    let t: number;
    let f: number;
    const used = new Set<number>();
    let last = -1;
    const next = () => {
      const n = pickNext(feed.events, used, last);
      used.add(n);
      last = n;
      return n;
    };
    const tick = () => {
      if (reduced) setI(next());
      else {
        setFading(true);
        f = window.setTimeout(() => {
          setI(next());
          setFading(false);
        }, FADE_MS);
      }
      t = window.setTimeout(tick, swapMs(reduced));
    };
    t = window.setTimeout(() => {
      setI(next());
      t = window.setTimeout(tick, swapMs(reduced));
    }, FIRST_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(f);
    };
  }, [feed, off, reduced]);
  useEffect(() => {
    if (!feed || inline) return;
    let raf = 0;
    // Try a few left-edge heights (mid, lower, upper) and use the first one clear of every control.
    const check = () => {
      raf = 0;
      const el = boxRef.current;
      if (!el) return;
      const slots = window.innerWidth >= 768 ? ["50%", "72%", "30%", "84%"] : ["38%", "62%", "24%"];
      for (const top of slots) {
        el.style.top = top;
        if (!overlapsControl(el)) {
          setBlocked(false);
          return;
        }
      }
      el.style.top = slots[0]!;
      setBlocked(true);
    };
    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(check);
    };
    schedule();
    const iv = window.setInterval(schedule, 700);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [feed, off, i, inline]);
  if (!feed) return null;
  const setOffPersist = (v: boolean) => {
    setOff(v);
    try {
      if (v) window.localStorage.setItem(OFF_KEY, "1");
      else window.localStorage.removeItem(OFF_KEY);
    } catch {
      /* private mode */
    }
  };
  const pos = inline
    ? `flex justify-center md:hidden ${className}`
    : `fixed left-2 top-[38%] z-40 md:left-4 md:top-1/2 ${desktopOnly ? "max-md:hidden" : ""} ${className}`;
  if (off) {
    return (
      <div ref={boxRef} className={`${pos} transition-opacity duration-300 ${blocked ? "pointer-events-none opacity-0" : "opacity-70 hover:opacity-100"}`} data-testid={inline ? "activity-pulse-on-inline" : "activity-pulse-on"}>
        <button type="button" onClick={() => setOffPersist(false)} tabIndex={blocked ? -1 : 0} className="flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium shadow-sm ring-1 ring-foreground/5 backdrop-blur" style={{ color: NAVY }} aria-label="Turn recent activity back on" data-testid="activity-pulse-turn-on">
          <span className="inline-flex size-1.5 rounded-full bg-lime-500/70" aria-hidden />
          Activity
        </button>
      </div>
    );
  }
  const visible = i >= 0 && !blocked;
  const e = feed.events[Math.max(0, i) % feed.events.length]!;
  return (
    <div
      ref={boxRef}
      className={`${pos} ${inline ? "" : "flex justify-start"} transition-opacity duration-300 motion-reduce:transition-none md:max-w-sm ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
      data-testid={inline ? "activity-pulse-inline" : "activity-pulse"}
      data-mode={mode}
      data-visible={visible ? "1" : "0"}
      data-blocked={blocked ? "1" : "0"}
      aria-hidden={visible ? undefined : true}
    >
      <div className={`flex ${inline ? "w-full max-w-md" : "w-[15.5rem] max-w-[calc(100vw-1rem)]"} items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 shadow-sm ring-1 ring-foreground/5 backdrop-blur md:w-[22rem]`} role="status" aria-live="off">
        <span className="inline-flex size-1.5 shrink-0 rounded-full bg-lime-500/70" aria-hidden />
        <span className={`min-w-0 flex-1 text-[11px] leading-snug opacity-80 transition-opacity ease-out motion-reduce:transition-none md:text-[12px] ${fading ? "opacity-0" : ""}`} style={{ color: NAVY, transitionDuration: `${FADE_MS}ms` }} data-testid="activity-pulse-text">
          <span className="mr-1 inline-block h-2.5 w-10 rounded-full bg-foreground/15 align-middle blur-[2px]" aria-hidden data-testid="activity-pulse-blur" />
          <span className="sr-only">Someone</span>
          <span className="font-medium" data-testid="activity-pulse-who">· {e.who}{e.region ? `, ${e.region}` : ""}</span>
          <span data-testid="activity-pulse-line"> · {e.action}</span>
          <span className="text-foreground/45"> · {e.ago}</span>
          <button type="button" onClick={() => setOffPersist(true)} tabIndex={visible ? 0 : -1} className="ml-1.5 whitespace-nowrap text-[10px] text-foreground/40 underline underline-offset-2 hover:text-foreground/70" data-testid="activity-pulse-hide">
            Hide activity
          </button>
        </span>
        <button type="button" onClick={() => setOffPersist(true)} tabIndex={visible ? 0 : -1} className="-mr-1 shrink-0 self-start rounded-full p-1 text-foreground/30 hover:text-foreground/70" aria-label="Turn off recent activity" data-testid="activity-pulse-close">
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}

/** Questions + categories block, used on home, media kit and intake. */
export function MarketSignals() {
  return (
    <div className="space-y-8" data-testid="market-signals">
      <CategoriesWeServe />
      <QuestionsBrandsAsk />
    </div>
  );
}

