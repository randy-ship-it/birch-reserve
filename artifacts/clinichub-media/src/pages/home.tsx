import { RANDY_TEL_DISPLAY, RANDY_TEL_HREF, TAP_TO_CALL_HREF, TAP_TO_CALL_LABEL } from "@/lib/randy-chat-knowledge";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  ClipboardCheck,
  MonitorUp,
  Lock,
  MapPin,
  Phone,
  ReceiptText,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { SplashAdReservationDialog } from "@/components/splash-ad-reservation-dialog";
import {
  DEFAULT_RESERVE_OFFER_KEY,
  formatReserveAmount,
  RESERVE_OFFERS,
  type ReserveOfferKey,
} from "@/lib/reserve-offers";
import { trackCta, trackReserveDialogOpen, type CtaEvent } from "@/lib/track-cta";
import { BOOK_CALL_LABEL, BOOK_CALL_MAILTO_HREF, openRandyChat } from "@/lib/book-call";
import { fetchCheckoutEnabled } from "@/lib/checkout-status";
import { HubWalkthroughVideo } from "@/components/hub-walkthrough-video";
import { ExampleHubsGallery } from "@/components/example-hubs-gallery";
import { CobrandedHubsBanner } from "@/components/cobranded-hubs-banner";
import { WEPRIZE } from "@/lib/example-exclusive-properties";
import { NotifyMe, ReserveListCalculator, ReserveListLinks, useTamFeed } from "@/components/reserve-list-kit";
import { OrdersInfo } from "@/components/orders-info";
import {
  PostCheckoutMockup,
  ProtocolMockup,
  BookingMockup,
  HubMockup,
} from "@/components/ad-previews";

const NETWORK_SIGNALS = [
  "Prepared Meals", "Mobility", "Sleep", "Recovery", "Nutrition", "Skin",
  "Virtual Care", "Wellness Services", "Fitness", "Diagnostics", "Family Health",
  "Healthy Aging"
];

const INVENTORY_FORMATS = [
  {
    id: "post-checkout",
    tag: "Post-Checkout",
    title: "Confirmation Placement",
    desc: "A sponsored unit presented after a completed digital transaction, before the session closes.",
    Preview: PostCheckoutMockup,
    bg: "bg-background"
  },
  {
    id: "recovery-plan",
    tag: "Recovery Plan",
    title: "Plan Placement",
    desc: "A sponsored product or service message within a digital recovery or wellness plan.",
    Preview: ProtocolMockup,
    bg: "bg-secondary/10"
  },
  {
    id: "scheduled-service",
    tag: "Scheduled Service",
    title: "Booking Confirmation",
    desc: "A sponsored unit presented after a wellness, fitness, or recovery service is scheduled.",
    Preview: BookingMockup,
    bg: "bg-secondary/10"
  },
  {
    id: "member-hub",
    tag: "Member Hub",
    title: "Native Hub Module",
    desc: "A sponsored module inside an approved member, customer, or wellness dashboard.",
    Preview: HubMockup,
    bg: "bg-background"
  }
];

const CATEGORY_SEATS = [
  "Pain relief / topicals",
  "Recovery hardware",
  "Nutrition",
  "Sleep",
  "Meal prep",
  "Women’s health",
  "Men’s health",
  "Diagnostics / services",
];

const RESERVE_LIST_HREF = "/inventory";

const RESERVE_LIST_PREVIEW = [
  "Sports Nutrition & Supplements",
  "Pain Relief & Topicals",
  "Recovery Devices & Equipment",
  "Digital Health & Telehealth",
  "Wearables & Fitness Tech",
  "Align Network",
];


const SUPPLIER_ADJACENCY = [
  "DR-HO recovery equipment",
  "Kalaya topical pain relief",
  "Magnum Supps",
  "Fresh Prep",
  "LyfeFuel",
  "RenPho",
  "Manduka",
  "Flora Health",
  "Resolve Sleep",
  "360 Athletics",
  "Medistick",
  "Viome",
];

export default function Home() {
  const { feed: tamFeed, labels: tl } = useTamFeed();
  const [splashDialogOpen, setSplashDialogOpen] = useState(false);
  // 390px: hide the sticky bar, chat avatar and call button while the final CTA is on screen.
  const finalCtaRef = useRef<HTMLElement | null>(null);
  const [finalCtaInView, setFinalCtaInView] = useState(false);
  useEffect(() => {
    const node = finalCtaRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setFinalCtaInView(Boolean(entry?.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    if (finalCtaInView) root.setAttribute("data-final-cta-in-view", "true");
    else root.removeAttribute("data-final-cta-in-view");
    return () => root.removeAttribute("data-final-cta-in-view");
  }, [finalCtaInView]);
  const [selectedFormat, setSelectedFormat] = useState<string>();
  const [selectedOffer, setSelectedOffer] = useState<ReserveOfferKey>(
    DEFAULT_RESERVE_OFFER_KEY,
  );
  const [availability, setAvailability] = useState<{
    seats_open: number;
    seats_held: number;
    seats_paid: number;
    seats_total: number;
  } | null>(null);
  const reservePriceLabel = "$490 USD";

  useEffect(() => {
    let cancelled = false;
    const apply = (data: unknown) => {
      if (
        !cancelled &&
        data &&
        typeof data === "object" &&
        typeof (data as { seats_open?: unknown }).seats_open === "number"
      ) {
        setAvailability(data as {
          seats_open: number;
          seats_held: number;
          seats_paid: number;
          seats_total: number;
        });
        return true;
      }
      return false;
    };
    fetch("/v1/availability.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (apply(data)) return;
        return fetch("/availability.json")
          .then((response) => (response.ok ? response.json() : null))
          .then((fallback) => {
            apply(fallback);
          });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);


  const openReserveDialog = (
    format?: string,
    offer: ReserveOfferKey = DEFAULT_RESERVE_OFFER_KEY,
    event?: CtaEvent,
  ) => {
    trackReserveDialogOpen(format, offer, event);
    // Checkout paused (runtime server flag): open Randy's callback intake with the
    // seat + category preselected instead of a dead checkout. Re-enabled: normal dialog.
    void fetchCheckoutEnabled().then((enabled) => {
      if (!enabled) {
        openRandyChat({ reason: "reserve-intake", sku: offer === "hold-190" ? "hold-190" : "reserve-490", category: format });
        return;
      }
      setSelectedFormat(format);
      setSelectedOffer(offer);
      setSplashDialogOpen(true);
    });
  };

  useEffect(() => {
    void fetchCheckoutEnabled();
  }, []);

  const VOICE_TEL_HREF = RANDY_TEL_HREF;
  const VOICE_TEL_DISPLAY = RANDY_TEL_DISPLAY;

  const callBack = () => {
    trackCta("cta_book_call");
    window.location.href = VOICE_TEL_HREF;
  };


  const handleDialogChange = (open: boolean) => {
    setSplashDialogOpen(open);
    if (!open) {
      setSelectedFormat(undefined);
    }
  };



  const scrollToPlacements = () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("placements")?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth"
    });
  };

  return (
    <div className="w-full bg-background min-h-[100dvh] text-foreground overflow-x-hidden">
      <SplashAdReservationDialog
        open={splashDialogOpen}
        onOpenChange={handleDialogChange}
        selectedFormat={selectedFormat}
        defaultOffer={selectedOffer}
      />


      {!splashDialogOpen && !finalCtaInView && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 p-3 backdrop-blur-md md:hidden"
          data-testid="mobile-sticky-reserve-cta"
        >
          <a
            href={TAP_TO_CALL_HREF}
            className="mb-2 flex h-11 w-full items-center justify-center border border-foreground/15 font-medium text-foreground"
            data-testid="link-mobile-tap-to-call"
            onClick={() => trackCta("cta_book_call")}
          >
            <Phone className="mr-2 size-4" aria-hidden />
            {TAP_TO_CALL_LABEL}
          </a>
          <a
            href={RESERVE_LIST_HREF}
            className="flex h-12 w-full items-center justify-center bg-accent font-semibold text-accent-foreground transition-colors hover:bg-foreground hover:text-background"
            data-testid="link-mobile-reserve-list"
          >
            See the Reserve List <ArrowRight className="ml-2 size-4" />
          </a>
        </div>
      )}

      {/* Reserve List */}
      <section
        id="reserve-list"
        aria-labelledby="reserve-list-title"
        className="relative overflow-hidden border-b border-background/15 bg-foreground text-background"
        data-testid="reserve-list-hero"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_480px_at_12%_-10%,hsl(var(--accent)/0.16),transparent_60%),radial-gradient(700px_420px_at_100%_110%,hsl(var(--accent)/0.08),transparent_60%)]"
        />
        <div className="container relative z-10 mx-auto grid items-center gap-10 px-6 pb-12 pt-8 md:pb-16 md:pt-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:pb-16 lg:pt-12">
          <div className="flex flex-col text-left">
            <p className="mb-5 inline-flex w-max max-w-full items-center gap-2 border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-accent" />
              </span>
              The Reserve List · Canada
            </p>
            <h1
              id="reserve-list-title"
              className="font-display text-[2.75rem] leading-[0.95] tracking-tight text-background md:text-6xl lg:text-7xl"
            >
              The Reserve List.
              <span className="mt-3 block text-2xl italic leading-[1.08] text-background/75 md:text-4xl lg:text-[2.6rem]">
                High-value Canadian demand, by category.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-background/75 md:text-lg">
              Customer flow and digital real estate across Scale Health partner brands and the Align Network of 80+ health and wellness businesses. Lock in your slot before the minimum goes up.
            </p>
            <div className="mt-6">
              <NotifyMe source="br-home" />
            </div>
            <dl
              className="mt-6 grid max-w-2xl grid-cols-2 gap-px border border-background/15 bg-background/15 md:grid-cols-[1fr_1fr_1.35fr]"
              data-testid="reserve-list-stats"
            >
              <div className="flex flex-col bg-foreground p-4 md:p-5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-background/55">Today</dt>
                <dd className="mt-2 font-display text-4xl leading-none text-accent md:text-5xl">{tl.live_orders}</dd>
                <dd className="mt-2 text-xs leading-snug text-background/70">Orders<OrdersInfo tone="dark" /> a year in audience</dd>
              </div>
              <div className="flex flex-col bg-foreground p-4 md:p-5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-background/55">In the queue<span className="ml-2 inline-block border border-background/30 px-1.5 align-middle font-sans text-[9px] font-bold leading-4 tracking-normal text-background/70">est.</span></dt>
                <dd className="mt-2 font-display text-4xl leading-none text-accent md:text-5xl">{tl.queue_orders}</dd>
                <dd className="mt-2 text-xs leading-snug text-background/70">Orders a year in the queue</dd>
              </div>
              <div className="col-span-2 flex flex-col bg-accent p-4 text-accent-foreground md:col-span-1 md:p-5" data-testid="reserve-list-stat-2027">
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-foreground/70">2027 projection<span className="ml-2 inline-block border border-accent-foreground/40 px-1.5 align-middle font-sans text-[9px] font-bold leading-4 tracking-normal text-accent-foreground/80">est.</span></dt>
                <dd className="mt-2 font-display text-6xl leading-none md:text-[4.25rem]">{tl.y2027_orders}</dd>
                <dd className="mt-2 text-xs font-semibold leading-snug text-accent-foreground/85">Orders a year (2027 projection)</dd>
              </div>
            </dl>
            <p className="mt-3 max-w-2xl text-sm text-background/80">
              <span className="font-display text-xl text-accent">{tl.live_views}</span> monthly views today (est.) · {tl.live_queue_views} with the queue live · {tl.y2027_views} in 2027 <span className="text-background/55">(est.)</span>
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-background/60">
              {tl.live_orders} orders a year and {tl.live_views} monthly views (est.) are network demand-pool figures for Canada; {tl.mapped_orders} orders are mapped to partner categories on the list. Queue and 2027 figures are estimates and projections.
            </p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href={RESERVE_LIST_HREF}
                className="group inline-flex h-16 w-full items-center justify-center gap-3 bg-accent px-9 text-lg font-semibold text-accent-foreground shadow-[0_0_0_6px_hsl(var(--accent)/0.18)] transition-colors hover:bg-background hover:text-foreground sm:w-auto"
                data-testid="button-reserve-list-hero"
              >
                See the Reserve List
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
              </a>
              <a
                href={RESERVE_LIST_HREF}
                className="text-center text-sm text-background/70 underline underline-offset-4 hover:text-accent sm:text-left"
                data-testid="link-reserve-list-code"
              >
                Have an insider code? Unlock it
              </a>
            </div>
            <div className="mt-5">
              <ReserveListLinks />
            </div>
            <p className="mt-6 max-w-xl border-l-2 border-accent pl-4 text-sm leading-relaxed text-background/80" data-testid="text-early-slots">
              <strong className="font-semibold text-background">Early slots are open.</strong>{" "}
              Lock in your slot before the minimum goes up.
            </p>
            <p className="mt-3 text-xs text-background/50">
              Canada only for now. The full breakdown by category is inside the list.
            </p>
          </div>
          <a
            href={RESERVE_LIST_HREF}
            aria-label="See the Reserve List"
            className="group block w-full max-w-md justify-self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:justify-self-end"
            data-testid="reserve-list-preview"
          >
            <div className="border border-background/20 bg-background/[0.04] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] transition-colors group-hover:border-accent/60">
              <div className="flex items-center justify-between border-b border-background/15 px-5 py-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/60">Reserve List · Preview</span>
                <span className="inline-flex items-center gap-1.5 border border-background/20 px-2 py-1 text-[10px] uppercase tracking-widest text-background/70">
                  <Lock className="size-3" aria-hidden /> Insider code
                </span>
              </div>
              <ul className="divide-y divide-background/10">
                {RESERVE_LIST_PREVIEW.map((category) => (
                  <li key={category} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-background">{category}</span>
                      <span className="mt-0.5 block select-none text-xs text-background/50 blur-[5px]" aria-hidden>
                        #.#M orders · ##.#M views
                      </span>
                    </span>
                    <span className="shrink-0 border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                      Early slots open
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-background/15 px-5 py-4 text-sm">
                <span className="text-background/60">12+ categories · brand names private</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-accent">
                  Unlock <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* Open-Seats Banner */}
      <div className="bg-accent text-accent-foreground py-3 px-6 text-center text-[11px] md:text-xs font-bold uppercase tracking-widest flex justify-center items-center gap-3 border-b border-foreground/10" data-testid="text-launch-status">
          <span>Reservations are open. Campaigns start when the insertion order names the hub.</span>
      </div>

      {/* Hero Section */}
      <section id="reserve-list-calculator" className="scroll-mt-20 border-b border-border bg-secondary/10 py-12 md:py-16" data-testid="reserve-list-calculator-section">
        <div className="container mx-auto px-6">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-accent">The Reserve List · calculator</p>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">What could your brand capture?</h2>
          <p className="mb-6 mt-2 text-base text-muted-foreground">Three inputs, one estimate. Same live numbers as the Reserve List and scalehealth.ca/tam.</p>
          <ReserveListCalculator feed={tamFeed} />
        </div>
      </section>

      <section className="relative flex items-center py-16 md:py-20 border-b border-background/20 bg-foreground text-background" data-testid="placements-hero">
        <div className="container mx-auto px-6 relative z-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">

          <div className="flex flex-col text-left">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-6 inline-flex items-center gap-2 border border-background/20 px-3 py-1.5 text-[10px] text-background/80 uppercase tracking-widest bg-background/5 w-max font-bold"
            >
              Private media + activation network
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-5xl lg:text-6xl font-display text-background leading-[0.98] tracking-tight mb-6"
            >
              Placements inside signed Scale Health hubs.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-base md:text-lg text-background/70 max-w-xl mb-10 leading-relaxed"
            >
              Your offer sits after checkout, on a plan, or at a booking — not in a stranger’s feed.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-4 w-full max-w-lg"
            >
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
                onClick={() => openReserveDialog(undefined, "reserve-490", "cta_hero_reserve")}
                data-testid="button-hero-reserve"
              >
                Reserve a placement — {reservePriceLabel}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
                onClick={callBack}
                data-testid="button-hero-call-back"
              >
                <Phone className="mr-2 size-4" aria-hidden />
                Get a call back
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
              >
                <a
                  href={TAP_TO_CALL_HREF}
                  data-testid="link-hero-tap-to-call"
                  onClick={() => trackCta("cta_book_call")}
                >
                  <Phone className="mr-2 size-4" aria-hidden />
                  {TAP_TO_CALL_LABEL}
                </a>
              </Button>
            </motion.div>
            <p className="mt-3 text-sm text-background/80">
              <a className="underline underline-offset-4" href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer" data-testid="link-hero-live-hub">See a live hub</a>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <a
                href={RESERVE_LIST_HREF}
                className="w-max text-left text-sm text-background/80 underline underline-offset-4 hover:text-accent"
                data-testid="link-placements-reserve-list"
              >
                See the Reserve List
              </a>
              <a
                href="/kit"
                className="group inline-flex items-center gap-1.5 rounded-full border border-background/25 px-3.5 py-1.5 text-sm text-background/85 transition-colors hover:border-accent hover:text-accent"
                data-testid="link-hero-media-kit"
              >
                See the media kit
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
            </div>
            <p className="mt-4 max-w-xl text-sm text-background/70">
              Early slots are open across 8 advertiser categories. Lock in your slot before the minimum goes up.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-sm mx-auto lg:ml-auto lg:mr-0"
          >
            <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-background/50">
              <span>Illustrative — not your receipt</span>
              <span>Post-checkout</span>
            </div>
            <button
              type="button"
              onClick={() => openReserveDialog("Confirmation Placement")}
              aria-label="Secure the Confirmation Placement advertising format"
              data-testid="button-hero-placement-preview"
              className="group w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative border border-background/20 bg-background/5 overflow-hidden">
                <PostCheckoutMockup />
                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors" />
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-background transition-colors group-hover:text-accent">
                Reserve this placement <ArrowRight className="size-3.5" />
              </span>
              <span className="mt-3 block text-[10px] leading-relaxed text-background/50">
                Illustrative unit. Your creative is placed beside live catalog products on a signed hub. Nothing runs until an insertion order names the surface.
              </span>
            </button>
          </motion.div>

        </div>
      </section>

      <section
        aria-label="Three steps before a unit runs"
        className="border-b border-border bg-background"
        data-testid="three-steps"
      >
        <div className="container mx-auto px-6 py-8 md:py-10">
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
            Nothing runs before step 2
          </p>
          <ol className="grid border border-border md:grid-cols-3">
            {(
              [
                ["1", "Lock in your slot on the Reserve List before the minimum goes up. Paid reserves are 100% media credit."],
                ["2", "Insertion order names the hub."],
                ["3", "Unit sits after checkout, on a plan, or at a booking."],
              ] as const
            ).map(([step, copy], index) => (
              <li
                key={step}
                className={`bg-background p-5 md:p-6 ${
                  index > 0 ? "border-t border-border md:border-l md:border-t-0" : ""
                }`}
              >
                <p className="font-display text-2xl text-accent">{step}</p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* One funnel, two buying paths */}
      <section id="reserve-offers" className="border-b border-border bg-background py-10 md:py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                Reserve before campaigns open
              </p>
              <h2 className="font-display text-3xl text-foreground">
                Early slots across 8 advertiser categories.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Every dollar is a 100% media credit. Delivery starts when the insertion order names the hub. Hubs are the rooms. Lock in your slot before the minimum goes up.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[620px]">
              <Button
                size="lg"
                variant="outline"
                className="h-auto min-h-20 rounded-none border-border px-5 py-4 text-left hover:border-accent hover:bg-accent/10"
                onClick={() => openReserveDialog("Auto-buy")}
                data-testid="button-auto-buy-reserve"
              >
                <Zap className="mr-3 size-4 shrink-0" />
                <span><strong className="block">Direct reserve</strong><span className="text-xs font-normal text-muted-foreground">For brands already buying media</span></span>
              </Button>
              <Button
                size="lg"
                className="h-auto min-h-20 rounded-none bg-foreground px-5 py-4 text-left text-background hover:bg-accent hover:text-accent-foreground"
                onClick={() => openReserveDialog("Private distribution")}
                data-testid="button-private-distribution-reserve"
              >
                <ShieldCheck className="mr-3 size-4 shrink-0" />
                <span><strong className="block">Managed distribution</strong><span className="text-xs font-normal opacity-70">For a guided launch</span></span>
              </Button>
            </div>
          </div>
          <div className="mt-12 grid border border-border md:grid-cols-2">
            <article
              className="flex flex-col bg-foreground p-6 text-background md:p-8"
              data-testid="card-reserve-list"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                The Reserve List
              </p>
              <p className="mt-4 font-display text-4xl text-accent">Early slots open</p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-background/75">
                See 8.7M orders a year in audience and 56M monthly views (est.), broken out by category, plus an est. 20M+ more orders in the queue and 100M+ orders a year (2027 projection). Log the placements you want and claim an early slot. No commitment. Canada only for now.
              </p>
              <p className="mt-5 border-t border-background/15 pt-4 text-xs text-background/60">
                Use an insider code, or request one on the list.
              </p>
              <a
                href={RESERVE_LIST_HREF}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 bg-accent px-5 font-semibold text-accent-foreground transition-colors hover:bg-background hover:text-foreground"
                data-testid="button-offers-reserve-list"
              >
                See the Reserve List <ArrowRight className="size-4" aria-hidden />
              </a>
            </article>
            {RESERVE_OFFERS.filter((offer) => offer.key !== "hold-190").map((offer) => (
              <article
                key={offer.key}
                className="flex flex-col border-t border-border p-6 md:border-l md:border-t-0 md:p-8"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">
                  {offer.name}
                </p>
                <p className="mt-4 font-display text-4xl text-accent">
                  {formatReserveAmount(offer.amountCents)}
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {offer.description}
                </p>
                <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                  {offer.creditLine}
                </p>
                <Button
                  type="button"
                  onClick={() => openReserveDialog(undefined, offer.key)}
                  className="mt-6 h-11 rounded-none border border-accent bg-transparent text-accent hover:bg-accent hover:text-foreground"
                >
                  Select {offer.name}
                </Button>
              </article>
            ))}
          </div>

          <article className="mt-6 border border-border p-6 md:p-8" data-testid="card-enterprise">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">Enterprise</p>
            <p className="mt-4 font-display text-3xl text-foreground md:text-4xl">
              $100K–$250K+ · Coming soon / Inquire within
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Multi-hub or on-prem Align. Credit, not a flight. Not a self-serve Stripe SKU — inquire within.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                className="h-11 rounded-none bg-accent text-accent-foreground hover:bg-foreground hover:text-background"
                onClick={() => {
                  trackCta("cta_book_call");
                  openRandyChat({ reason: "book-a-call" });
                }}
                data-testid="button-enterprise-book-call"
              >
                {BOOK_CALL_LABEL}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-none"
                onClick={callBack}
                data-testid="button-enterprise-call-back"
              >
                <Phone className="mr-2 size-4" aria-hidden />
                Call {VOICE_TEL_DISPLAY}
              </Button>
              <a
                href={BOOK_CALL_MAILTO_HREF}
                className="text-sm underline underline-offset-4"
                data-testid="link-enterprise-email-sales"
              >
                Email sales
              </a>
            </div>
          </article>
          <div className="mt-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/60">
              Eight advertiser categories
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {availability
                ? `Early slots open in ${availability.seats_open} of ${availability.seats_total} categories`
                : "Early-slot availability loads live."}
            </p>
            <div className="mt-4 grid border border-border sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORY_SEATS.map((category) => (
                <div key={category} className="border-b border-r border-border px-4 py-4 text-sm">
                  {category}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              onClick={() => {
                void fetchCheckoutEnabled().then((enabled) => {
                  if (!enabled) {
                    openReserveDialog(undefined, "reserve-490");
                    return;
                  }
                  trackCta("buycalc_open", { offer: "reserve-490" });
                  window.location.href = "/buycalc?sku=reserve-490";
                });
              }}
              variant="outline"
              className="h-12 rounded-none px-6"
            >
              Reserve a placement — $490
            </Button>
            <Button
              asChild
              className="h-12 rounded-none bg-accent px-6 text-accent-foreground hover:bg-foreground hover:text-background"
            >
              <a href={RESERVE_LIST_HREF} data-testid="link-seats-reserve-list">
                See the Reserve List <ArrowRight className="ml-2 size-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Digital + physical inventory */}
      <section className="border-b border-border bg-secondary/10 py-16 md:py-20">
        <div className="container mx-auto px-6">
          <div className="mb-10 max-w-3xl">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
              Inventory made concrete
            </p>
            <h2 className="font-display text-4xl tracking-tight text-foreground md:text-5xl">
              Where it also runs — on request.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <article className="border border-border bg-background p-7 md:p-9">
              <MonitorUp className="mb-7 size-6 text-foreground" />
              <h3 className="mb-3 font-display text-3xl text-foreground">Digital inventory</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sponsored placements, offers, content and category visibility inside closed customer and partner hubs.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground/80" data-testid="home-also-exclusive-weprize">
                Also on request: display example at{" "}
                <a
                  href={WEPRIZE.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {WEPRIZE.name}
                </a>
                {" "}
                — placement example only; not a Scale hub category.
              </p>
            </article>
            <article className="border border-border bg-foreground p-7 text-background md:p-9">
              <MapPin className="mb-7 size-6 text-accent" />
              <h3 className="mb-3 font-display text-3xl">On-prem, on request</h3>
              <p className="text-sm leading-relaxed text-background/70 mb-4">
                On-prem surfaces in Align's network of health and wellness businesses and in Scale hubs are a separate insertion-order line. They are not sold as digital reach.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={VOICE_TEL_HREF}
                  onClick={() => trackCta("cta_book_call")}
                  className="inline-flex items-center gap-1.5 border border-accent/40 px-3 py-1 text-[10px] uppercase tracking-widest text-accent bg-background/5"
                  data-testid="link-onprem-call"
                >
                  <Phone className="size-3" aria-hidden />
                  Call {VOICE_TEL_DISPLAY}
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Customer Profile: Who you actually reach */}
      <section id="customer-profile" className="py-24 md:py-32 border-b border-background/20 bg-foreground text-background scroll-mt-20">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-16">
            <div className="lg:col-span-5 flex flex-col">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/50 mb-6">Media Kit Profile</div>
              <h2 className="text-4xl md:text-6xl font-display tracking-tight text-background mb-8">
                Who you actually reach.
              </h2>
              <div className="mb-12 text-background/80 text-base leading-relaxed">
                <h3 className="text-background mb-5 font-display text-2xl">
                  Why this customer is worth more
                </h3>
                <ul className="space-y-4">
                  <li className="border-l border-accent pl-4">Already paid once.</li>
                  <li className="border-l border-accent pl-4">Already in-protocol, so the next buy is the recovery stack: sleep, mobility, nutrition, recovery.</li>
                  <li className="border-l border-accent pl-4">Reserve a slot at today's minimum, before it goes up. You are not bidding against 40 supplement brands.</li>
                  <li className="border-l border-accent pl-4">No brand gets more than 20% of a category's digital real estate.</li>
                </ul>
              </div>

              <div className="border-t border-background/20 pt-6 mt-auto">
                <p className="text-[10px] uppercase tracking-wider text-background/55 leading-relaxed max-w-md">
                  We do not publish first-party lifetime-value dollars yet. The profile is from live placement context, not a survey panel.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
              <div className="border border-background/20 bg-background/5 p-8 flex flex-col">
                <div className="text-accent mb-6"><ReceiptText className="size-6" /></div>
                <h3 className="text-xl font-display mb-3 text-background">Just checked out</h3>
                <p className="text-sm text-background/70 leading-relaxed">
                  They finished an order with a recovery brand. Your offer sits on the receipt, not in a stranger's feed.
                </p>
              </div>
              <div className="border border-background/20 bg-background/5 p-8 flex flex-col">
                <div className="text-accent mb-6"><ClipboardCheck className="size-6" /></div>
                <h3 className="text-xl font-display mb-3 text-background">On a plan</h3>
                <p className="text-sm text-background/70 leading-relaxed">
                  They are in an active mobility or recovery protocol. Your brand appears as a native module inside the plan.
                </p>
              </div>
              <div className="border border-background/20 bg-background/5 p-8 flex flex-col sm:col-span-2">
                <div className="text-accent mb-6"><CalendarCheck2 className="size-6" /></div>
                <h3 className="text-xl font-display mb-3 text-background">Booked a session</h3>
                <p className="text-sm text-background/70 leading-relaxed max-w-xl">
                  They scheduled care. Place a complementary product at confirmation, not behind a cold click.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Same dollar. Different customer. */}
      <section className="border-b border-border bg-background py-24 md:py-32">
        <div className="container mx-auto px-6">
          <h2 className="text-5xl md:text-7xl font-display tracking-tight text-foreground mb-20 max-w-4xl">
            Same dollar.<br />Different customer.
          </h2>

          <div className="grid lg:grid-cols-2 gap-16 lg:gap-32">
            <div>
              <div className="border-t border-muted-foreground pb-6 w-16 mb-6"></div>
              <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Normal channels (Meta / Google / programmatic)
              </p>
              <p className="text-2xl md:text-3xl lg:text-4xl text-muted-foreground leading-snug font-display">
                Buy reach one impression at a time; compete in an open auction; interrupt a stranger; hope the feed found the right moment. <span className="text-foreground italic">You bought attention, not context.</span>
              </p>
            </div>

            <div>
              <div className="border-t border-accent pb-6 w-16 mb-6"></div>
              <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                Birch Reserve
              </p>
              <p className="text-2xl md:text-3xl lg:text-4xl text-foreground leading-snug font-display">
                Add digital and physical inventory beside your existing channels, reaching customers inside closed brand environments and participating health and wellness locations.
              </p>
              <p className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-md">
                <strong className="text-foreground font-medium">For auto-buyers:</strong> no insertion-order theatre or 12-week RFP.<br/>
                <strong className="text-foreground font-medium">For distribution buyers:</strong> lock in a Reserve List slot at today's minimum.
              </p>
              <div className="mt-8">
                <span className="bg-foreground text-accent px-4 py-2 inline-block font-medium tracking-wide rounded-sm text-sm">Reserve payments act as 100% media credit and lock in your slot at today's minimum.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demand Context */}
      <section className="border-b border-border bg-secondary/20 py-8 md:py-10">
        <div className="container mx-auto px-6">
          <div className="grid gap-5 lg:grid-cols-[190px_1fr] lg:items-center lg:gap-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground">Demand context</p>
              <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                Categories that fit recovery and wellness contexts.
              </p>
            </div>
            <div className="grid grid-cols-2 overflow-hidden border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
              {NETWORK_SIGNALS.map((signal) => (
                <div
                  key={signal}
                  className="border-b border-r border-border bg-background px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground last:border-b-0 sm:px-4"
                >
                  {signal}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Product adjacency */}
      <section className="border-b border-border bg-foreground py-20 text-background md:py-24">
        <div className="container mx-auto px-6">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            The shelf around your brand
          </p>
          <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <h2 className="max-w-4xl font-display text-4xl leading-tight tracking-tight md:text-6xl">
                Your ad runs next to products people already buy—not random inventory.
              </h2>
              <p className="mt-7 max-w-3xl text-base leading-relaxed text-background/75 md:text-lg">
                Scale Health hubs sell and recommend a private supplier catalog. Birch placements sit in that same shelf: recovery equipment, topicals, nutrition, sleep, and meal prep. You are not dropped next to unknown brands.
              </p>
            </div>
            <a
              href="https://scalehealth.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-background lg:justify-self-end"
            >
              See the brand network <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="mt-12 grid border-l border-t border-background/20 sm:grid-cols-2 lg:grid-cols-4">
            {SUPPLIER_ADJACENCY.map((name) => (
              <div
                key={name}
                className="border-b border-r border-background/20 px-5 py-4 text-sm text-background/85"
              >
                {name}
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-4xl text-xs leading-relaxed text-background/55">
            These are products and hubs on the Scale Health layer. Birch buys the display unit beside them. This is not a sold impression count.
          </p>
        </div>
      </section>

      {/* Showcase Hubs */}
      <section className="py-20 md:py-28 border-b border-border bg-background relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-secondary/10 pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="mb-12 mx-auto max-w-3xl text-center">
            <h3 className="text-3xl md:text-5xl font-display tracking-tight text-foreground mb-4">Co-branded hubs. Real customer environments.</h3>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Birch inventory is contracted inside approved Scale Health brand environments. Launch timing varies by hub.
            </p>
          </div>
          <div className="mb-8 border border-border bg-secondary/5 p-5 text-center md:p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">LIVE on DR-HO&apos;s</p>
            <p className="mt-2 text-sm font-medium">
              <a className="underline underline-offset-4 hover:text-accent" href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer">Tour the DR-HO hub</a>
              <span className="text-muted-foreground"> · On-prem clinic and studio surfaces are a separate insertion order.</span>
            </p>
            <p className="mt-3 text-sm">
              <a
                href="/insights/the-shelf-after-the-receipt"
                className="underline underline-offset-4 hover:text-accent"
                data-testid="link-shelf-after-receipt"
              >
                The shelf after the receipt
              </a>
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            <div className="border border-border bg-background flex flex-col">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span></span>
                  Live customer hub
                </p>
                <h4 className="font-display text-2xl text-foreground">DR-HO'S Insider Hub</h4>
              </div>
              <div className="p-6 md:p-8 bg-background flex-1">
                <div className="border border-border/50 shadow-sm overflow-hidden aspect-[4/3] bg-muted relative">
                  <HubWalkthroughVideo testId="video-hub-walkthrough" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Live DR-HO&apos;S hub walkthrough — illustrative of early-slot placement context.</p>
                <a href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                  Open the live hub <ArrowUpRight className="size-4" />
                </a>
              </div>
            </div>

            <div className="border border-border bg-background flex flex-col">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span></span>
                  Launching
                </p>
                <h4 className="font-display text-2xl text-foreground">Kalaya Booking Hub</h4>
              </div>
              <div className="p-6 md:p-8 bg-background flex-1">
                <div className="border border-border/50 shadow-sm overflow-hidden aspect-[4/3] bg-muted relative">
                  <img src="/hub-proof/kalaya-booking-card.png" alt="Kalaya Booking Hub screenshot" className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Co-branded Scale Health hub. Display inventory is contracted. Launch timing varies.</p>
              </div>
            </div>

            <div className="border border-border bg-background flex flex-col">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 flex items-center gap-2">
                  Launching
                </p>
                <h4 className="font-display text-2xl text-foreground">ROLL Marketplace</h4>
              </div>
              <div className="p-6 md:p-8 bg-background flex-1">
                <div className="border border-border/50 shadow-sm overflow-hidden aspect-[4/3] bg-muted relative">
                  <img src="/hub-proof/roll-marketplace-grid.png" alt="ROLL Marketplace screenshot" className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Co-branded Scale Health hub. Display inventory is contracted. Launch timing varies.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Co-branded hubs banner — public clear vs In Queue lock */}
      <CobrandedHubsBanner id="home-cobranded-hubs" />

      {/* Example hubs gallery — live co-branded hubs (examples, not advertisers) */}
      <ExampleHubsGallery />

      {/* Inventory Previews */}
      <section id="placements" className="py-20 md:py-28 border-b border-border bg-background relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mb-16 md:mb-20">
            <h3 className="text-4xl md:text-6xl font-display tracking-tight mb-6 italic">Where the ad sits.</h3>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Not on the open web. Birch units appear after a customer has already bought, booked, or started a plan inside a signed Scale Health hub.
            </p>
            <a href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:text-accent">
              See the live DR-HO'S hub <ArrowUpRight className="size-4" />
            </a>
          </div>

          <div className="mb-20 md:mb-28">
             <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
               <div className="flex flex-col gap-5 lg:pr-8">
                 <div className="inline-block border border-border bg-secondary/30 text-[10px] uppercase tracking-widest px-3 py-1 text-foreground w-max font-medium">
                   Featured Format
                 </div>
                  <h4 className="text-3xl md:text-4xl font-display text-foreground tracking-wide">See a hub walk-through</h4>
                 <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                    Real walkthrough of the live DR-HO&apos;S hub — the page, the customer moment, and the neighboring catalog. No generated stand-in.
                 </p>
               </div>
                 <div
                   className="bg-background border border-border relative overflow-hidden aspect-[16/10] md:aspect-video"
                   data-testid="featured-format-hub-video"
                 >
                   <HubWalkthroughVideo
                     testId="video-featured-hub-walkthrough"
                     className="h-full w-full object-cover object-top"
                   />
                   <p className="absolute bottom-0 left-0 right-0 bg-background/85 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/70 backdrop-blur-sm">
                     Live DR-HO&apos;S hub walkthrough · illustrative
                   </p>
                 </div>
             </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 xl:gap-16">
            {INVENTORY_FORMATS.map((item, index) => {
              const Preview = item.Preview;

              return (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => openReserveDialog(item.title)}
                  aria-label={`Secure the ${item.title} advertising format`}
                  data-testid={`button-ad-format-${item.id}`}
                  className={`group flex h-full w-full flex-col border border-border p-6 text-left transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:p-8 ${item.bg}`}
                >
                  <div className="mb-8">
                    <div className="inline-block border border-border bg-background text-[9px] font-medium uppercase tracking-widest px-3 py-1 mb-5 text-foreground">
                      {item.tag}
                    </div>
                    <h4 className="text-2xl font-display mb-2 text-foreground tracking-wide">{item.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    <p className="mt-3 text-xs font-medium text-foreground">
                      This unit lives on signed hubs like {index === 0 ? (
                        <span>DR-HO'S.</span>
                      ) : (
                        "DR-HO'S."
                      )}
                    </p>
                  </div>
                  <div className="mt-auto">
                    <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Illustrative — not your receipt
                    </p>
                    <Preview />
                    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                      Illustrative unit. Your creative is placed beside live catalog products on a signed hub. Nothing runs until an insertion order names the surface.
                    </p>
                  </div>
                  <div className="mt-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors group-hover:text-accent">
                    Reserve this format <ArrowRight className="size-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Reserve and fulfillment */}
      <section className="border-b border-background/15 bg-foreground py-20 text-background md:py-24">
        <div className="container mx-auto px-6">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end lg:gap-20">
            <div>
              <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                Reserve and fulfillment
              </p>
              <h2 className="max-w-xl font-display text-4xl leading-tight tracking-tight md:text-6xl">
                Lock in your slot before the minimum goes up. We coordinate the rest.
              </h2>
            </div>
            <div className="grid gap-8 border-l border-background/20 pl-6 sm:grid-cols-2 md:pl-10">
              <div>
                <p className="font-display text-3xl text-accent">$490 USD</p>
                <p className="mt-2 text-sm leading-relaxed text-background/80">
                  Paid reserve, applied in full as media credit toward your placements.
                </p>
              </div>
              <div>
                <p className="font-display text-3xl text-background">100% Credit</p>
                <p className="mt-2 text-sm leading-relaxed text-background/80">
                  Payments are applied entirely to future media spend.
                </p>
              </div>
              <p className="text-base leading-relaxed text-background sm:col-span-2">
                Fulfillment is coordinated, not autopilot.
              </p>
              <p className="border-t border-background/20 pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-background/75 sm:col-span-2">
                Aggregate reporting only, never patient data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scale Health Ecosystem Handoff */}
      <section className="py-20 md:py-24 border-b border-border bg-secondary/10">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="mb-10">
            <h3 className="text-2xl md:text-3xl font-display tracking-tight mb-3">Studios that already own a local audience</h3>
            <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
               Studios that already own a local audience can add a Scale Clinic Hub (store + booking) and then a Birch unit on that hub. Care, commerce, and display stay three separate contracts.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <a href="https://www.scalehealth.ca/" target="_blank" rel="noopener noreferrer" className="block p-6 md:p-8 border border-border bg-background hover:border-foreground/30 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest">Brands</div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">For product and wellness brands seeking an embedded clinic layer across checkout or loyalty.</p>
            </a>
            <a href="https://scalehealth.ca/clinichubs" target="_blank" rel="noopener noreferrer" className="block p-6 md:p-8 border border-border bg-background hover:border-foreground/30 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest">Creators</div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">For digital audiences who want a Scale-operated storefront and product listing.</p>
            </a>
            <a href="https://scalehealth.ca/providers" target="_blank" rel="noopener noreferrer" className="block p-6 md:p-8 border border-border bg-background hover:border-foreground/30 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold uppercase tracking-widest">Clinics</div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">For traditional physio clinics able to receive in-person overflow patients.</p>
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section
        ref={finalCtaRef}
        className="pt-20 pb-52 md:py-28 bg-foreground text-background text-center border-b border-foreground"
        data-testid="home-final-cta"
      >
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-display tracking-tight mb-5 italic">Reserve a slot at today's minimum.</h2>
            <p className="text-base md:text-lg text-background/70 mb-10 leading-relaxed max-w-xl">
              8.7M orders a year in audience and 56M monthly views (est.) across Canada today, plus an est. 20M+ more orders in the queue and 100M+ orders a year (2027 projection). Lock in your slot before the minimum goes up. Nothing runs until the insertion order names the hub.
            </p>
            <div className="flex w-full max-w-xl flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center">
              <a
                href={RESERVE_LIST_HREF}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 whitespace-nowrap bg-accent text-accent-foreground h-14 px-12 hover:bg-background hover:text-foreground transition-colors font-semibold text-base"
                data-testid="button-final-reserve-list"
              >
                See the Reserve List <ArrowRight className="size-4" aria-hidden />
              </a>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
                onClick={() => openReserveDialog()}
                data-testid="button-final-splash-access"
              >
                Reserve a placement — {reservePriceLabel}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
                onClick={callBack}
                data-testid="button-final-call-back"
              >
                <Phone className="mr-2 size-4" aria-hidden />
                Get a call back
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-none border-background/20 bg-transparent text-background h-14 px-8 font-medium hover:bg-background/10 transition-colors"
              >
                <a href={TAP_TO_CALL_HREF} data-testid="link-final-tap-to-call" onClick={() => trackCta("cta_book_call")}>
                  <Phone className="mr-2 size-4" aria-hidden />
                  {TAP_TO_CALL_LABEL}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
