/**
 * Birch Reserve home, condensed (Nov 19 2026, Randy t226u + Chris Percy: "a lot of content ... a more condensed
 * version for the home page that links to other pages"). Less wording, more visuals: a one-line hero with the kit CTA,
 * big number tiles, live hub cards and link tiles to the deeper pages. Pricing, proof, process, the Street Team route,
 * FAQs and terms stay on the page but collapsed (native <details>), and the full detail lives on the linked pages.
 * Visual language matches /intake and the kit report (lime wash, navy cards, lime pills, report serif/forest).
 */
import type { ReactNode } from "react";
import { ArrowRight, BookOpen, Building2, ChevronDown, FileText, Handshake, LayoutGrid, Package, Sparkles, Store, Users } from "lucide-react";
import { DoorRoute } from "@/components/br/door-route";
import { FounderNote, LIVE_HUB_IMAGE, LIVE_HUB_URL, SOLE_HUB_IMAGE, SOLE_HUB_URL, priceLabels, useAvailability } from "@/components/br/prime-hero";
import { MediaKitPdfLink, ProofStrip, SalesContact, TRUST_FAQ, TrustBand, TrustFaq } from "@/components/br/trust";
import { KitCta } from "@/components/br/kit-cta";
import { Faq, JsonLd, usePageMeta } from "@/components/br/ui";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { BuyCta } from "@/components/br/buy-cta";
import { AGENCY_SHARE } from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { INVENTORY, PUBLISHER_INCENTIVE } from "../../../../api-server/src/lib/overhaul/model";
import { DOOR_ROUTE } from "../../../../api-server/src/lib/doorRoute";
import { UPGRADE_PATH_LINE } from "../../../../api-server/src/lib/overhaul/mediaKit";

const NAVY = "#0b1f3a";

const FAQ = [
  { q: "Where exactly do the ads run?", a: "Only inside co-branded hubs from Recovery Brands (recovery, longevity and food today; pets in queue) and inside health and wellness business hubs such as physio, gym, studio and clinic hubs. Each hub has four placements: post-purchase, the hub home page, product and services pages, and the member dashboard behind login." },
  { q: "Which hubs are live?", a: `${INVENTORY.line} More hubs launch over time.` },
  { q: "Is this display or cost-per-click?", a: "Both. Every placement can be bought as display (priced per thousand views) or CPC (priced per click). Deposits and area locks draw down against either." },
  { q: "Are the audience numbers measured?", a: "Not yet. Any audience or view figure on this site is a modelled estimate, not measured delivery. We don't publish a network views figure; your insertion order sizes views against live hub supply. Reporting on your campaign is measured with UTM links and promo codes." },
  { q: "Can a local business or studio buy?", a: "Yes. Start with the same $190 USD 7-day look or $490 USD reserve. Locking your area (a share of hub display near your postal code) is a premium option, by inquiry." },
  { q: "How does my business become a hub?", a: `Studios and retailers activate a hub at scalehealth.ca/clinichubs and earn cash or ad credit once they activate their audience (email, text, a link on their site, at checkout, social). It is paid ${PUBLISHER_INCENTIVE.paidDaysAfterFirstTransaction} days after we see real traffic or transactions; self-purchases are excluded. Brands with a recovery audience can apply for a co-branded hub.` },
  { q: "Do agencies get anything?", a: `Yes. ${AGENCY_SHARE.line} Agencies can also prepay a client test budget and get UTM and promo-code reporting per hub and surface.` },
];

const STATS = [
  { v: "120+", l: "retail hubs", tid: "stat-retail-hubs" },
  { v: "1MM+", l: "recovery customers (est.)", tid: "stat-recovery-customers" },
  { v: "CA + US", l: "Canada + USA", tid: "stat-geo" },
];

const HUBS = [
  { href: LIVE_HUB_URL, img: LIVE_HUB_IMAGE, name: "DR-HO'S physio", host: "physio.drhonow.com", tid: "live-hub-drho" },
  { href: SOLE_HUB_URL, img: SOLE_HUB_IMAGE, name: "SOLE", host: "scalehealth.ca/sole", tid: "live-hub-sole" },
];

const TILES = [
  { href: "/intake?ref=home_tile", icon: Sparkles, title: "Monetization Kit", line: "Exposure + hub earnings. Free.", tid: "tile-intake", hot: true },
  { href: "/hubs", icon: Building2, title: "Hubs", line: "Where your brand shows up.", tid: "tile-hubs" },
  { href: "/media-kit", icon: BookOpen, title: "Media kit", line: "Placements, rates, one page.", tid: "tile-media-kit" },
  { href: "/agencies", icon: Handshake, title: "Agencies", line: "10% of media spend, in cash.", tid: "tile-agencies" },
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
  usePageMeta("Birch Reserve | Display space across private health & wellness hubs", "Put your brand inside private, members-only health and wellness hubs: 120+ retail hubs, 1MM+ recovery customers (est., growing to 300–500+ hubs), Canada + USA. Get a free Monetization Kit. Prices in USD; estimates are modelled.");
  const price = priceLabels(useAvailability());
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
          email: "sales@silverbirchgrowth.com",
          description: "Ad space inside co-branded Recovery Brand hubs and health & wellness business hubs. Display and CPC on post-purchase, hub home, product and services, and member dashboard pages.",
          address: { "@type": "PostalAddress", addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" },
        }}
      />

      {/* 1. Hero: one line + the kit CTA. */}
      <section className="bg-[radial-gradient(ellipse_at_top_left,_#ecfccb_0%,_transparent_60%)]" data-testid="home-hero">
        <div className="container mx-auto max-w-5xl px-4 pb-8 pt-10 md:pb-12 md:pt-16">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Birch Reserve · Health &amp; wellness hubs</p>
          <h1 className="mt-2 font-display text-[2.6rem] leading-[1.02] text-[#0b1f3a] md:text-7xl">Put your brand inside private wellness hubs.</h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground md:text-lg">One free kit: your exposure and your hub earnings, side by side.</p>
          <BuyCta placement="hero_home" className="mt-6" />
          <div className="mt-4" data-testid="home-kit-cta">
            <KitCta placement="hero_home" size="lg" testId="home-cta-kit" sub={null} />
          </div>
          <p className="mt-3 text-[13px] text-foreground/60">
            or <a href={LOOK_HREF} className="font-semibold text-[#0b1f3a] underline underline-offset-4" data-testid="home-cta-look">start with a {price.look} 7-day look</a>
          </p>
        </div>
      </section>

      {/* 2. Big numbers. */}
      <section className="container mx-auto max-w-5xl px-4 pb-10" data-testid="home-stats">
        <div className="grid gap-3 md:grid-cols-[1.45fr_1fr]">
          <div className="rounded-2xl p-5 text-white shadow-lg md:p-7" style={{ background: NAVY }} data-testid="home-retail-tile">
            <div className="flex flex-wrap items-center gap-2">
              <Store className="size-4 text-lime-300" aria-hidden />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Retail network</span>
              <Chip>Estimate</Chip>
            </div>
            <ul className="mt-5 flex flex-wrap justify-between gap-x-6 gap-y-4 md:justify-start md:gap-x-8">
              {STATS.map((s) => (
                <li key={s.tid} data-testid={s.tid}>
                  <p className="whitespace-nowrap font-display text-[1.9rem] leading-none tabular-nums md:text-[2.8rem]">{s.v}</p>
                  <p className="mt-1.5 text-[12px] leading-tight text-white/70 md:text-sm">{s.l}</p>
                </li>
              ))}
            </ul>
          </div>
          <a href="/media-kit#doors" className="group relative block min-h-[180px] overflow-hidden rounded-2xl text-white shadow-lg" style={{ background: "#0E3B2A" }} data-testid="home-street-tile">
            <img src={DOOR_ROUTE.mapWebp} alt="" aria-hidden width={DOOR_ROUTE.mapWidth} height={DOOR_ROUTE.mapHeight} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover opacity-45 transition group-hover:opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E3B2A] via-[#0E3B2A]/60 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-5 md:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#BFF3D6]">Street Team</span>
                <Chip>Modelled</Chip>
              </div>
              <p className="mt-2 font-display text-[2.4rem] leading-none md:text-5xl" data-testid="home-street-figure">A few million</p>
              <p className="mt-1.5 text-sm text-white/75">doors targeted around the retail network <ArrowRight className="ml-1 inline size-3.5 transition group-hover:translate-x-0.5" aria-hidden /></p>
            </div>
          </a>
        </div>
      </section>

      {/* 3. Two ways in (same cards as the intake). */}
      <section className="container mx-auto max-w-5xl px-4 pb-10" data-testid="home-ways">
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
      </section>

      {/* 4. Live hubs as visual cards. */}
      <section className="container mx-auto max-w-5xl px-4 pb-10" id="proof-live" data-testid="live-hub-thumbs">
        <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">Live hubs</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {HUBS.map((h) => (
            <a key={h.tid} href={h.href} target="_blank" rel="noopener" data-testid={h.tid} className="group block overflow-hidden rounded-2xl border border-[#0b1f3a]/10 bg-white shadow-sm transition hover:shadow-lg" aria-label={`Visit the live ${h.name} hub`}>
              <img src={h.img} alt={`${h.name} members-only hub, live`} width={1440} height={900} loading="lazy" decoding="async" className="block aspect-[16/10] w-full object-cover object-top" />
              <span className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-bold text-[#0b1f3a]">{h.name} <Chip tone="live">Live</Chip></span>
                  <span className="block truncate text-xs text-foreground/55">{h.host}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-[#0b1f3a] group-hover:underline">Visit ↗</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 5. Link tiles to the deeper pages. */}
      <section className="container mx-auto max-w-5xl px-4 pb-12" data-testid="home-tiles">
        <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">Go deeper</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {TILES.map((t) => (
            <a key={t.tid} href={t.href} data-testid={t.tid} className={`group flex min-h-[132px] flex-col justify-between rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md md:p-5 ${t.hot ? "bg-lime-300 text-[#0b1f3a]" : "border border-[#0b1f3a]/10 bg-white text-[#0b1f3a]"}`}>
              <span className={`grid size-10 place-items-center rounded-full ${t.hot ? "bg-[#0b1f3a] text-lime-300" : "bg-[#ecfccb] text-[#0b1f3a]"}`}><t.icon className="size-5" aria-hidden /></span>
              <span className="mt-3 block">
                <span className="flex items-center gap-1 text-base font-bold md:text-lg">{t.title}<ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
                <span className="mt-0.5 block text-[13px] leading-snug text-[#0b1f3a]/65">{t.line}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* 6. Everything long, collapsed. */}
      <section className="border-t border-[#0b1f3a]/10 bg-white/60" id="more" data-testid="home-more">
        <div className="container mx-auto max-w-5xl space-y-3 px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl text-[#0b1f3a] md:text-4xl">The details</h2>
            <MediaKitPdfLink variant="line" testId="home-media-kit-pdf" />
          </div>

          <Expand title="Pricing" sub={UPGRADE_PATH_LINE} testId="home-packages">
            <div className="grid gap-3 p-5 md:grid-cols-2 md:p-6">
              <div className="rounded-xl border border-[#0b1f3a]/10 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">Small business package</p>
                <p className="mt-1 font-display text-2xl text-[#0b1f3a]">{price.look} look · {price.seat} reserve</p>
                <p className="mt-2 text-sm text-foreground/75">Card checkout. 100% media credit until the IO, usable 12 months; fully refundable until 14 days before launch. The {price.look} look converts in full to the reserve within 7 days, or is refunded.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={RESERVE_HREF} data-testid="home-cta-seat" className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[#0b1f3a] px-5 text-sm font-bold text-white hover:bg-lime-300 hover:text-[#0b1f3a]">Reserve · {price.seat} <ArrowRight className="size-4" aria-hidden /></a>
                  <a href={LOOK_HREF} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#0b1f3a]/25 px-5 text-sm font-bold text-[#0b1f3a] hover:border-[#0b1f3a]">7-day look · {price.look}</a>
                </div>
              </div>
              <div className="rounded-xl p-4 text-white" style={{ background: NAVY }}>
                <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-lime-300">Premium slots · the main event <span className="rounded-full bg-lime-300 px-2 py-0.5 text-[10px] tracking-wider text-[#0b1f3a]">Inquire only</span></p>
                <p className="mt-1 font-display text-2xl">From $25K, $25K–$50K USD</p>
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

          <Expand title="Talk to the founder" sub="Silver Birch Growth Inc. · Toronto" testId="home-contact">
            <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
              <SalesContact />
              <FounderNote />
            </div>
          </Expand>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <KitCta placement="footer_home" size="md" testId="home-cta-kit-bottom" sub={null} />
            <a href="/terms" className="inline-flex items-center gap-1 text-sm text-foreground/60 underline underline-offset-4"><FileText className="size-4" aria-hidden />Terms</a>
          </div>
          <p className="text-[12px] text-foreground/50">Prices in USD. Audience and reach figures are estimates (modelled), not measured delivery.</p>
        </div>
      </section>

      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [...TRUST_FAQ, ...FAQ].map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })) }} />
    </div>
  );
}
