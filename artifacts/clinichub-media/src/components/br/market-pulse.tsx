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
      <div className="mt-3 grid gap-2 md:grid-cols-2">
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

type PulseEvent = { who: string; region: string | null; action: string; ago: string };
type Feed = { show: boolean; events: PulseEvent[] };
const DISMISS_KEY = "br_pulse_dismissed";
const SHOW_MS = 7000;
const gap = () => 20000 + Math.round(Math.random() * 20000); // every ~20–40s

/**
 * Uniform bottom toast (Randy t294u): "[blurred] · Physio clinic, Ontario · asked about hosting a hub · 2d ago".
 * The blurred "name" is a fixed placeholder shape, never a real name: the API carries no names (lib/activityPulse.ts),
 * so there is nothing in the HTML or JSON to un-blur. Real events only: show:false, an error or an empty list renders
 * nothing. Non-blocking (only the toast takes pointer events), dismissible for the session, slide + fade.
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
    let n = 0;
    const show = () => {
      setI(n % feed.events.length);
      n += 1;
      setVisible(true);
      t = window.setTimeout(() => {
        setVisible(false);
        t = window.setTimeout(show, gap());
      }, SHOW_MS);
    };
    t = window.setTimeout(show, 6000);
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
      className={`pointer-events-none fixed inset-x-3 bottom-4 z-40 flex justify-start transition-all duration-500 ease-out motion-reduce:transition-none md:inset-x-auto md:left-5 md:max-w-md ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
      data-testid="activity-pulse"
      data-visible={visible ? "1" : "0"}
      aria-hidden={visible ? undefined : true}
    >
      <div className={`flex max-w-[calc(100vw-6.5rem)] items-center gap-3 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur md:max-w-md ${visible ? "pointer-events-auto" : ""}`} role="status" aria-live="polite">
        <span className="relative flex size-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex size-full rounded-full bg-lime-400 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-lime-500" />
        </span>
        <span className="min-w-0 text-[13px] leading-snug" style={{ color: NAVY }}>
          <span className="mr-1 inline-block h-3 w-16 rounded-full bg-foreground/25 align-middle blur-[2px]" aria-hidden data-testid="activity-pulse-blur" />
          <span className="sr-only">Someone</span>
          <span className="font-semibold" data-testid="activity-pulse-who">· {e.who}{e.region ? `, ${e.region}` : ""}</span>
          <span data-testid="activity-pulse-line"> · {e.action}</span>
          <span className="text-foreground/50"> · {e.ago}</span>
        </span>
        <button type="button" onClick={close} tabIndex={visible ? 0 : -1} className="-mr-1 shrink-0 rounded-full p-1 text-foreground/40 hover:text-foreground/80" aria-label="Dismiss recent activity" data-testid="activity-pulse-close">
          <X className="size-3.5" />
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

