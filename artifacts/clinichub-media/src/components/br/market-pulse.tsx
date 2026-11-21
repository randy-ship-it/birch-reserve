/**
 * Marketplace signals (Randy t291u, Nov 20 2026): "Categories we serve", "Questions brands ask" and a quiet activity
 * pulse. Honesty rules (BR): the categories and questions are evergreen copy (no claim that a named or specific brand
 * asked or bought). The pulse shows ONLY real anonymized server events from /v1/activity-pulse (lib/activityPulse.ts)
 * and renders nothing when the server says show:false (fewer than 3 real events in the window). Never padded.
 * Shared by birchreserve.net and the Scale mirror (scalehealth.ca/intake): no site name in the copy.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LINGER_STATE_EVENT, isLingerOpen } from "@/lib/overlay-bus";
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
          <li key={c.name} className="flex min-w-[240px] snap-start items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-foreground/10 md:min-w-0" data-testid="served-category">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lime-300 text-[#0b1f3a]"><c.icon className="size-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-[14px] font-bold leading-tight text-[#0b1f3a]">{c.name}</span>
              <span className="line-clamp-2 block text-[12px] leading-snug text-foreground/60">{c.sub}</span>
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

/**
 * Light continuous category strip (Randy Nov 21 10:20 AM). Titled "Categories we place for": real inquiries do not back
 * every one of the 8 categories, so it never says companies in them are "currently reviewing". Motion stops under
 * prefers-reduced-motion (index.css), where it simply wraps.
 */
export function CategoryStrip({ className = "", testId = "category-strip" }: { className?: string; testId?: string }) {
  const items = SERVED_CATEGORIES.map((c) => c.name);
  return (
    <section className={`overflow-hidden ${className}`} aria-label="Categories we place for" data-testid={testId}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Categories we place for</p>
      <div className="relative mt-2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)] motion-reduce:[mask-image:none]">
        <ul className="flex w-max animate-marquee gap-2 [animation-duration:45s] hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap" aria-hidden={false}>
          {[...items, ...items].map((n, i) => (
            <li key={`${n}-${i}`} className={`whitespace-nowrap rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-[#0b1f3a] ring-1 ring-foreground/10 ${i >= items.length ? "motion-reduce:hidden" : ""}`} aria-hidden={i >= items.length ? true : undefined} data-testid={i < items.length ? "category-strip-item" : undefined}>
              {n}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const packRange = `${fmtUsd(DEPOSIT_TIERS[0]!.usd).replace(",500", ".5K").replace(/,000$/, "K")}–${fmtUsd(DEPOSIT_TIERS[DEPOSIT_TIERS.length - 1]!.usd).replace(/,000$/, "K")}`;

/**
 * Compact 6-question version (Randy Nov 21 10:20 AM): one-line answers, checked against /terms and the live offer.
 * Common questions, not dated or attributed inquiries.
 */
export const BRAND_QUESTIONS_COMPACT = [
  { q: "Can we get a mock on the live DR-HO’S hub before paying the $190?", a: "Yes. The illustrative mock is free, and after your free kit it shows your own card on the hub before you pay anything." },
  { q: `Does the $490 credit carry into a ${packRange} pack?`, a: "Yes. A paid $190 look or $490 reserve counts in full toward any sponsorship pack bought within 30 days." },
  { q: "How does UTM reporting work if it’s aggregate only?", a: "Views, clicks, UTM visits and promo-code redemptions are counted per hub and surface, never who saw your card." },
  { q: "Shared seat or premium lock?", a: "The $490 reserve is a shared category seat. Only exclusive display (a $25K–$50K USD premium slot or the $1,900 CAD exclusive reserve) locks one brand per category." },
  { q: `Can an agency prepay a client test and get the ${AGENCY_TEST.cashPct}% cash?`, a: `Yes. ${fmtUsd(AGENCY_TEST.lowUsd).replace(/,000$/, "K")}–${fmtUsd(AGENCY_TEST.highUsd).replace(/,000$/, "K")} USD per client on a pre-filled IO, no card; ${AGENCY_TEST.cashPct}% of media spend is paid in cash to the agency of record.` },
  { q: "What if we change our mind?", a: "The $490 reserve and packs are fully refundable until 14 days before the IO launch date; an unconverted $190 look is refunded." },
] as const;

export function QuestionsBrandsAskCompact({ className = "", testId = "questions-brands-ask-compact" }: { className?: string; testId?: string }) {
  return (
    <section className={className} data-testid={testId} aria-labelledby={`${testId}-h`}>
      <h2 id={`${testId}-h`} className="font-display text-2xl leading-tight text-[#0b1f3a] md:text-3xl">Questions brands ask</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
        {BRAND_QUESTIONS_COMPACT.map((x) => (
          <div key={x.q} className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-foreground/10" data-testid="brand-question-compact">
            <dt className="text-[14px] font-bold leading-snug text-[#0b1f3a]">{x.q}</dt>
            <dd className="mt-1 text-[13px] leading-snug text-foreground/75">{x.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12px] text-foreground/60">Figures are modelled estimates. Nothing runs until you sign an insertion order. Reporting is aggregate only. <a href="/terms" className="underline underline-offset-2">Terms</a></p>
    </section>
  );
}

const FEED_URL = "/v1/activity-pulse";
type PulseEvent = { who: string; region: string | null; action: string; ago: string; age_h?: number; kind?: "launch" };
type Feed = { show: boolean; events: PulseEvent[] };
const OFF_KEY = "br_pulse_off"; // localStorage: "1" = visitor turned the feed off (persists across visits)
// Fast feed (Randy, Nov 20 4:52 PM): one toast, content swaps every 1–1.5s with a quick crossfade; first after ~2s.
// Randy (voice 5:16 PM): ~3-4s per item with a gentle ~500ms fade, first item ~2s after load.
// prefers-reduced-motion: slower (every 6s) and no fade or movement.
const FIRST_MS = 2000;
const swapMs = (reduced: boolean) => (reduced ? 6000 : 3000 + Math.round(Math.random() * 1000));
const FADE_MS = 500;
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
function overlapsText(box: HTMLElement | null): boolean {
  if (!box) return false;
  const b = box.getBoundingClientRect();
  for (const n of Array.from(document.querySelectorAll("h1, h2, h3, p, img, svg, [data-testid=kit-divider]"))) {
    if (box.contains(n)) continue;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // Use the text's real extent, not the full-width block box.
    const rr = n instanceof HTMLElement && /^(H1|H2|H3|P)$/.test(n.tagName) ? textRect(n) ?? r : r;
    if (rr.left < b.right && rr.right > b.left && rr.top < b.bottom && rr.bottom > b.top) return true;
  }
  return false;
}
function textRect(n: HTMLElement): DOMRect | null {
  const range = document.createRange();
  range.selectNodeContents(n);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width && r.height);
  if (!rects.length) return null;
  const l = Math.min(...rects.map((r) => r.left)), t = Math.min(...rects.map((r) => r.top));
  const rgt = Math.max(...rects.map((r) => r.right)), btm = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(l, t, rgt - l, btm - t);
}
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
export function ActivityPulse({ mode = "fixed", desktopOnly = false, desktopInline = false, className = "", slim = false }: { mode?: "fixed" | "inline"; desktopOnly?: boolean; desktopInline?: boolean; className?: string; slim?: boolean } = {}) {
  // desktopInline (Randy Nov 21 4:03 PM): in-flow in the open space above "Categories we serve", never a floating overlay.
  const inline = mode === "inline" || desktopInline;
  const [feed, setFeed] = useState<Feed | null>(null);
  const [i, setI] = useState(-1);
  const [fading, setFading] = useState(false);
  const [blockedBase, setBlocked] = useState(false);
  const [capOpen, setCapOpen] = useState(() => isLingerOpen());
  useEffect(() => {
    const on = (e: Event) => setCapOpen(Boolean((e as CustomEvent<{ open: boolean }>).detail?.open));
    window.addEventListener(LINGER_STATE_EVENT, on);
    return () => window.removeEventListener(LINGER_STATE_EVENT, on);
  }, []);
  const blocked = blockedBase || capOpen; // hide while an email-capture card is up
  const [off, setOff] = useState(readOff);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef(-1); // chosen desktop spot, kept across item swaps
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
    }, slim ? 0 : FIRST_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(f);
    };
  }, [feed, off, reduced, slim]);
  useEffect(() => {
    if (!feed || inline) return;
    let raf = 0;
    // Desktop (Randy Nov 21 11:03 AM): anchored, not floating mid-edge. First choice is bottom-left, aligned with the
    // hero text's left edge (inside the content container), then bottom-right mirrored on the container's right edge,
    // then both lifted above the call button / chat squirrel, then the empty top-right corner under the nav (intake form view).
    // The chosen spot is sticky: it only moves when something interactive scrolls under it. Mobile keeps its slots.
    type Slot = { top?: string; bottom?: string; left?: string; right?: string; text?: boolean };
    const apply = (el: HTMLElement, x: Slot) => {
      el.style.top = x.top ?? "auto";
      el.style.bottom = x.bottom ?? "auto";
      el.style.left = x.left ?? "auto";
      el.style.right = x.right ?? "auto";
    };
    const slotsFor = (desktop: boolean): Slot[] => {
      if (!desktop) return [{ top: "38%", left: "0.5rem" }, { top: "62%", left: "0.5rem" }, { top: "24%", left: "0.5rem" }];
      const h1 = document.querySelector("main h1, h1");
      const edge = Math.max(16, Math.round(h1?.getBoundingClientRect().left ?? 16));
      const e = `${edge}px`;
      return [
        { bottom: "24px", left: e },
        { bottom: "24px", right: e },
        { bottom: "96px", left: e },
        { bottom: "96px", right: e },
        { top: "96px", right: e, text: true },
        { top: "96px", right: "16px", text: true },
      ];
    };
    const clear = (el: HTMLElement, x: Slot) => !overlapsControl(el) && !(x.text && overlapsText(el));
    const check = () => {
      raf = 0;
      const el = boxRef.current;
      if (!el) return;
      const slots = slotsFor(window.innerWidth >= 768);
      const cur = slotRef.current;
      if (cur >= 0 && cur < slots.length) {
        apply(el, slots[cur]!);
        if (clear(el, slots[cur]!)) {
          setBlocked(false);
          return;
        }
      }
      for (let k = 0; k < slots.length; k++) {
        apply(el, slots[k]!);
        if (clear(el, slots[k]!)) {
          slotRef.current = k;
          setBlocked(false);
          return;
        }
      }
      slotRef.current = -1;
      apply(el, slots[0]!);
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
  const pos = desktopInline
    ? `hidden justify-start md:flex ${className}`
    : inline
    ? `flex justify-center md:hidden ${className}`
    : `fixed bottom-6 left-4 z-40 max-md:bottom-auto max-md:left-2 max-md:top-[38%] ${desktopOnly ? "max-md:hidden" : ""} ${className}`;
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
      <div className={`flex ${inline ? "w-full max-w-md" : "w-[15.5rem] max-w-[calc(100vw-1rem)]"} ${slim ? "min-h-[3rem]" : ""} items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 shadow-sm ring-1 ring-foreground/5 backdrop-blur md:w-[22rem]`} role="status" aria-live="off">
        <span className="inline-flex size-1.5 shrink-0 rounded-full bg-lime-500/70" aria-hidden />
        {/* One text flow (no flex gaps between fragments), left-aligned, normal spacing, so it wraps naturally on phones. */}
        <span className={`block min-w-0 flex-1 ${slim ? "line-clamp-2" : "whitespace-normal"} text-left text-[13px] font-normal normal-case tracking-normal opacity-90 transition-opacity ease-out [hyphens:none] [text-align-last:auto] [word-spacing:normal] motion-reduce:transition-none md:text-[13px] ${fading ? "opacity-0" : ""}`} style={{ color: NAVY, lineHeight: 1.35, transitionDuration: `${FADE_MS}ms` }} data-testid="activity-pulse-text">
          {e.kind === "launch" ? (
            <>
              {/* Launch highlight (Randy Nov 20 5:24 PM): small accent badge, place type only, never a business name. */}
              <span className="mr-1 inline-block rounded-full bg-lime-400/80 px-1.5 align-[1px] text-[9px] font-semibold uppercase leading-[1.5] tracking-normal text-[#0b1f3a]" data-testid="activity-pulse-badge">New hub</span>
              <span className="font-medium" data-testid="activity-pulse-who">{e.who}{e.region ? `, ${e.region}` : ""}</span>
              {" "}
              <span data-testid="activity-pulse-line">{e.action}</span>
            </>
          ) : (
            <>
              <span className="mr-1 inline-block h-2.5 w-10 rounded-full bg-foreground/15 align-[-1px] blur-[2px]" aria-hidden data-testid="activity-pulse-blur" />
              <span className="sr-only">Someone </span>
              <span className="font-medium" data-testid="activity-pulse-who">{e.who}{e.region ? `, ${e.region}` : ""}</span>
              {" · "}
              <span data-testid="activity-pulse-line">{e.action}</span>
            </>
          )}
          {" · "}
          <span className="text-foreground/60">{e.ago}</span>
          <button type="button" onClick={() => setOffPersist(true)} tabIndex={visible ? 0 : -1} className={`ml-2 mt-0.5 ${slim ? "hidden" : "inline-flex"} min-h-8 items-center text-left text-[12px] leading-tight text-foreground/55 underline underline-offset-2 hover:text-foreground/70`} data-testid="activity-pulse-hide">
            Hide activity
          </button>
        </span>
        <button type="button" onClick={() => setOffPersist(true)} tabIndex={visible ? 0 : -1} className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center self-start rounded-full text-foreground/40 hover:text-foreground/70" aria-label="Turn off recent activity" data-testid="activity-pulse-close">
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

