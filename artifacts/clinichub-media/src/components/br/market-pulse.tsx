/**
 * Marketplace signals (Randy t291u, Nov 20 2026): "Categories we serve", "Questions brands ask" and a quiet activity
 * pulse. Honesty rules (BR): the categories and questions are evergreen copy (no claim that a named or specific brand
 * asked or bought). The pulse shows ONLY real anonymized server events from /v1/activity-pulse (lib/activityPulse.ts)
 * and renders nothing when the server says show:false (fewer than 3 real events in the window). Never padded.
 * Shared by birchreserve.net and the Scale mirror (scalehealth.ca/intake): no site name in the copy.
 */
import { useEffect, useState } from "react";
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

type PulseEvent = { who: string; region: string | null; action: string; ago: string; age_h?: number };
type Feed = { show: boolean; events: PulseEvent[] };
const DISMISS_KEY = "br_pulse_dismissed";
const COUNT_KEY = "br_pulse_shown";
// Soft cadence (Randy t295u): first after ~15s, then every 45–90s, each visible ~5s, at most 6 per session.
const FIRST_MS = 15000;
const SHOW_MS = 5000;
const MAX_PER_SESSION = 6;
const gap = () => 45000 + Math.round(Math.random() * 45000);
const shownSoFar = () => {
  try {
    return Number(window.sessionStorage.getItem(COUNT_KEY) ?? "0") || 0;
  } catch {
    return 0;
  }
};
/** Weighted pick, newest favoured (half-weight every ~2 weeks), never the same event twice in a row or repeated in a session. */
function pickNext(events: PulseEvent[], used: Set<number>): number {
  const pool = events.map((e, i) => ({ i, w: Math.pow(0.5, (e.age_h ?? i * 24) / (24 * 14)) })).filter((x) => !used.has(x.i));
  const list = pool.length ? pool : events.map((_, i) => ({ i, w: 1 }));
  let r = Math.random() * list.reduce((a, x) => a + x.w, 0);
  for (const x of list) {
    r -= x.w;
    if (r <= 0) return x.i;
  }
  return list[list.length - 1]!.i;
}

/**
 * Uniform bottom toast (left, clear of the call button and the mobile sticky bar) (Randy t294u): "[blurred] · Physio clinic, Ontario · asked about hosting a hub · 2d ago".
 * The blurred "name" is a fixed placeholder shape, never a real name: the API carries no names (lib/activityPulse.ts),
 * so there is nothing in the HTML or JSON to un-blur. Real events only: show:false, an error or an empty list renders
 * nothing. Non-blocking (only the toast takes pointer events), dismissible for the session, soft fade (t295u cadence
 * above); prefers-reduced-motion drops the movement and keeps a short opacity fade.
 */
export function ActivityPulse() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const [off, setOff] = useState(() => {
    try {
      return typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (off) return;
    let live = true;
    fetch("/v1/activity-pulse", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Feed | null) => {
        if (live && d && d.show === true && Array.isArray(d.events) && d.events.length) setFeed(d);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [off]);
  useEffect(() => {
    if (!feed || off) return;
    let t: number;
    const used = new Set<number>();
    const show = () => {
      const n = shownSoFar();
      if (n >= MAX_PER_SESSION) return;
      const next = pickNext(feed.events, used);
      used.add(next);
      setI(next);
      setVisible(true);
      try {
        window.sessionStorage.setItem(COUNT_KEY, String(n + 1));
      } catch {
        /* private mode */
      }
      t = window.setTimeout(() => {
        setVisible(false);
        if (n + 1 < MAX_PER_SESSION) t = window.setTimeout(show, gap());
      }, SHOW_MS);
    };
    if (shownSoFar() < MAX_PER_SESSION) t = window.setTimeout(show, FIRST_MS);
    return () => window.clearTimeout(t);
  }, [feed, off]);
  if (off || !feed) return null;
  const e = feed.events[i % feed.events.length]!;
  const close = () => {
    setOff(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
  };
  return (
    <div
      className={`pointer-events-none fixed left-3 bottom-24 z-40 flex justify-start transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-opacity motion-reduce:duration-300 motion-reduce:transform-none md:bottom-5 md:left-24 md:max-w-sm ${visible ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"}`}
      data-testid="activity-pulse"
      data-visible={visible ? "1" : "0"}
      aria-hidden={visible ? undefined : true}
    >
      <div className={`flex max-w-[calc(100vw-8.5rem)] items-center gap-2.5 rounded-xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-foreground/5 backdrop-blur md:max-w-sm ${visible ? "pointer-events-auto" : ""}`} role="status" aria-live="polite">
        <span className="inline-flex size-1.5 shrink-0 rounded-full bg-lime-500/70" aria-hidden />
        <span className="min-w-0 text-[12px] leading-snug opacity-80" style={{ color: NAVY }}>
          <span className="mr-1 inline-block h-2.5 w-12 rounded-full bg-foreground/15 align-middle blur-[2px]" aria-hidden data-testid="activity-pulse-blur" />
          <span className="sr-only">Someone</span>
          <span className="font-medium" data-testid="activity-pulse-who">· {e.who}{e.region ? `, ${e.region}` : ""}</span>
          <span data-testid="activity-pulse-line"> · {e.action}</span>
          <span className="text-foreground/45"> · {e.ago}</span>
        </span>
        <button type="button" onClick={close} tabIndex={visible ? 0 : -1} className="-mr-1 shrink-0 rounded-full p-1 text-foreground/30 hover:text-foreground/70" aria-label="Dismiss recent activity" data-testid="activity-pulse-close">
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

