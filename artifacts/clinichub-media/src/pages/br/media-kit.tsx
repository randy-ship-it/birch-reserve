import { WhatHundredGets, MeasuredReport, YourCardHere, PremiumSpendDown } from "@/components/br/hundred";
import { WatchHowItWorks } from "@/components/br/reel-button";
import { Tam2027 } from "@/components/br/inventory-plan";
import { HubAlerts } from "@/components/br/hub-alerts";
import { StartSmall } from "@/components/br/start-small";
import { ActivityPulse, CategoriesWeServe, QuestionsBrandsAsk } from "@/components/br/market-pulse";
import { EstimateTag } from "@/components/br/intake-kit";
import { AudienceChannels } from "@/components/br/audience-channels";
import { MODELLED_FOOTER } from "../../../../api-server/src/lib/overhaul/pilotPath";
import { BrochureInline, BrochureSlideIn } from "@/components/br/brochure-capture";
import { HowWeGotHere } from "@/components/br/how-we-got-here";
import { TrackRecord } from "@/components/br/track-record";
import { GtmSetup } from "@/components/br/gtm-setup";
import { STREET_TEAM_ONE_LINE } from "../../../../api-server/src/lib/overhaul/streetTeam";
import { KitCta } from "@/components/br/kit-cta";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Check, Mail, Phone } from "lucide-react";
import { Cta, usePageMeta } from "@/components/br/ui";
import { MediaKitPdfLink } from "@/components/br/trust";
import { SALES_REPLY_LINE } from "@/lib/seller-identity";
import { PlacementVisual, type PlacementKey } from "@/components/br/placement-example";
import { BOOK_CALL_MAILTO_HREF, openRandyChat } from "@/lib/book-call";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { BUYER_FAQ_TITLE, BuyerFaq, EarlySlots, FlightTimeline, ProgramsCallout, SAMPLE_REPORT, FLIGHT_TIMELINE, SampleIoLink, SampleReport, SeeTheUnit } from "@/components/br/buyer-comfort";
import { DoorRoute } from "@/components/br/door-route";
import { Details } from "@/components/br/details";
import { AnnotatedHubMock, NextStep } from "@/components/br/next-step";
import { KitBuilder } from "@/components/br/kit-builder";
import { PriceLadder } from "@/components/br/price-ladder";
import { AvailabilityStrip, CategoryRequestForm, FaceBeforeFlight, FounderNote, NETWORK_HUBS, priceLabels, useAvailability } from "@/components/br/prime-hero";
import {
  AGENCY_CASH_PCT,
  MEDIA_KIT_CPM,
  MEDIA_KIT_EXAMPLES,
  MEDIA_KIT_OFFERS,
  UPGRADE_PATH_LINE,
  agencyCash,
  kitExample,
  usd,
  usdK,
} from "../../../../api-server/src/lib/overhaul/mediaKit";

/**
 * /media-kit: the one link Randy sends (Nov 12 2026, 7:12 PM ET).
 * Scannable in 30 seconds on a phone. Every volume is modelled; no guarantees.
 */

const SURFACE_TILES: Array<{ k: PlacementKey; n: string; title: string; line: string; tag?: string }> = [
  { k: "post_purchase", n: "1", title: "Post-purchase", line: "Thank-you page right after an order or booking.", tag: "Highest intent" },
  { k: "dashboard", n: "2", title: "Member dashboard", line: "Logged-in home where members track orders and plans." },
  { k: "landing", n: "3", title: "Hub home", line: "Banner and tiles on the co-branded hub home page." },
  { k: "products", n: "4", title: "Product & services pages", line: "Inside product, service and booking pages." },
];

/** Example placements are drawn for ~360px; lay them out at that width and scale to the tile. */
const VISUAL_BASE_PX = 360;
function ZoomFit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / VISUAL_BASE_PX)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full">
      <div style={{ width: VISUAL_BASE_PX, zoom: scale }}>{children}</div>
    </div>
  );
}

const RULES = [
  "Media credit until IO. Your payment is media credit; nothing runs until an insertion order names the hub and surface.",
  "A share of display space across the hub network, curated as hubs launch. Premium slots add exclusivity and priority placement.",
  "The $490 USD reserve is fully refundable until 14 days before your launch date; credit is usable 12 months. The $190 USD look converts in full to the reserve within 7 days, or is refunded.",
  "Modelled volumes. Views and impressions are estimates, not measured delivery.",
  "Aggregate UTM reporting only. No personal data is shared.",
  "No impression guarantees, and no guarantees of reach, clicks or sales.",
];

const HOW_TO_START = [
  { n: "1", t: "Reserve your space", d: "Get a share of display space across our growing hub network. Placements are curated hub by hub." },
  { n: "2", t: "Pay by card", d: "$490 USD reserves your space, or take a $190 USD 7-day look first. Stripe checkout, no login." },
  { n: "3", t: "Approve the IO", d: "We send an insertion order naming the hub and surface. Nothing runs before you approve it." },
];

/** 40,000 -> "40,000"; 2,083,333 -> "2.1M". Plain numbers read better than "0.04M". */
function impr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  const r = n >= 100_000 ? 10_000 : 1_000;
  return (Math.round(n / r) * r).toLocaleString("en-US");
}

function Tag({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "lime" }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone === "lime" ? "bg-accent text-accent-foreground" : "border border-foreground/20 bg-secondary/60 text-foreground/70"}`}>
      {children}
    </span>
  );
}

function Block({ id, eyebrow, title, children, tone = "plain" }: { id: string; eyebrow: string; title: string; children: ReactNode; tone?: "plain" | "soft" }) {
  return (
    <section id={id} className={`scroll-mt-20 border-b border-border/70 ${tone === "soft" ? "bg-secondary/40" : "bg-background"}`}>
      <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

/** Book a call opens the Randy chat (site rule); the mailto stays as the no-JS fallback. */
function bookCall(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  openRandyChat({ reason: "book-a-call" });
}

function BookCall({ variant = "ink", testId }: { variant?: "ink" | "lime" | "line"; testId: string }) {
  return (
    <Cta
      href={BOOK_CALL_MAILTO_HREF}
      variant={variant}
      testId={testId}
      className="w-full sm:w-auto"
      onClick={bookCall}
    >
      Book a call
    </Cta>
  );
}

export default function BrMediaKit() {
  usePageMeta(
    "Media kit | Birch Reserve",
    "Display space across a growing network of private health and wellness hubs. $490 USD to reserve or a $190 USD 7-day look, self-serve; premium slots from $25K–$50K, inquire only. Media credit until IO. Modelled volumes, no guarantees.",
  );
  const avail = useAvailability();
  const price = priceLabels(avail);
  const [seatEx, premLo, premHi] = MEDIA_KIT_EXAMPLES as [ReturnType<typeof kitExample>, ReturnType<typeof kitExample>, ReturnType<typeof kitExample>];
  const prem = MEDIA_KIT_OFFERS.premium;
  const agencySeat = agencyCash(MEDIA_KIT_OFFERS.seat.spendUsd);
  const agencyPrem = agencyCash(prem.spendLo);
  const cpm = `~$${MEDIA_KIT_CPM.lo}–${MEDIA_KIT_CPM.hi} CPM`;

  return (
    <div className="media-kit overflow-x-hidden" data-testid="br-media-kit">
      {/* Hero */}
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 pb-10 pt-10 md:px-6 md:pb-14 md:pt-16">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_1.05fr]">
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Media kit · Nov 2026</p>
          <h1 className="mt-3 font-display text-[2.15rem] leading-[1.05] tracking-tight md:text-6xl">Put your brand inside private health and wellness hubs.</h1>
          <p className="mt-2 font-display text-xl text-foreground/70 md:text-2xl">A growing network. Curated placements.</p>
          </div>
          <AnnotatedHubMock testId="mk-hero-mock" initial="effortless" />
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80" data-testid="mk-what">
            Birch Reserve sells a share of display space across our growing network of private, members-only hubs (live today: {NETWORK_HUBS.join(", ").replace(/, ([^,]*)$/, " and $1")}, with more launching): the pages members use right after they buy or book, and when they log back in. Placements are curated as each hub launches. Your payment is media credit until the insertion order. Start self-serve by reserving for {price.seat} or with a {price.look} 7-day look; premium slots are inquire-only.
          </p>
          <p className="mt-3 text-sm font-semibold" data-testid="mk-upgrade">{UPGRADE_PATH_LINE}</p>
          <div className="mt-5">
            <AvailabilityStrip />
            <EarlySlots />
          </div>
          <div className="mt-6" data-testid="mk-kit-cta">
            <KitCta placement="hero_media_kit" size="lg" sub="Free · website + email · hub earnings and supplier exposure, estimated" />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row" id="download">
            <Cta href="#my-kit" variant="lime" testId="mk-download-kit-hero" className="w-full sm:w-auto">Download my kit</Cta>
            <Cta href={RESERVE_HREF} variant="lime" testId="mk-reserve-hero" className="w-full sm:w-auto">Reserve your space — {price.seat}</Cta>
            <Cta href={LOOK_HREF} variant="ink" testId="mk-look-hero" className="w-full sm:w-auto">Take a 7-day look — {price.look}</Cta>
            <Cta href="#request" variant="line" testId="mk-request-hero" className="w-full sm:w-auto">Ask about a placement</Cta>
            <MediaKitPdfLink variant="line" testId="mk-pdf-hero" className="w-full sm:w-auto" />
          </div>
          <div className="mt-4" data-testid="mk-reel-link"><WatchHowItWorks placement="hero_media_kit" testId="mk-watch-reel" /></div>

        </div>
      </section>
      <section className="border-b border-border/70 bg-background" data-testid="mk-audience"><div className="container mx-auto max-w-5xl px-5 py-8 md:px-6"><AudienceChannels testId="mk-audience-channels" /></div></section>
      {/* Mobile: the live feed sits in the gap below the first section (Randy, Nov 20 4:54 PM). */}
      <div className="px-4 py-3 md:hidden"><ActivityPulse mode="inline" /></div>

      {/* Next step: live-hub mock beside $190/$490 + mid-tier bridge (Randy review, Nov 20 2026) */}
      <section className="scroll-mt-20 border-b border-border/70 bg-secondary/40" data-testid="mk-next-step">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
          <NextStep where="media_kit" showMock={false} />
        </div>
      </section>

      <BrochureSlideIn />

      {/* Categories we serve + Questions brands ask (Randy t291u, Nov 20 2026) */}
      <section className="border-b border-border/70 bg-background" data-testid="mk-market-signals">
        <div className="container mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-6 md:py-14">
          <Tam2027 testId="mk-tam-2027" />
          <HubAlerts where="media_kit" pagePath="/media-kit" />
          <div className="hidden min-h-[6.5rem] md:block" data-testid="pulse-row"><ActivityPulse desktopInline /></div>
          <CategoriesWeServe />
          <QuestionsBrandsAsk />
        </div>
      </section>

      {/* GTM setup packages (Randy t332u, Nov 21 2026) */}
      <section className="border-b border-border/70 bg-background" data-testid="mk-gtm-setup">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14"><div className="mb-4"><HowWeGotHere where="media_kit" /></div><div className="mb-4"><TrackRecord where="media_kit" /></div><GtmSetup where="media_kit" />
          <p className="mt-4 text-sm text-foreground/75" data-testid="mk-street-team-line"><strong className="text-[#0b1f3a]">Street team.</strong> {STREET_TEAM_ONE_LINE} <a href="/street-team" className="font-semibold underline underline-offset-2">See the program</a></p>
        </div>
      </section>

      <BrochureInline />

      {/* Download my kit: personalized two-sided kit (preview, Nov 18 2026) */}
      <KitBuilder />

      {/* Proof */}
      <section id="proof" className="scroll-mt-20 border-b border-border/70 bg-background">
        <div className="container mx-auto px-5 py-8 md:px-6 md:py-10">
          <FaceBeforeFlight />
        </div>
      </section>

      {/* See the unit before you lock (buyer comfort, Nov 17 2026) */}
      <section id="see-the-unit" className="scroll-mt-20 border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
          <SeeTheUnit />
        </div>
      </section>

      {/* How to start */}
      <section id="start-small" className="scroll-mt-20 border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
          <PriceLadder />
          {/* Collapsed: NextStep above already shows the $190/$490 and mid-tier cards (no duplicate blocks). */}
          <Details label="Compare every small package side by side" testId="mk-start-small-compare">
            <StartSmall page="media-kit" id="start-small-tiers" heading={false} />
          </Details>
        </div>
      </section>

      <Block id="start" eyebrow="How to start" title="Three steps, about a minute" tone="soft">
        <ol className="grid gap-3 md:grid-cols-3" data-testid="mk-how-to-start">
          {HOW_TO_START.map((s) => (
            <li key={s.n} className="border border-foreground/20 bg-white p-4">
              <span className="font-display text-2xl text-foreground/40">{s.n}</span>
              <h3 className="mt-1 font-display text-lg">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
        <SampleIoLink className="mt-4" />
      </Block>

      {/* How a test dollar becomes a flight (buyer comfort, Nov 17 2026) */}
      <Block id="flight" eyebrow={FLIGHT_TIMELINE.kicker} title={FLIGHT_TIMELINE.title}>
        <FlightTimeline />
        <SampleIoLink className="mt-4" />
      </Block>

      {/* Surfaces */}
      <Block id="surfaces" eyebrow="Where your ad shows" title="Four surfaces in every hub" tone="soft">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="mk-surfaces">
          {SURFACE_TILES.map((s) => (
            <article key={s.k} className={`flex flex-col border bg-white p-3 md:p-4 ${s.tag ? "border-2 border-foreground" : "border-foreground/15"}`}>
              {/* Render the example at desktop size, then zoom it down so it never squashes on a phone. */}
              <div className="pointer-events-none select-none overflow-hidden" aria-hidden>
                <ZoomFit>
                  <PlacementVisual k={s.k} />
                </ZoomFit>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="font-display text-lg leading-none text-foreground/35">{s.n}</span>
                {s.tag ? <Tag tone="lime">{s.tag}</Tag> : null}
              </div>
              <h3 className="mt-1.5 font-display text-lg leading-snug md:text-xl">{s.title}</h3>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{s.line}</p>
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Example placements, drawn on hub pages. Exact position and creative are set in your IO.</p>
      </Block>

      {/* Two tiers */}
      <Block id="rates" eyebrow="Two tiers" title="A small-business package to start. Premium slots are the main event.">
        <div className="grid gap-4 lg:grid-cols-2" data-testid="mk-rate-cards">
          <article className="flex flex-col border border-foreground/20 bg-white p-5 md:p-6" data-testid="mk-card-smb">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Small business package</p>
            <h3 className="mt-1 font-display text-2xl">The easy way to start</h3>
            <p className="mt-3 text-sm text-foreground/80">Self-serve, paid by card. A share of display space across the hub network, curated as hubs launch. 100% media credit until the IO, usable 12 months.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{MEDIA_KIT_OFFERS.look.name}</p>
                <p className="mt-1 font-display text-4xl leading-none">{price.look.replace(/ (USD|CAD)$/, "")} <span className="text-lg">{price.look.slice(-3)}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Holds your spot 7 days. 100% credit if you reserve within 7 days; otherwise a cash refund.</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{MEDIA_KIT_OFFERS.seat.name}</p>
                <p className="mt-1 font-display text-4xl leading-none">{price.seat.replace(/ (USD|CAD)$/, "")} <span className="text-lg">{price.seat.slice(-3)}</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Reserves your share of the network. Fully refundable until 14 days before launch. <EstimateTag /> Modelled estimate, not a guarantee: about {impr(seatEx.imprLo)}–{impr(seatEx.imprHi)} impressions at {cpm}.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Cta href={RESERVE_HREF} testId="mk-cta-seat" className="w-full sm:w-auto">Reserve your space — {price.seat}</Cta>
              <Cta href={LOOK_HREF} variant="line" testId="mk-cta-look" className="w-full sm:w-auto">Take a 7-day look — {price.look}</Cta>
            </div>
            <WhatHundredGets />
          </article>
          <article id="premium" className="flex flex-col border-2 border-foreground bg-foreground p-5 text-background md:p-6" data-testid="mk-card-premium">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-background/60">Premium slots · the main event</p>
              <Tag tone="lime">Inquire only</Tag>
            </div>
            <h3 className="mt-1 font-display text-2xl">From $25K, $25K–$50K</h3>
            <p className="mt-3 text-sm text-background/80">Exclusivity, a larger display share and priority placement. No card purchase — we reply with an insertion order. Term is set on the IO.</p>
            <ul className="mt-4 space-y-2 text-sm text-background/85">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Exclusivity for the term on the IO</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span><EstimateTag /> Modelled estimate, not a guarantee: about {impr(premLo.imprLo)}–{impr(premHi.imprHi)} impressions at {cpm}</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{UPGRADE_PATH_LINE}</li>
            </ul>
            <PremiumSpendDown />
            <div className="mt-6">
              <BookCall variant="lime" testId="mk-premium-inquire" />
            </div>
          </article>
        </div>

        <ProgramsCallout />

        <h3 className="mt-8 flex items-center gap-2 font-display text-xl">The math <EstimateTag /></h3>
        <div className="mt-3 divide-y divide-border border-y border-border text-sm" data-testid="mk-math">
          {MEDIA_KIT_EXAMPLES.map((e) => (
            <div key={e.spend} className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[9rem_1fr_auto]">
              <span className="font-semibold">You prepay {usdK(e.spend)} USD</span>
              <span className="text-right text-foreground/80 sm:text-left"><strong>{usd(e.credit)} USD</strong> media credit</span>
              <span className="col-span-2 text-muted-foreground sm:col-span-1 sm:text-right">
                <EstimateTag /> at ${MEDIA_KIT_CPM.lo}–{MEDIA_KIT_CPM.hi} CPM ≈ {impr(e.imprLo)}–{impr(e.imprHi)} impressions
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          All prices in USD. Effective {cpm} and every impression figure above are modelled estimates, not a guarantee. Impressions = credit ÷ CPM × 1,000. Final rate, currency and term are set on your IO. Premium is inquire-only.
        </p>
        <p className="mt-2 text-xs font-semibold text-foreground/70" data-testid="mk-modelled-footer">{MODELLED_FOOTER}</p>
      </Block>

      {/* Sample report layout (buyer comfort, Nov 17 2026) */}
      <Block id="sample-report" eyebrow={SAMPLE_REPORT.kicker} title={SAMPLE_REPORT.title} tone="soft">
        <SampleReport />
        <MeasuredReport />
        <YourCardHere />
      </Block>

      {/* Categories */}
      <Block id="categories" eyebrow="The network" title="A growing network of private hubs." tone="soft">
        <AvailabilityStrip />
        <p className="mt-4 text-sm text-foreground/80">Your reserve buys a share of display space across the network. We curate placements as each hub launches, and your insertion order names where you show before anything runs. Want exclusivity, a premium slot, or something custom? Ask below.</p>
        <div id="request" className="mt-8 scroll-mt-20 max-w-2xl">
          <CategoryRequestForm path="/media-kit" />
        </div>
      </Block>

      {/* Five questions buyers ask (buyer comfort, Nov 17 2026) */}
      <section id="doors" className="scroll-mt-20 border-b border-border/70 bg-foreground text-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14">
          <DoorRoute requestHref="#request" testId="mk-doors" />
        </div>
      </section>

      <Block id="buyer-faq" eyebrow="Questions" title={BUYER_FAQ_TITLE}>
        <BuyerFaq />
      </Block>

      {/* Agency + rules */}
      <Block id="agencies" eyebrow="For agencies" title={`Place a client, earn ${AGENCY_CASH_PCT}% in cash`}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-foreground/20 bg-white p-5" data-testid="mk-agency">
            <p className="text-sm text-foreground/80">Bring a brand into the network. The agency of record earns {AGENCY_CASH_PCT}% of media spend, paid in cash per the IO.</p>
            <p className="mt-3 text-sm" data-currency-fixed>
              <span className="text-muted-foreground">Example, in USD:</span> a ${MEDIA_KIT_OFFERS.seat.spendUsd} USD reserve pays you <strong>{usd(agencySeat)} USD</strong>; a {usdK(prem.spendLo)} USD premium slot pays you <strong>{usd(agencyPrem)} USD</strong> in cash.
            </p>
          </div>
          <div data-testid="mk-rules">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">The plain rules</p>
            <ul className="mt-3 space-y-2 text-sm">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-foreground/70" aria-hidden />{r}</li>
              ))}
            </ul>
            <SampleIoLink className="mt-3" />
            <p className="mt-3 text-sm" data-testid="mk-media-buyers-link">
              Already running display or paid social? <a className="underline underline-offset-2" href="/media-buyers">How Birch fits your mix</a>.
            </p>
          </div>
        </div>
      </Block>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20 bg-foreground text-background">
        <div className="container mx-auto max-w-5xl px-5 py-10 md:px-6 md:py-14" data-testid="mk-contact">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-background/60">Talk to the founder</p>
          <h2 className="mt-2 font-display text-[1.75rem] leading-tight md:text-4xl">Randy Gilling, Founder</h2>
          <div className="mt-4 flex flex-col gap-2 text-base">
            <a className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline" href="mailto:sales@silverbirchgrowth.com?subject=Birch%20Reserve%20media%20kit" data-testid="mk-email">
              <Mail className="size-4" aria-hidden /> sales@silverbirchgrowth.com
            </a>
            <p className="text-sm text-background/75">{SALES_REPLY_LINE}</p>
            <a className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline" href="tel:+16479316278" data-testid="mk-phone">
              <Phone className="size-4" aria-hidden /> (647) 931-6278
            </a>
          </div>
          <div className="mt-6 max-w-xl text-foreground">
            <FounderNote />
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href={RESERVE_HREF} variant="lime" testId="mk-reserve-foot" className="w-full sm:w-auto">Reserve your space — {price.seat}</Cta>
            <Cta href="#premium" variant="lineDark" testId="mk-premium-foot" className="w-full sm:w-auto">Inquire about premium, from $25K</Cta>
          </div>
          <p className="mt-8 border-t border-background/20 pt-4 text-xs text-background/65" data-testid="mk-footnote">
            Estimates are modelled; terms on IO. Volumes come from partner-provided data and stated assumptions, not audited delivery.
          </p>
        </div>
      </section>
    </div>
  );
}
