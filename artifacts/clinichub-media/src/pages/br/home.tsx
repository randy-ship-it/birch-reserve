/**
 * Birch Reserve home, condensed (Nov 19 2026, Randy t226u + Chris Percy: "a lot of content ... a more condensed
 * version for the home page that links to other pages"). Less wording, more visuals: a one-line hero with the kit CTA,
 * big number tiles, live hub cards and link tiles to the deeper pages. Pricing, proof, process, the Street Team route,
 * FAQs and terms stay on the page but collapsed (native <details>), and the full detail lives on the linked pages.
 * Visual language matches /intake and the kit report (lime wash, navy cards, lime pills, report serif/forest).
 */
import { WatchHowItWorks } from "@/components/br/reel-button";
import { Tam2027 } from "@/components/br/inventory-plan";
import { HubAlerts } from "@/components/br/hub-alerts";
import { MODELLED_FOOTER } from "../../../../api-server/src/lib/overhaul/pilotPath";
import { BLOCK_BAND_LINE } from "../../../../api-server/src/lib/overhaul/mediaKit";
import { useEffect, type ReactNode } from "react";
import { ArrowRight, BookOpen, Building2, ChevronDown, FileText, Handshake, LayoutGrid, Package, Sparkles, Store, Users } from "lucide-react";
import { DoorRoute } from "@/components/br/door-route";
import { FounderNote, priceLabels, useAvailability } from "@/components/br/prime-hero";
import { MediaKitPdfLink, ProofStrip, SalesContact, TRUST_FAQ, TrustBand, TrustFaq } from "@/components/br/trust";
import { HowWeGotHere } from "@/components/br/how-we-got-here";
import { TrackRecord } from "@/components/br/track-record";
import { PerformanceRanges } from "@/components/br/performance-ranges";
import { FlightReportExample } from "@/components/br/flight-report";
import { GtmSetup } from "@/components/br/gtm-setup";
import { PerformanceOnly } from "@/components/br/performance-only";
import { GtmBotTeaser } from "@/components/br/gtm-bot-teaser";
import { TrustedAgencyPartners } from "@/components/br/trusted-agency-partners";
import { StreetTeamProgram } from "@/components/br/street-team";
import { PartnersTeaser } from "@/components/br/partners";
import { KitCta, intakeHref } from "@/components/br/kit-cta";
import { logCtaClick } from "@/lib/shareTrack";
import { Faq, JsonLd, usePageMeta } from "@/components/br/ui";
import { LOOK_HREF, RESERVE_HREF, lookHref} from "@/components/br/pricing";
import { BuyCta } from "@/components/br/buy-cta";
import { LiveHubGrid, HubFunnel } from "@/components/br/hub-funnel";
import { OwnTheMoment, FourSteps, SeeTheProof } from "@/components/br/hub-story";
import { MidTier } from "@/components/br/next-step";
import { WhatYoureBuying, hubDefinition, hubHostLine } from "@/components/br/what-youre-buying";
import { siteName } from "@/lib/siteSkin";
import { SeeYourAd } from "@/components/br/see-your-ad";
import { BuyJourney } from "@/components/br/journey";
import { trackAttn, useAttention } from "@/lib/attention";
import { ActivityPulse, CategoryStrip, QuestionsBrandsAskCompact } from "@/components/br/market-pulse";
import { AGENCY_RATE_CARD } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { INVENTORY, PUBLISHER_INCENTIVE } from "../../../../api-server/src/lib/overhaul/model";
import { UPGRADE_PATH_LINE } from "../../../../api-server/src/lib/overhaul/mediaKit";

const NAVY = "#0b1f3a";

const FAQ = [
  { q: "Where exactly do the ads run?", a: "In post-purchase moments and inside health and wellness member hubs: pages inside a brand, clinic or retailer where its own customers land right after they buy or book. Categories start with recovery, then longevity, sleep, nutrition and more. Private clinic network display, retail micro hubs and the Street Team are separate add-ons. Each hub has four placements: post-purchase, the hub home page, product and services pages, and the member dashboard behind login." },
  { q: "Which hubs are live?", a: `${INVENTORY.line} More hubs launch over time.` },
  { q: "Is this display or cost-per-click?", a: "Both. Every placement can be bought as display (priced per thousand views) or CPC (priced per click). Deposits and area locks draw down against either." },
  { q: "Are the audience numbers measured?", a: "Not yet. Audience and view figures on this site are modelled estimates from listed partners, not measured delivery. We don't publish a measured network views figure (the 2027 inventory figure is a modelled estimate); your insertion order sizes views against live hub supply. Reporting on your campaign is measured with UTM links and promo codes." },
  { q: "Can a local business or studio buy?", a: "Yes. Start with the same $190 USD 7-day look or $490 USD reserve. Locking your area (a share of hub display near your postal code) is a premium option, by inquiry." },
  { q: "How does my business become a hub?", a: `Studios and retailers activate a hub on ScaleHealth.ca, the platform that hosts the hubs (scalehealth.ca/clinichubs), and earn cash or ad credit once they activate their audience (email, text, a link on their site, at checkout, social). It is paid ${PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after we see real traffic or transactions; self-purchases are excluded. Brands with a recovery audience can apply for a co-branded hub.` },
  { q: "Do agencies get anything?", a: `Yes. ${AGENCY_RATE_CARD.line} ${AGENCY_RATE_CARD.resale} ${AGENCY_RATE_CARD.disclosure} ${AGENCY_RATE_CARD.direct} ${AGENCY_RATE_CARD.noUndercut} Agencies can also prepay a client test budget and get UTM and promo-code reporting per hub and surface.` },
];

const TILES = [
  { href: "/intake?ref=home_tile", icon: Sparkles, title: "Monetization Kit", line: "Exposure + hub earnings. Free.", tid: "tile-intake", hot: true },
  { href: "/hubs", icon: Building2, title: "Hubs", line: "Where your brand shows up.", tid: "tile-hubs" },
  { href: "/media-kit", icon: BookOpen, title: "Media kit", line: "Placements, rates, one page.", tid: "tile-media-kit" },
  { href: "/agencies", icon: Handshake, title: "Agencies", line: "Standard 15% agency commission.", tid: "tile-agencies" },
  { href: "/audiences", icon: Users, title: "Audiences", line: "Who you reach.", tid: "tile-audiences" },
  { href: "/inventory", icon: LayoutGrid, title: "Inventory", line: "The network, by category.", tid: "tile-inventory" },
];

function Chip({ children, tone = "estimate" }: { children: ReactNode; tone?: "estimate" | "live" }) {
  const c = tone === "live" ? "bg-[#BFF3D6] text-[#0B6B43]" : "border border-[#F1D58F] bg-[#FFF4DB] text-[#8A5A00]";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${c}`}>{children}</span>;
}

function Expand({ title, sub, children, testId, open = false }: { title: string; sub?: string; children: ReactNode; testId: string; open?: boolean }) {
  return (
    <details data-testid={testId} open={open || undefined} className="group overflow-hidden rounded-2xl border border-[#0b1f3a]/10 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-display text-xl leading-tight text-[#0b1f3a] md:text-2xl">{title}</span>
          {sub ? <span className="mt-0.5 block text-[13px] text-foreground/60">{sub}</span> : null}
        </span>
        <ChevronDown className="size-5 shrink-0 text-[#0b1f3a]/60 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-[#0b1f3a]/10">{children}</div>
    </details>
  );
}

export default function BrHome() {
  useAttention({ audience: "[data-testid=home-stats]", hubs: "#proof-live", ladder: "[data-testid=home-offer-stairs]", street: "[data-testid=home-street-team]", details: "#more", end: "[data-testid=home-close]" });
  usePageMeta("Birch Reserve | Display space across private health & wellness hubs", "Put your brand in post-purchase moments and inside health and wellness member hubs: ~128MM modelled page views a month (estimate), 200+ retail locations (500+ soon) with 1MM+ captive recovery consumers, and 1MM+ consumers now through our provider network and Street Team, expanding to an estimated 3MM+ in 2027. Get a free Monetization Kit. Prices in USD; figures are modelled estimates from listed partners: reach and audience, not delivered impressions.");
  const price = priceLabels(useAvailability());
  // Phones: the floating chat + voice buttons stay out of the hero preview until the visitor scrolls past it.
  useEffect(() => {
    const hero = document.querySelector("[data-testid=home-hero]");
    if (!hero || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    const io = new IntersectionObserver(([en]) => root.classList.toggle("br-hero-in-view", Boolean(en?.isIntersecting)), { threshold: 0.05 });
    io.observe(hero);
    return () => { io.disconnect(); root.classList.remove("br-hero-in-view"); };
  }, []);
  // Deep links like /#gtm-setup open the collapsed section that holds the target.
  useEffect(() => {
    const openHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      let d = el?.closest("details") ?? null;
      if (!el || !d) return;
      while (d) { d.open = true; d = d.parentElement?.closest("details") ?? null; }
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, []);
  return (
    <div className="w-full overflow-x-hidden bg-[#FAF8F3]" data-testid="br-home">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Birch Reserve",
          url: "https://birchreserve.net/",
          logo: "https://birchreserve.net/logo.svg",
          parentOrganization: { "@type": "Organization", name: "Silver Birch Growth Inc." },
          email: "randy@scalehealth.ca",
          description: "Ad space inside co-branded Recovery Brand hubs and health & wellness business hubs. Display and CPC on post-purchase, hub home, product and services, and member dashboard pages.",
          address: { "@type": "PostalAddress", addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" },
        }}
      />

      <style>{`@media (max-width: 767px){html.br-hero-in-view .birch-dock-squirrel{visibility:hidden!important;pointer-events:none!important}html.br-hero-in-view [data-testid=sticky-kit-cta]{display:none!important}}`}</style>
      {/* 1. Hero: one line + the kit CTA. */}
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_60%)]" data-testid="home-hero">
        {/* Mobile first screen (Randy, Nov 21 2:26 PM): one slim line of real recent activity above the headline. In flow, never over the preview card. */}
        <div className="container mx-auto min-h-[5.25rem] max-w-6xl px-4 pt-3 md:hidden" data-testid="home-pulse-slim"><ActivityPulse mode="inline" slim /></div>
        <div className="container mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-5 px-4 pb-8 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:grid-rows-[auto_auto] md:content-center md:pb-12 md:pt-14">
          <div className="md:col-start-1 md:row-start-1 md:self-end">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55" data-testid="home-eyebrow">{siteName()} · Private hub display network</p>
          <h1 className="mt-2 font-display text-[2.6rem] leading-[1.02] text-[#0b1f3a] md:text-6xl">See your brand inside a live wellness hub.</h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg" data-testid="home-hub-definition">{hubDefinition()}</p>
          </div>
          <div className="order-3 md:order-none md:col-start-1 md:row-start-2 md:self-start">
          <BuyCta placement="hero_home" className="mt-0" onClick={() => trackAttn("hero_cta.buy")} />
          <p className="mt-3 text-[13px] text-foreground/60">
            or <a href="/buy?plan=hold-190&ref=hero_home" className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="home-cta-look" onClick={() => trackAttn("hero_cta.look")}>start with a {price.look} 7-day look</a>
          </p>
          <p className="mt-2 text-[13px] text-foreground/60" data-testid="home-hero-agencies">
            Buying for clients? <a href="/agencies?ref=hero_home" className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="home-cta-agencies" onClick={() => trackAttn("hero_cta.agencies")}>For agencies: the standard 15% agency commission off the rate card</a>
          </p>
          <p className="mt-2 text-[13px] text-foreground/60" data-testid="home-kit-cta">
            Not ready? <a href={intakeHref("hero_home")} className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="home-cta-kit" onClick={() => { logCtaClick("hero_home"); trackAttn("hero_cta.kit"); }}>Get my free Monetization Kit</a>
          </p>
          <div className="mt-4"><WatchHowItWorks placement="hero_home" testId="home-watch-reel" /></div>
          </div>
          <div className="order-2 md:order-none md:col-start-2 md:row-span-2 md:row-start-1 md:self-center"><SeeYourAd testId="home-hero-mock" /><p className="mt-1 text-[12px] leading-snug text-foreground/60" data-testid="home-hub-host">{hubHostLine()}</p></div>
        </div>
      </section>
      {/* Front door (Randy, outside review Nov 23 2026 10:37 PM): the $190 look and $490 shared reserve, right under the hero. */}
      <section className="container mx-auto max-w-6xl px-4 pb-6 pt-1" data-testid="home-plan-strip">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-[#0b1f3a]/15 bg-white p-4 shadow-sm" data-testid="home-strip-look">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">7-day look</p>
            <p className="mt-0.5 font-display text-3xl leading-none text-[#0b1f3a]">{price.look}</p>
            <p className="mt-2 flex-1 text-[13px] leading-snug text-foreground/75">See your placement for 7 days. It converts in full to a reserve, or it is refunded.</p>
            <a href="/buy?plan=hold-190&ref=home_strip" data-testid="home-strip-look-cta" onClick={() => trackAttn("strip.look")} className="mt-3 inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-[#0b1f3a]/30 px-5 text-sm font-bold text-[#0b1f3a] hover:border-[#0b1f3a]">Start my look · {price.look} <ArrowRight className="size-4" aria-hidden /></a>
          </div>
          <div className="flex flex-col rounded-2xl bg-lime-200 p-4 shadow-sm" data-testid="home-strip-reserve">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0b1f3a]/70">Reserve</p>
            <p className="mt-0.5 font-display text-3xl leading-none text-[#0b1f3a]">{price.seat}</p>
            <p className="mt-2 flex-1 text-[13px] leading-snug text-[#0b1f3a]/80">A shared reserve in your category. 100% media credit toward your insertion order, refundable until 14 days before launch.</p>
            <a href="/buy?plan=reserve-490&ref=home_strip" data-testid="home-strip-reserve-cta" onClick={() => trackAttn("strip.reserve")} className="mt-3 inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white hover:bg-white hover:text-[#0b1f3a]">Reserve · {price.seat} <ArrowRight className="size-4" aria-hidden /></a>
          </div>
        </div>
        {/* Agencies get their own door (Randy, Nov 24 2026 12:57 PM ET, t543u): a clear secondary next to the two prices. */}
        <a href="/agencies?ref=home_strip" data-testid="home-strip-agencies" onClick={() => trackAttn("strip.agencies")} className="group mt-3 flex flex-col gap-2 rounded-2xl border-2 border-[#0b1f3a] bg-white p-4 shadow-sm transition-colors hover:bg-[#0b1f3a] sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55 group-hover:text-lime-300">For agencies &amp; brokers</span>
            <span className="mt-0.5 block font-display text-xl leading-tight text-[#0b1f3a] group-hover:text-white md:text-2xl">A standard 15% agency commission off the gross rate card. You set the resale price. We do not undercut your clients.</span>
          </span>
          <span className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 self-start rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white group-hover:bg-lime-300 group-hover:text-[#0b1f3a] sm:self-auto">See agency terms <ArrowRight className="size-4" aria-hidden /></span>
        </a>
        <p className="mt-2 text-[12px] text-foreground/60">Prices in USD unless shown. Want a category to yourself? <a href="/exclusive?ref=home_strip" className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="home-strip-exclusive">See the exclusive reserve</a>.</p>
      </section>
      {/* Light continuous category strip under the hero (Randy Nov 21 10:20 AM). */}
      <div className="container mx-auto max-w-6xl px-4 pb-5"><div className="hidden mb-3 min-h-[6.5rem] md:block" data-testid="pulse-row"><ActivityPulse desktopInline /></div><CategoryStrip testId="home-category-strip" /></div>

      {/* 2. What you're buying (Randy, voice, Nov 23 2026 2:37 PM ET): the inventory, plain and visual, for a cold advertiser. */}
      <section className="container mx-auto max-w-5xl px-4 pb-10 pt-2" data-testid="home-stats">
        <WhatYoureBuying testId="home-what-youre-buying" />
        <div className="mt-3 rounded-2xl border border-[#0b1f3a]/10 bg-white p-5 shadow-sm md:p-6"><Tam2027 compact testId="home-tam-2027" /><details className="group mt-3 rounded-xl border border-[#0b1f3a]/10" data-testid="home-alerts-expand"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#0b1f3a] [&::-webkit-details-marker]:hidden">Get launch alerts for your category<ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden /></summary><div className="border-t border-[#0b1f3a]/10 p-3"><HubAlerts compact where="home" pagePath="/" /></div></details></div>
        <p className="mt-2 text-[12px] text-foreground/60" data-testid="home-stats-label">{MODELLED_FOOTER}</p>
      </section>

      {/* 4. Live hubs as visual cards. */}
      <section className="container mx-auto max-w-5xl px-4 pb-10" id="proof-live" data-testid="live-hub-thumbs">
        <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">Live now and activating hubs</h2>
        <div className="mt-4"><LiveHubGrid /></div>
        <HubFunnel />
      </section>

      {/* 5. Trusted Agency Partners (Randy Nov 24 2026 t8289u; rate-card model, same as /agencies). */}
      <TrustedAgencyPartners />

      {/* 2c. Categories + Questions brands ask moved up: strip under the hero, compact questions by the kit CTA (Nov 21). */}

      {/* 6. Everything long, collapsed. */}
      <section className="border-t border-[#0b1f3a]/10 bg-white/60" id="more" data-testid="home-more">
        <div className="container mx-auto max-w-5xl space-y-3 px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">The details</h2>
            <MediaKitPdfLink variant="line" testId="home-media-kit-pdf" />
          </div>

          <Expand title="Example report and expected ranges" sub="What a flight report shows. Estimates, not guarantees" testId="home-reports">
            <div className="space-y-4 p-4 md:p-6"><FlightReportExample where="home" /><PerformanceRanges where="home" /></div>
          </Expand>

          <Expand title="See the card in context" sub="Example mockups on live hubs, and the proof behind them" testId="home-own-moment">
            <div className="space-y-6 p-4 md:p-6"><OwnTheMoment /><SeeTheProof /></div>
          </Expand>

          <Expand title="Our track record" sub="How we got here" testId="home-track">
            <div className="space-y-4 p-4 md:p-6"><HowWeGotHere where="home" /><TrackRecord where="home" /></div>
          </Expand>

          <Expand title="Every step, from $190 to premium" sub="The ladder, and how a first order runs" testId="home-ladder">
            <div className="space-y-6 p-4 md:p-6">
              <div data-testid="home-offer-stairs"><BuyJourney where="home" testId="home-journey" /></div>
              <div data-testid="home-four-steps"><FourSteps look={price.look} seat={price.seat} /></div>
            </div>
          </Expand>


          <Expand title="Street Team program" sub="Coming 2027. Door-to-door, by route" testId="home-street-team">
            <div className="p-4 md:p-6"><StreetTeamProgram where="home" /></div>
          </Expand>

          <Expand title="Questions brands ask" sub="Six short answers" testId="home-questions-expand">
            <div className="p-5 md:p-6"><QuestionsBrandsAskCompact testId="home-questions-compact" /></div>
          </Expand>

          <Expand title="Bigger budgets" sub="Agency client tests and sponsorship credit" testId="home-mid-tier">
            <div className="p-5 md:p-6"><MidTier where="home" compact /></div>
          </Expand>

          <Expand title="Pricing" sub={UPGRADE_PATH_LINE} testId="home-packages">
            <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
              <div className="rounded-xl border border-[#0b1f3a]/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Small business package</p>
                <p className="mt-1 font-display text-2xl text-[#0b1f3a]">{price.look} look · {price.seat} reserve</p>
                <p className="mt-2 text-sm text-foreground/75">Card checkout. 100% media credit until the insertion order (IO), usable 12 months; fully refundable until 14 days before launch. The {price.look} look converts in full to the reserve within 7 days, or is refunded.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={RESERVE_HREF} data-testid="home-cta-seat" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white hover:bg-lime-300 hover:text-[#0b1f3a]">Reserve · {price.seat} <ArrowRight className="size-4" aria-hidden /></a>
                  <a href={lookHref("home_look")} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#0b1f3a]/25 px-5 text-sm font-bold text-[#0b1f3a] hover:border-[#0b1f3a]">7-day look · {price.look}</a>
                </div>
              </div>
              <div className="rounded-xl p-4 text-white" style={{ background: NAVY }}>
                <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Premium slots · the main event</p>
                <p className="mt-1 font-display text-2xl" data-currency-fixed>{BLOCK_BAND_LINE}</p>
                <p className="mt-2 text-sm text-white/75">Exclusivity, a larger display share and priority placement. No card purchase: we write the insertion order.</p>
                <a href="/media-kit#premium" data-testid="home-cta-premium" className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-lime-300 px-5 text-sm font-bold text-[#0b1f3a] hover:bg-white">Inquire about premium <ArrowRight className="size-4" aria-hidden /></a>
              </div>
            </div>
          </Expand>

          <Expand title="Proof from the live hubs" sub="Measured figures only" testId="home-proof">
            <div className="p-5 md:p-6"><ProofStrip /></div>
          </Expand>

          <Expand title="How it works" sub="From a look to a live placement" testId="home-how">
            <TrustBand />
          </Expand>

          <Expand title="Street Team routes" sub="Door-to-door display, by neighbourhood" testId="home-street">
            <div className="bg-foreground p-5 text-background md:p-8">
              <DoorRoute requestHref="/media-kit#doors" testId="home-doors" />
            </div>
          </Expand>

          <Expand title="Questions" sub="Refunds, privacy, measurement, agencies" testId="home-faq">
            <div className="space-y-6 p-5 md:p-6">
              {/* Nov 18 2026: one FAQPage for the page (was two: trust + home), so search engines read it cleanly. */}
              <TrustFaq schema={false} />
              <Faq items={FAQ} schema={false} />
            </div>
          </Expand>

          <Expand title="Other ways to work with us" sub="Performance-only, your own hub, outreach setup, partnerships" testId="home-more-ways">
            <div className="space-y-4 p-4 md:p-6">
              <div data-testid="home-ways">
                <div className="grid gap-3 sm:grid-cols-2">
          {[
            { icon: Package, title: "Supplier", tag: "Performance-only", sub: "Get into curated hubs. Pay on results.", tid: "home-way-supplier", ref: "home_supplier" },
            { icon: Store, title: "Hub", tag: "Max exposure", sub: "Your audience, shelf or screens. Earn a share.", tid: "home-way-hub", ref: "home_hub" },
          ].map((w) => (
            <a key={w.tid} href={`/intake?ref=${w.ref}`} data-testid={w.tid} className="group flex items-center gap-4 rounded-2xl p-5 text-white shadow-md transition hover:-translate-y-0.5" style={{ background: NAVY }}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime-300 text-[#0b1f3a]"><w.icon className="size-5" aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">{w.title}</span>
                  <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a]">{w.tag}</span>
                </span>
                <span className="mt-0.5 block text-sm text-white/70">{w.sub}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 text-lime-300 transition group-hover:translate-x-0.5" aria-hidden />
            </a>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-foreground/55">Most brands are both. One form covers both views.</p>
      
                <p className="mt-2 text-[12px] text-foreground/55">Most brands are both. One form covers both views.</p>
              </div>
              <PerformanceOnly where="home" /><div data-testid="home-gtm-setup"><GtmSetup where="home" /></div><GtmBotTeaser /><PartnersTeaser />
            </div>
          </Expand>

          <Expand title="Ask about a bid" sub="Email the desk · Silver Birch Growth Inc. · Toronto" testId="home-contact">
            <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
              <SalesContact />
              <FounderNote />
            </div>
          </Expand>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <KitCta placement="footer_home" size="md" testId="home-cta-kit-bottom" sub={null} />
            <a href="/terms" className="inline-flex items-center gap-1 text-sm text-foreground/60 underline underline-offset-4"><FileText className="size-4" aria-hidden />Terms</a>
          </div>
          <p className="text-[12px] text-foreground/50">Prices in USD. Audience and reach figures are modelled estimates from listed partners, not measured delivery.</p>
        </div>
      </section>

      {/* Ends on the payoff: one line, one CTA. */}
      <section className="bg-[#0b1f3a] py-12 text-white md:py-16" data-testid="home-close">
        <div className="container mx-auto flex max-w-5xl flex-col items-start justify-between gap-5 px-4 md:flex-row md:items-center">
          <p className="font-display text-3xl leading-tight md:text-4xl">Your brand, on a live hub.</p>
          <KitCta placement="close_home" size="lg" testId="home-close-kit" sub={null} onClick={() => trackAttn("hero_cta.kit")} />
        </div>
      </section>

      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [...TRUST_FAQ, ...FAQ].map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) }} />
    </div>
  );
}
