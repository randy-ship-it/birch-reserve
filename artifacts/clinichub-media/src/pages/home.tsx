import { RANDY_TEL_DISPLAY, RANDY_TEL_HREF } from "@/lib/randy-chat-knowledge";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck2,
  ClipboardCheck,
  MonitorUp,
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
import { ExampleHubsGallery } from "@/components/example-hubs-gallery";
import {
  PostCheckoutMockup,
  ProtocolMockup,
  BookingMockup,
  HubMockup,
} from "@/components/ad-previews";

// Randy can add a real MP4, Loom, or YouTube source when the walkthrough is ready.
const VIDEO_SRC = "";

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

const SIGNED_HUB_BRANDS = [
  "DR-HO'S",
  "Kalaya",
  "Jill Health",
  "Jack Health",
  "Integrity Fitness",
  "Bird & Be",
  "NutriProCan",
  "Roll Recovery",
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
  const [splashDialogOpen, setSplashDialogOpen] = useState(false);
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
    fetch("/v1/availability.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.seats_open === "number") {
          setAvailability(data);
        }
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


      {!splashDialogOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/10 bg-background/95 p-4 backdrop-blur-md md:hidden"
          data-testid="mobile-sticky-reserve-cta"
        >
          <button
            type="button"
            onClick={() => openReserveDialog()}
            className="flex h-12 w-full items-center justify-center bg-accent font-medium text-accent-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Lock the seat — {reservePriceLabel} <ArrowRight className="ml-2 size-4" />
          </button>
        </div>
      )}

      {/* Open-Seats Banner */}
      <div className="bg-accent text-accent-foreground py-3 px-6 text-center text-[11px] md:text-xs font-bold uppercase tracking-widest flex justify-center items-center gap-3 border-b border-foreground/10" data-testid="text-launch-status">
          <span>Reservations are open. Campaigns start when the insertion order names the hub.</span>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-[min(750px,85dvh)] flex items-center pt-12 pb-20 md:pb-24 border-b border-background/20 bg-foreground text-background">
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

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-5xl md:text-6xl lg:text-[5.5rem] font-display text-background leading-[0.95] tracking-tight mb-6"
            >
              Eight category seats inside closed recovery hubs.
            </motion.h1>

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
                className="w-full sm:w-auto rounded-none bg-accent text-accent-foreground h-14 px-8 font-medium hover:bg-background hover:text-foreground transition-colors text-base"
                onClick={() => openReserveDialog(undefined, "reserve-490", "cta_hero_reserve")}
                data-testid="button-hero-reserve"
              >
                Lock the seat — {reservePriceLabel}
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
            </motion.div>
            <p className="mt-3 text-sm text-background/80">
              <a href={VOICE_TEL_HREF} className="underline underline-offset-4" onClick={() => trackCta("cta_book_call")}>
                Call {VOICE_TEL_DISPLAY}
              </a>
              <span className="text-background/50"> · </span>
              <a className="underline underline-offset-4" href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer" data-testid="link-hero-live-hub">See a live hub</a>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                className="w-max text-left text-sm text-background/80 underline underline-offset-4"
                onClick={() => openReserveDialog(undefined, "hold-190")}
              >
                Hold a category for 7 days — $190
              </button>
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
              Eight seats = eight advertiser categories across hubs, not eight websites.
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

      {/* One funnel, two buying paths */}
      <section id="reserve-offers" className="border-b border-border bg-background py-10 md:py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                Reserve before campaigns open
              </p>
              <h2 className="font-display text-3xl text-foreground">
                Eight category seats. One brand per aisle.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Every dollar is a 100% media credit. Delivery starts when the insertion order names the hub. Hubs are the rooms. The seat is the exclusive shelf in those rooms.
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
                <span><strong className="block">Managed distribution</strong><span className="text-xs font-normal opacity-70">For a guided exclusive launch</span></span>
              </Button>
            </div>
          </div>
          <div className="mt-12 grid border border-border md:grid-cols-3">
            {RESERVE_OFFERS.map((offer, index) => (
              <article
                key={offer.key}
                className={`flex flex-col p-6 md:p-8 ${
                  index > 0
                    ? "border-t border-border md:border-l md:border-t-0"
                    : ""
                }`}
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
              Multi-hub, exclusive, or on-prem Align. Credit, not a flight. Not a self-serve Stripe SKU — inquire within.
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
                ? `${availability.seats_open} open · ${availability.seats_held} held · ${availability.seats_paid} paid · ${availability.seats_total} seats`
                : "Live open, held, and paid counts load from availability."}
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
              className="h-12 rounded-none bg-accent px-6 text-accent-foreground hover:bg-foreground hover:text-background"
            >
              Lock the seat — $490 USD
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openReserveDialog(undefined, "hold-190")}
              className="h-12 rounded-none px-6"
            >
              Hold a category for 7 days — $190
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
            </article>
            <article className="border border-border bg-foreground p-7 text-background md:p-9">
              <MapPin className="mb-7 size-6 text-accent" />
              <h3 className="mb-3 font-display text-3xl">On-prem, on request</h3>
              <p className="text-sm leading-relaxed text-background/70 mb-4">
                On-prem clinic and studio surfaces via Align and Scale clinic hubs are a separate insertion-order line. They are not sold as digital reach.
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
                  <li className="border-l border-accent pl-4">Exclusive category—you are not auctioning against 40 supplement brands.</li>
                  <li className="border-l border-accent pl-4">One brand per aisle. You are not auctioned against a competitor in the same category.</li>
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
                Add exclusive digital and physical inventory beside your existing channels, reaching customers inside closed brand environments and participating health and wellness locations.
              </p>
              <p className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-md">
                <strong className="text-foreground font-medium">For auto-buyers:</strong> no insertion-order theatre or 12-week RFP.<br/>
                <strong className="text-foreground font-medium">For distribution buyers:</strong> one exclusive category seat, outside the open auction.
              </p>
              <div className="mt-8">
                <span className="bg-foreground text-accent px-4 py-2 inline-block font-medium tracking-wide rounded-sm text-sm">Reserve payments act as 100% media credit and hold first rights to available inventory.</span>
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
          <div className="mb-12 max-w-2xl">
            <h3 className="text-3xl md:text-5xl font-display tracking-tight text-foreground mb-4">Signed hubs. Real customer environments.</h3>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Birch inventory is contracted inside approved Scale Health brand environments. Launch timing varies by hub.
            </p>
          </div>
          <div className="mb-8 grid border border-border bg-secondary/10 md:grid-cols-3">
            <div className="p-5 md:border-r md:border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Live</p>
              <p className="mt-2 text-sm font-medium">DR-HO'S ·{" "}<a className="underline underline-offset-4 hover:text-accent" href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer">Tour the DR-HO hub</a></p>
            </div>
            <div className="border-t border-border p-5 md:border-r md:border-t-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">Signed</p>
              <p className="mt-2 text-sm leading-relaxed">{SIGNED_HUB_BRANDS.slice(1).join(" · ")}</p>
            </div>
            <div className="border-t border-border p-5 md:border-t-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/60">On request</p>
              <p className="mt-2 text-sm">On-prem clinic and studio surfaces are a separate insertion order.</p>
            </div>
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
                  <img src="/hub-proof/drho-hub-home.png" alt="DR-HO'S Insider Hub screenshot" className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Illustrative — not your receipt.</p>
                <a href="https://physio.drhonow.com/dr-ho/portal" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                  Open the live hub <ArrowUpRight className="size-4" />
                </a>
              </div>
            </div>

            <div className="border border-border bg-background flex flex-col">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span></span>
                  Signed hub · launching
                </p>
                <h4 className="font-display text-2xl text-foreground">Kalaya Booking Hub</h4>
              </div>
              <div className="p-6 md:p-8 bg-background flex-1">
                <div className="border border-border/50 shadow-sm overflow-hidden aspect-[4/3] bg-muted relative">
                  <img src="/hub-proof/kalaya-booking-card.png" alt="Kalaya Booking Hub screenshot" className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Signed Scale Health hub. Display inventory is contracted. Launch timing varies.</p>
              </div>
            </div>

            <div className="border border-border bg-background flex flex-col">
              <div className="p-6 md:p-8 border-b border-border bg-secondary/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-2 flex items-center gap-2">
                  Signed hub · launching
                </p>
                <h4 className="font-display text-2xl text-foreground">ROLL Marketplace</h4>
              </div>
              <div className="p-6 md:p-8 bg-background flex-1">
                <div className="border border-border/50 shadow-sm overflow-hidden aspect-[4/3] bg-muted relative">
                  <img src="/hub-proof/roll-marketplace-grid.png" alt="ROLL Marketplace screenshot" className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Signed Scale Health hub. Display inventory is contracted. Launch timing varies.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                    A real walkthrough will show the live page, the customer moment, and the neighboring catalog products. No generated stand-in.
                 </p>
               </div>
                 <div className="bg-background border border-border flex items-center justify-center aspect-video relative overflow-hidden">
                   {VIDEO_SRC ? (
                     <video className="h-full w-full object-cover" src={VIDEO_SRC} controls preload="metadata" />
                   ) : (
                     <div className="absolute inset-0 bg-secondary/20" />
                   )}
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-foreground/40 px-4 py-2 border border-border/50 bg-background/80 backdrop-blur-sm">
                       Real hub walkthrough coming soon
                     </div>
                   </div>
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
                Hold the seat. We coordinate the rest.
              </h2>
            </div>
            <div className="grid gap-8 border-l border-background/20 pl-6 sm:grid-cols-2 md:pl-10">
              <div>
                <p className="font-display text-3xl text-accent">$490 USD</p>
                <p className="mt-2 text-sm leading-relaxed text-background/80">
                  Locks a named category seat. A 7-day look is $190 and does not consume a seat.
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
            <a href="https://scalehealth.ca/embedded-recovery-clinic" target="_blank" rel="noopener noreferrer" className="block p-6 md:p-8 border border-border bg-background hover:border-foreground/30 transition-colors group">
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
      <section className="py-20 md:py-28 bg-foreground text-background text-center border-b border-foreground">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            <h2 className="text-4xl md:text-6xl font-display tracking-tight mb-5 italic">Lock the seat before the aisle is gone.</h2>
            <p className="text-base md:text-lg text-background/70 mb-10 leading-relaxed max-w-xl">
              {reservePriceLabel} is a named category seat and a 100% media credit. Nothing runs until the insertion order names the hub.
            </p>
            <div className="flex w-full max-w-xl flex-col gap-4 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-none bg-accent text-accent-foreground h-14 px-12 hover:bg-background hover:text-foreground transition-colors font-medium text-base"
                onClick={() => openReserveDialog()}
                data-testid="button-final-splash-access"
              >
                Lock the seat — {reservePriceLabel}
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
            </div>
            <p className="mt-4 text-sm text-background/70">
              <a href={VOICE_TEL_HREF} className="underline underline-offset-4" onClick={() => trackCta("cta_book_call")}>
                {VOICE_TEL_DISPLAY}
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
