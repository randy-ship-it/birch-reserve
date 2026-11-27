/**
 * "What you're buying" (Randy, voice, Nov 23 2026 2:37 PM ET): a cold advertiser who never heard of Scale Health must
 * see, near the top of the home page, what the ad inventory is. The main buy is display inside a private network of
 * hubs that live inside brands. Separate and incremental: private clinic network display, retail micro hubs (hubs
 * inside retail businesses) and the Street Team. Visual first, detail in expanders.
 *
 * Figures come only from the shared sources (AUDIENCE_CHANNELS, STREET_REACH_FIG, the hub ladder); nothing new is
 * invented. Reach figures are modelled estimates from listed partners, the 2027 figure is an estimate, and every ad
 * shown on the site stays a labelled example mockup.
 */
import type { ReactNode } from "react";
import { ArrowRight, ChevronDown, Footprints, LayoutGrid, Stethoscope, Store } from "lucide-react";
import { isScaleSkin } from "@/lib/siteSkin";
import { AUDIENCE_CHANNELS, AUDIENCE_FINE, STREET_REACH_FIG } from "../../../../api-server/src/lib/overhaul/brandIntake";
import { activatingLine, liveLine, RETAIL_MICRO_HUBS } from "../../../../api-server/src/lib/hubLadder";

const NAVY = "#0b1f3a";
const HUB_FIG = AUDIENCE_CHANNELS.find((c) => c.key === "scale-hubs")!;
const RETAIL_FIG = AUDIENCE_CHANNELS.find((c) => c.key === "retail-network")!;

/** Hub categories, in launch order (Randy, Nov 23 2026): recovery first, then the rest roll out. */
export const HUB_CATEGORIES: readonly { name: string; live: boolean }[] = [
  { name: "Recovery", live: true },
  { name: "Longevity", live: false },
  { name: "Sleep", live: false },
  { name: "Nutrition", live: false },
  { name: "More categories", live: false },
];

/** The four placements inside every hub (same list as the home FAQ). */
const PLACEMENTS = ["After purchase", "Clinic layer home", "Products & services", "Member dashboard"];

/** One plain definition of a hub, per skin. Used by the hero subhead and the explainer. */
export const hubDefinition = (): string =>
  isScaleSkin()
    ? "Scale Health clinic layers are pages inside a brand, clinic or retailer, where its own customers land right after they buy or book. Your ad shows in those post-purchase moments and inside the member clinic layer."
    : "A clinic layer is a page inside a brand, clinic or retailer, where its own customers land right after they buy or book. Your ad shows in those post-purchase moments and inside the member clinic layer.";

/** Where the hubs live, said once in plain words (an outsider has never heard of ScaleHealth.ca). */
export const hubHostLine = (): string =>
  isScaleSkin()
    ? "These are Scale Health's clinic layers, hosted on ScaleHealth.ca. DR-HO'S, SOLE and the rest are real brand and clinic layers."
    : "The clinic layers are hosted on ScaleHealth.ca, the clinic layer platform Birch Reserve sells display for. DR-HO'S, SOLE and the rest are real brand and clinic layers.";

function More({ children, dark = false, testId }: { children: ReactNode; dark?: boolean; testId?: string }) {
  return (
    <details className={`group mt-3 text-[13px] ${dark ? "text-white/75" : "text-foreground/70"}`} data-testid={testId}>
      <summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1 font-semibold [&::-webkit-details-marker]:hidden ${dark ? "text-lime-200" : "text-[#0b1f3a]"}`}>
        What it is <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-1 space-y-1.5 leading-snug">{children}</div>
    </details>
  );
}

function AddOn({ icon: Icon, title, line, fig, figLabel, chip, href, testId, figTestId, children }: {
  icon: typeof Store; title: string; line: string; fig?: string; figLabel?: string; chip: string; href: string; testId: string; figTestId?: string; children: ReactNode;
}) {
  return (
    <div className="flex flex-col border-t border-[#0b1f3a] pt-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <Icon className="size-5 shrink-0 text-[#0b1f3a]/70" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/55">{chip}</span>
      </div>
      <p className="mt-3 font-display text-xl leading-tight text-[#0b1f3a]">{title}</p>
      <p className="mt-1 text-[13px] leading-snug text-foreground/70">{line}</p>
      {fig ? (
        <p className="mt-3 font-display text-3xl leading-none tabular-nums text-[#0b1f3a]" data-testid={figTestId}>
          {fig} <span className="block pt-1 font-sans text-[12px] font-semibold text-foreground/60">{figLabel}</span>
        </p>
      ) : null}
      <More testId={`${testId}-more`}>{children}</More>
      <a href={href} className="mt-auto inline-flex min-h-10 items-center gap-1 pt-1 text-[13px] font-bold text-[#0b1f3a] underline underline-offset-4">
        Learn more <ArrowRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}

export function WhatYoureBuying({ testId = "what-youre-buying" }: { testId?: string }) {
  const scale = isScaleSkin();
  return (
    <div data-testid={testId}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">What you&apos;re buying</h2>
        <p className="text-[13px] text-foreground/60">One main buy. Three add-ons, sold separately.</p>
      </div>

      {/* The main door: display inside the private hub network. */}
      <div className="mt-4 grid gap-6 rounded-xl p-6 text-white md:grid-cols-[1.2fr_1fr] md:p-9" style={{ background: NAVY }} data-testid="stat-hub-views">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">The main buy · Private display network</p>
          <p className="mt-2 font-display text-2xl leading-tight md:text-3xl">Your ad inside brand clinic layers</p>
          <p className="mt-1.5 text-sm leading-snug text-white/75">Post-purchase pages and member clinic layers that brands, clinics and retailers give their own customers. Your card shows on four spots in each clinic layer.</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 border-t border-white/15 text-[13px] text-white/85" aria-label="Placements in each clinic layer">
            {PLACEMENTS.map((p) => (
              <li key={p} className="border-b border-white/10 py-2">{p}</li>
            ))}
            <li className="col-span-2 py-2 text-white/60">Clinic layer screens · rolling out, by inquiry</li>
          </ul>
        </div>
        <div className="min-w-0 md:border-l md:border-white/10 md:pl-6">
          <p className="font-display text-[2.6rem] leading-none tabular-nums md:text-5xl">{HUB_FIG.v}</p>
          <p className="mt-1 text-sm text-white/75">{HUB_FIG.l}</p>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Clinic layer categories</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Clinic layer categories" data-testid="hub-categories">
            {HUB_CATEGORIES.map((c) => (
              <li key={c.name} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.live ? "bg-lime-300 text-[#0b1f3a]" : "text-white/80 ring-1 ring-white/20"}`}>
                {c.name}
                <span className={`text-[9px] uppercase tracking-wider ${c.live ? "text-[#0b1f3a]/70" : "text-white/45"}`}>{c.live ? "Live now" : "Rolling out"}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <More dark testId="hub-explainer">
            <p>{hubDefinition()} {scale ? "Scale Health sells the display directly." : "Birch Reserve sells the display."}</p>
            <p>{hubHostLine()}</p>
            <p>{liveLine()} {activatingLine()}</p>
            <p>Ads shown on this site are labelled example mockups, not live placements.</p>
          </More>
        </div>
      </div>

      {/* Separate and incremental reach. */}
      <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/55">Also available · add-on reach, sold separately</p>
      <div className="mt-3 grid gap-8 md:grid-cols-3" data-testid="home-retail-tile">
        <AddOn icon={Stethoscope} title="Private clinic network" line="Display inside private digital and longevity clinics, where patients book and check in." chip="Onboarding" href="/hubs" testId="addon-clinic-network">
          <p>A separate network from the brand clinic layers, bought on its own. Clinics are onboarding now.</p>
        </AddOn>
        <AddOn icon={Store} title="Retail micro clinic layers" line="Clinic layers inside retail stores and clinics: shelf, counter and wall cards." fig={RETAIL_FIG.v} figLabel="locations · 500+ soon" chip="Activating" href="/hubs" testId="stat-retail-locations">
          <p>A private network of digital and brick-and-mortar fitness and recovery retailers in Canada and the USA, with 1MM+ captive recovery consumers.</p>
          <p>{RETAIL_MICRO_HUBS.length} signed micro clinic layers are activating. They appear on this site as example illustrations.</p>
        </AddOn>
        <AddOn icon={Footprints} title="Street Team" line="Ambassadors doing on-site product sampling and door-to-door, by neighbourhood." fig={STREET_REACH_FIG.v} figLabel={STREET_REACH_FIG.l} chip="Canada for now" href="/street-team" testId="home-street-tile" figTestId="home-street-figure">
          <p>Reach comes from our provider network, which is activating, plus the Street Team Ambassadors. The 2027 figure is an estimate.</p>
        </AddOn>
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-foreground/60" data-testid="what-youre-buying-fine"><LayoutGrid className="mt-0.5 size-3 shrink-0" aria-hidden />{AUDIENCE_FINE}</p>
    </div>
  );
}
