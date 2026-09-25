import { RANDY_TEL_HREF, RANDY_TEL_DISPLAY } from "@/lib/randy-chat-knowledge";
import { SELLER_EMAIL_HREF, SELLER_IDENTITY } from "@/lib/seller-identity";
import { EXAMPLE_HUBS } from "@/components/example-hubs-gallery";
import {
  PostCheckoutMockup,
  BookingMockup,
  HubMockup,
  ProtocolMockup,
} from "@/components/ad-previews";
import { useEffect } from "react";
import { HubWalkthroughVideo } from "@/components/hub-walkthrough-video";
import { CobrandedHubsBanner } from "@/components/cobranded-hubs-banner";
import {
  ArrowUpRight,
  Download,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/** Static print of this page (headless Chromium print-to-PDF of the /kit build). */
const MEDIA_KIT_PDF_HREF = "/birch-reserve-media-kit.pdf" as const;
const LIVE_PROOF_HREF = "https://physio.drhonow.com/dr-ho/portal" as const;
const LIVE_PROOF_HOME = "https://physio.drhonow.com" as const;

const PAGE_TITLE = "Media kit — Birch Reserve | Eight category seats";

const CATEGORY_SEATS: ReadonlyArray<{ label: string; shelf: string; hubImage: string }> = [
  { label: "Pain relief / topicals", shelf: "Exclusive aisle", hubImage: "/hub-gallery/kalaya.webp" },
  { label: "Recovery hardware", shelf: "Exclusive aisle", hubImage: "/hub-gallery/drho.webp" },
  { label: "Nutrition", shelf: "Exclusive aisle", hubImage: "/hub-gallery/jill-health.webp" },
  { label: "Sleep", shelf: "Exclusive aisle", hubImage: "/hub-gallery/jack-health.webp" },
  { label: "Meal prep", shelf: "Exclusive aisle", hubImage: "/hub-gallery/effortless-admin.webp" },
  { label: "Women’s health", shelf: "Exclusive aisle", hubImage: "/hub-gallery/jill-health.webp" },
  { label: "Men’s health", shelf: "Exclusive aisle", hubImage: "/hub-gallery/jack-health.webp" },
  { label: "Diagnostics / services", shelf: "Exclusive aisle", hubImage: "/hub-gallery/integrity.webp" },
];


const PROOF_SHOTS = [
  {
    src: "/hub-proof/drho-hub-home.png",
    alt: "DR-HO’S co-branded hub homepage",
    caption: "DR-HO’S hub home — live Scale Health room",
  },
  {
    src: "/hub-proof/kalaya-booking-card.png",
    alt: "Kalaya booking card on hub",
    caption: "Kalaya booking surface — illustrative placement context",
  },
  {
    src: "/hub-proof/roll-marketplace-grid.png",
    alt: "Roll Recovery marketplace grid",
    caption: "Roll Recovery marketplace — illustrative, not your receipt",
  },
] as const;

const FORMATS = [
  {
    id: "post-checkout",
    tag: "Hero · thank-you",
    title: "Post-checkout",
    desc: "After a Scale buy — first story on the thank-you.",
    Preview: PostCheckoutMockup,
  },
  {
    id: "scheduled-service",
    tag: "Hero twin",
    title: "Post-book thank-you",
    desc: "After a Scale book — same unit, booking confirmation.",
    Preview: BookingMockup,
  },
  {
    id: "member-hub",
    tag: "In-experience",
    title: "Member hub module",
    desc: "Native shelf inside an approved member dashboard.",
    Preview: HubMockup,
  },
  {
    id: "recovery-plan",
    tag: "In-experience",
    title: "Plan placement",
    desc: "Sponsored module inside a recovery or wellness plan.",
    Preview: ProtocolMockup,
  },
] as const;

export default function Kit() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (description) {
      description.content =
        "Birch Reserve media kit. Eight exclusive category seats inside signed Scale Health hubs. Hold $190 · Reserve $490 · Enterprise inquire. Credit, not a flight.";
    }
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
    };
  }, []);

  return (
    <div className="kit-page bg-background text-foreground" data-testid="kit-page">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border bg-foreground text-background">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
          <img
            src="/hub-gallery/drho.webp"
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="container relative mx-auto grid gap-12 px-6 py-16 md:py-24 lg:grid-cols-12 lg:gap-16 lg:py-28">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.22em] text-background/55">
              Birch Reserve · Media kit
            </p>
            <h1 className="font-display text-4xl leading-[0.95] tracking-tight md:text-5xl lg:text-6xl">
              Display beside the product they already trust.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-background/75 md:text-lg">
              Eight exclusive category seats inside signed Scale Health hubs. Your offer sits after
              checkout, on a plan, or at a booking — not in a stranger’s feed. Credit, not a flight.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={MEDIA_KIT_PDF_HREF}
                download
                className="kit-download inline-flex h-12 items-center gap-2 rounded-none bg-accent px-6 text-sm font-medium text-accent-foreground transition-colors hover:bg-background hover:text-foreground print:hidden"
                data-testid="button-download-media-kit"
              >
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
              <a
                href={SELLER_EMAIL_HREF}
                className="inline-flex h-12 items-center gap-2 rounded-none border border-background/25 bg-transparent px-6 text-sm font-medium text-background transition-colors hover:bg-background/10"
                data-testid="link-kit-email-sales"
              >
                <Mail className="size-4" aria-hidden />
                Email sales
              </a>
            </div>
            <p className="mt-5 text-sm text-background/65">
              Eight seats = eight advertiser categories across hubs, not eight websites.
            </p>
          </div>

          <div className="lg:col-span-6">
            <div className="mb-3 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-background/50">
              <span>Illustrative — not your receipt</span>
              <span>Live hub proof</span>
            </div>
            <div
              className="overflow-hidden border border-background/20 bg-background/5"
              data-testid="kit-hero-hub-video"
            >
              <div className="aspect-[16/10] w-full bg-black/40">
                <HubWalkthroughVideo
                  testId="video-kit-hub-walkthrough"
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <a
                href={LIVE_PROOF_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 border-t border-background/15 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                data-testid="link-kit-hero-proof"
              >
                <div>
                  <p className="font-display text-lg text-background">Live DR-HO&apos;S hub walkthrough</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-background/50">
                    physio.drhonow.com · open live hub
                  </p>
                </div>
                <ArrowUpRight className="size-5 text-accent" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you buy: exclusivity ────────────────────────── */}
      <section className="border-b border-border py-16 md:py-24" aria-labelledby="kit-seats-title">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                What you buy
              </p>
              <h2 id="kit-seats-title" className="font-display text-3xl tracking-tight md:text-5xl">
                One brand per aisle.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Hubs are the rooms. The seat is the exclusive shelf in those rooms. You are not
                auctioned against a competitor in the same category.
              </p>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              Eight category seats. Credit toward media under an approved IO — not a CPM guarantee.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="kit-category-grid">
            {CATEGORY_SEATS.map((seat) => (
              <li
                key={seat.label}
                className="group overflow-hidden border border-border bg-background transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.2)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted">
                  <img
                    src={seat.hubImage}
                    alt=""
                    aria-hidden
                    width={720}
                    height={450}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 border border-background/30 bg-foreground/85 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.16em] text-background backdrop-blur-sm">
                    {seat.shelf}
                  </span>
                </div>
                <div className="px-4 py-4">
                  <p className="font-display text-lg leading-tight text-foreground">{seat.label}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
                    Named category seat
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Co-branded hubs banner (public lock) ─────────────── */}
      <CobrandedHubsBanner id="kit-cobranded-hubs" compact />

      {/* ── Live proof ───────────────────────────────────────── */}
      <section className="border-b border-border py-16 md:py-24" aria-labelledby="kit-proof-title">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                Live proof
              </p>
              <h2 id="kit-proof-title" className="font-display text-3xl tracking-tight md:text-5xl">
                See a real room.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Screenshots from live co-branded hubs. Featured brands are examples of the network —
                not Birch advertisers or seat holders.
              </p>
            </div>
            <a
              href={LIVE_PROOF_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 border border-border bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-accent hover:text-accent-foreground"
              data-testid="link-kit-live-proof"
            >
              Open physio.drhonow.com
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </div>

          <div className="grid gap-5 lg:grid-cols-3" data-testid="kit-proof-shots">
            {PROOF_SHOTS.map((shot) => (
              <figure key={shot.src} className="m-0 overflow-hidden border border-border bg-background">
                <img
                  src={shot.src}
                  alt={shot.alt}
                  width={1200}
                  height={800}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover object-top"
                />
                <figcaption className="border-t border-border px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {shot.caption}.{" "}
                  <span className="uppercase tracking-wider text-foreground/45">Illustrative</span>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-10" data-testid="kit-extra-hubs">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
              More rooms in the network
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {EXAMPLE_HUBS.slice(0, 6).map((hub) => (
                <li key={hub.id} className="overflow-hidden border border-border bg-background">
                  {hub.href ? (
                    <a
                      href={hub.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label={`Tour the ${hub.name} hub`}
                    >
                      <img
                        src={hub.image}
                        alt={`${hub.name} hub homepage`}
                        width={1440}
                        height={900}
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                      <div className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="font-display text-lg">{hub.name}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
                            {hub.kind}
                          </p>
                        </div>
                        <ArrowUpRight className="size-4 text-foreground/40 group-hover:text-accent" aria-hidden />
                      </div>
                    </a>
                  ) : (
                    <figure className="m-0">
                      <img
                        src={hub.image}
                        alt={`${hub.name} hub homepage`}
                        width={1440}
                        height={900}
                        loading="lazy"
                        className="aspect-[16/10] w-full object-cover object-top"
                      />
                      <figcaption className="px-4 py-3">
                        <p className="font-display text-lg">{hub.name}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/45">
                          {hub.kind}
                        </p>
                      </figcaption>
                    </figure>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Formats ──────────────────────────────────────────── */}
      <section
        className="border-b border-border bg-secondary/10 py-16 md:py-24"
        aria-labelledby="kit-formats-title"
      >
        <div className="container mx-auto px-6">
          <div className="mb-10 max-w-2xl md:mb-14">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
              Formats
            </p>
            <h2 id="kit-formats-title" className="font-display text-3xl tracking-tight md:text-5xl">
              Thank-you first. In-experience next.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              Same agnostic Birch unit across surfaces. Every mock is illustrative — not your receipt.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2" data-testid="kit-formats-grid">
            {FORMATS.map((format) => (
              <article
                key={format.id}
                className={`flex flex-col border border-border bg-background${
                  format.id === "member-hub" || format.id === "recovery-plan" ? " print:hidden" : ""
                }`}
              >
                <div className="border-b border-border px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                    {format.tag}
                  </p>
                  <h3 className="mt-1 font-display text-2xl tracking-tight">{format.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{format.desc}</p>
                </div>
                <div className="relative flex-1 p-3 sm:p-4">
                  <span className="pointer-events-none absolute right-5 top-5 z-10 border border-border bg-background/95 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                    Illustrative
                  </span>
                  <format.Preview />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rate card ────────────────────────────────────────── */}
      <section className="border-b border-border py-16 md:py-24" aria-labelledby="kit-rates-title">
        <div className="container mx-auto px-6">
          <div className="mb-10 max-w-2xl md:mb-14">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
              Rate card · USD
            </p>
            <h2 id="kit-rates-title" className="font-display text-3xl tracking-tight md:text-5xl">
              Credit, not a flight.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              Nothing runs until an approved insertion order names the hub and surface.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-4" data-testid="kit-rate-cards">
            {/* Hold */}
            <article className="flex flex-col border border-border bg-background p-6 md:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                hold-190
              </p>
              <p className="mt-3 font-display text-4xl tracking-tight">$190</p>
              <p className="mt-1 text-sm font-medium text-foreground">7-day look</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>Refund or credit</li>
                <li>Does not consume a seat</li>
                <li>Credit, not a flight</li>
              </ul>
              <a
                href="/"
                className="mt-6 inline-flex h-11 items-center justify-center border border-border text-sm font-medium transition-colors hover:bg-secondary"
              >
                Hold a category
              </a>
            </article>

            {/* Reserve — primary */}
            <article className="flex flex-col border-2 border-foreground bg-foreground p-6 text-background md:p-7">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-background/55">
                  reserve-490
                </p>
                <span className="inline-flex items-center gap-1 border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                  <Sparkles className="size-3" aria-hidden />
                  Primary
                </span>
              </div>
              <p className="mt-3 font-display text-4xl tracking-tight">$490</p>
              <p className="mt-1 text-sm font-medium text-background/90">Named category seat</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-background/70">
                <li>100% media credit</li>
                <li>IO before flight</li>
                <li>12-month credit window</li>
              </ul>
              <a
                href="/"
                className="mt-6 inline-flex h-11 items-center justify-center bg-accent text-sm font-medium text-accent-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                Lock the seat
              </a>
            </article>

            {/* Custom */}
            <article className="flex flex-col border border-border bg-background p-6 md:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                custom
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Book a call</p>
              <p className="mt-1 text-sm font-medium text-foreground">Multi-hub / exclusive</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>Multi-hub packages</li>
                <li>Category exclusivity across rooms</li>
                <li>Scoped on IO</li>
              </ul>
              <a
                href={RANDY_TEL_HREF}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 border border-border text-sm font-medium transition-colors hover:bg-secondary"
              >
                <Phone className="size-4" aria-hidden />
                Call {RANDY_TEL_DISPLAY}
              </a>
            </article>

            {/* Enterprise */}
            <article className="flex flex-col border border-border bg-secondary/30 p-6 md:p-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
                enterprise
              </p>
              <p className="mt-3 font-display text-3xl tracking-tight md:text-4xl">$100K–$250K+</p>
              <p className="mt-1 text-sm font-medium text-foreground">Coming soon / Inquire within</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-muted-foreground">
                <li>Not a self-serve Stripe SKU</li>
                <li>Network-scale programs</li>
                <li>Credit, not a flight</li>
              </ul>
              <a
                href={SELLER_EMAIL_HREF}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 border border-foreground bg-foreground text-sm font-medium text-background transition-colors hover:bg-accent hover:text-accent-foreground"
                data-testid="link-kit-enterprise-inquire"
              >
                <Mail className="size-4" aria-hidden />
                Inquire within
              </a>
            </article>
          </div>
        </div>
      </section>

      {/* ── Legal + contact ──────────────────────────────────── */}
      <section className="py-16 md:py-20" aria-labelledby="kit-legal-title">
        <div className="container mx-auto grid gap-12 px-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-5 text-foreground" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">
                Legal floor
              </p>
            </div>
            <h2 id="kit-legal-title" className="font-display text-2xl tracking-tight md:text-3xl">
              Delivery under an approved IO.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              100% media credit. Delivery only under an approved insertion order that names the
              surface. Cash refund if no approved surface can be named within 60 days. Credit expires
              at 12 months. After IO: IAB cancel / makegood. Aggregate reporting only. No PHI. No
              clinical pixels.
            </p>
            <p className="mt-6 text-sm text-foreground">
              Seller: {SELLER_IDENTITY} ·{" "}
              <a href={SELLER_EMAIL_HREF} className="underline underline-offset-2 hover:text-accent">
                Email sales
              </a>
            </p>
          </div>

          <div className="flex flex-col justify-center border border-border bg-foreground p-7 text-background lg:col-span-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-background/55">
              Talk to sales
            </p>
            <h3 className="mt-3 font-display text-3xl tracking-tight">Ready to lock a seat?</h3>
            <p className="mt-3 text-sm leading-relaxed text-background/70">
              sales@silverbirchgrowth.com — category exclusivity inside signed hubs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={SELLER_EMAIL_HREF}
                className="inline-flex h-11 items-center gap-2 bg-accent px-5 text-sm font-medium text-accent-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Mail className="size-4" aria-hidden />
                Email sales
              </a>
              <a
                href={RANDY_TEL_HREF}
                className="inline-flex h-11 items-center gap-2 border border-background/25 px-5 text-sm font-medium text-background transition-colors hover:bg-background/10"
              >
                <Phone className="size-4" aria-hidden />
                {RANDY_TEL_DISPLAY}
              </a>
            </div>
            <a
              href={MEDIA_KIT_PDF_HREF}
              download
              className="kit-download mt-4 inline-flex items-center gap-2 text-sm text-background/70 underline underline-offset-4 print:hidden"
            >
              <Download className="size-3.5" aria-hidden />
              Download this kit as PDF
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
