import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Check, Mail, Phone } from "lucide-react";
import { Cta, usePageMeta } from "@/components/br/ui";
import { MediaKitPdfLink } from "@/components/br/trust";
import { SALES_REPLY_LINE } from "@/lib/seller-identity";
import { PlacementVisual, type PlacementKey } from "@/components/br/placement-example";
import { BOOK_CALL_MAILTO_HREF, openRandyChat } from "@/lib/book-call";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import {
  AGENCY_CASH_PCT,
  FRIDAY_COCKPIT_URL,
  MEDIA_KIT_CATEGORIES,
  MEDIA_KIT_CPM,
  MEDIA_KIT_EXAMPLES,
  MEDIA_KIT_NETWORK_FALLBACK,
  MEDIA_KIT_OFFERS,
  UPGRADE_PATH_LINE,
  agencyCash,
  kitExample,
  millions,
  mm,
  parseCockpit,
  usd,
  usdK,
  type KitNetwork,
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
  "Prepaid credit. Your payment becomes media credit that draws down as your ads run.",
  "Modelled volumes. Views and impressions are estimates, not measured delivery.",
  "Refundable until IO activation. The $190 look and $490 seat spend down over 6 months; unused credit can be refunded or extended.",
  "Aggregate UTM reporting only. No personal data is shared.",
  "Category seats, open to more than one brand. Premium slots lock one brand per category.",
  "No guarantees of reach, clicks or sales.",
];

function useNetwork(): KitNetwork {
  const [n, setN] = useState<KitNetwork>({ ...MEDIA_KIT_NETWORK_FALLBACK, live: false });
  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 4000);
    fetch(FRIDAY_COCKPIT_URL, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setN(parseCockpit(d)))
      .catch(() => undefined)
      .finally(() => window.clearTimeout(t));
    return () => ctrl.abort();
  }, []);
  return n;
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
    "Prepaid media credit inside co-branded Scale Health Network hubs. Start with the small-business package ($190 look or $490 seat, self-serve) or inquire about a premium slot from $25K–$50K. Modelled volumes, no guarantees.",
  );
  const net = useNetwork();
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Media kit · Nov 2026</p>
          <h1 className="mt-3 font-display text-[2.15rem] leading-[1.05] tracking-tight md:text-6xl">Start with a seat. Then lock the category.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80" data-testid="mk-what">
            Birch Reserve is prepaid media credit inside co-branded Scale Health Network hubs. Start self-serve on the small-business package, then step up to a premium slot — the main event — with category exclusivity, a larger display share and priority placement.
          </p>
          <p className="mt-3 text-sm font-semibold" data-testid="mk-upgrade">Start with a seat, then lock the category.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row" id="download">
            <Cta href={RESERVE_HREF} variant="lime" testId="mk-reserve-hero" className="w-full sm:w-auto">Start with a $490 seat</Cta>
            <Cta href="#premium" variant="ink" testId="mk-premium-hero" className="w-full sm:w-auto">See premium slots, from $25K</Cta>
            <MediaKitPdfLink variant="line" testId="mk-pdf-hero" className="w-full sm:w-auto" />
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-3 border-t border-border pt-6 md:gap-8" data-testid="mk-network">
            <div>
              <dt className="sr-only">Orders</dt>
              <dd className="font-display text-[1.6rem] leading-none sm:text-3xl md:text-5xl" data-testid="mk-orders">{mm(net.ordersYr)}+</dd>
              <p className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">orders a year being onboarded now</p>
            </div>
            <div>
              <dt className="sr-only">Monthly views</dt>
              <dd className="font-display text-[1.6rem] leading-none sm:text-3xl md:text-5xl" data-testid="mk-views">~{mm(net.monthlyViews)}</dd>
              <p className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">modelled brand page views a month</p>
            </div>
            <div>
              <dt className="sr-only">Listed partners</dt>
              <dd className="font-display text-[1.6rem] leading-none sm:text-3xl md:text-5xl" data-testid="mk-partners">{net.listedPartners}</dd>
              <p className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">listed partner brands</p>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground" data-testid="mk-network-note">
            <Tag>Modelled</Tag> From partner-provided data via the Scale Health network feed
            {net.live && net.asOf ? `, read ${net.asOf}` : ""}. Not audited. Partners are listed, not yet live for display.
          </p>
        </div>
      </section>

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
            <p className="mt-3 text-sm text-foreground/80">Self-serve, paid by card. Category seats, open to more than one brand. Credit spends down over 6 months.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{MEDIA_KIT_OFFERS.look.name}</p>
                <p className="mt-1 font-display text-4xl leading-none">{usd(MEDIA_KIT_OFFERS.look.spendUsd)}</p>
                <p className="mt-1 text-xs text-muted-foreground">${MEDIA_KIT_OFFERS.look.spendCad} CAD. 100% credit if you take the $490 seat within 7 days; otherwise a cash refund.</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{MEDIA_KIT_OFFERS.seat.name}</p>
                <p className="mt-1 font-display text-4xl leading-none">{usd(MEDIA_KIT_OFFERS.seat.spendUsd)}</p>
                <p className="mt-1 text-xs text-muted-foreground">${MEDIA_KIT_OFFERS.seat.spendCad} CAD. 100% media credit. About {millions(seatEx.imprLo)}–{millions(seatEx.imprHi)} impressions at {cpm} <Tag>Modelled</Tag></p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Cta href={RESERVE_HREF} testId="mk-cta-seat" className="w-full sm:w-auto">Take a $490 seat</Cta>
              <Cta href={LOOK_HREF} variant="line" testId="mk-cta-look" className="w-full sm:w-auto">7-day look · $190</Cta>
            </div>
          </article>
          <article id="premium" className="flex flex-col border-2 border-foreground bg-foreground p-5 text-background md:p-6" data-testid="mk-card-premium">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-background/60">Premium slots · the main event</p>
              <Tag tone="lime">Inquire only</Tag>
            </div>
            <h3 className="mt-1 font-display text-2xl">From $25K, $25K–$50K</h3>
            <p className="mt-3 text-sm text-background/80">Category exclusivity, a larger display share and priority placement. No card purchase — we reply with an insertion order. Term is set on the IO.</p>
            <ul className="mt-4 space-y-2 text-sm text-background/85">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />One brand per category for the term</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span>About {millions(premLo.imprLo)}–{millions(premHi.imprHi)} impressions at {cpm} <Tag>Modelled</Tag></span></li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{UPGRADE_PATH_LINE}</li>
            </ul>
            <div className="mt-6">
              <BookCall variant="lime" testId="mk-premium-inquire" />
            </div>
          </article>
        </div>

        <h3 className="mt-8 font-display text-xl">The math</h3>
        <div className="mt-3 divide-y divide-border border-y border-border text-sm" data-testid="mk-math">
          {MEDIA_KIT_EXAMPLES.map((e) => (
            <div key={e.spend} className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[9rem_1fr_auto]">
              <span className="font-semibold">You prepay {usdK(e.spend)}</span>
              <span className="text-right text-foreground/80 sm:text-left"><strong>{usd(e.credit)}</strong> media credit</span>
              <span className="col-span-2 text-muted-foreground sm:col-span-1 sm:text-right">
                at ${MEDIA_KIT_CPM.lo}–{MEDIA_KIT_CPM.hi} CPM ≈ {millions(e.imprLo)}–{millions(e.imprHi)} impressions
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Effective {cpm} is a modelled estimate. Impressions = credit ÷ CPM × 1,000. Final rate, currency and term are set on your IO. Premium is inquire-only.
        </p>
      </Block>

      {/* Categories */}
      <Block id="categories" eyebrow="Open categories" title="Categories open now" tone="soft">
        <ul className="flex flex-wrap gap-2" data-testid="mk-categories">
          {MEDIA_KIT_CATEGORIES.map((c) => (
            <li key={c} className="border border-foreground/20 bg-white px-3 py-2 text-sm font-medium">{c}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-foreground/80">The $490 seat is a category seat, open to more than one brand. A premium slot is one brand each, first come: when a category is locked, it is closed to competitors for the term on the IO.</p>
      </Block>

      {/* Agency + rules */}
      <Block id="agencies" eyebrow="For agencies" title={`Place a client, earn ${AGENCY_CASH_PCT}% in cash`}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-foreground/20 bg-white p-5" data-testid="mk-agency">
            <p className="text-sm text-foreground/80">Bring a brand into an open category. The agency of record earns {AGENCY_CASH_PCT}% of media spend, paid in cash per the IO.</p>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Example:</span> a ${MEDIA_KIT_OFFERS.seat.spendUsd} seat pays you <strong>{usd(agencySeat)}</strong>; a {usdK(prem.spendLo)} premium slot pays you <strong>{usd(agencyPrem)}</strong> in cash.
            </p>
          </div>
          <div data-testid="mk-rules">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">The plain rules</p>
            <ul className="mt-3 space-y-2 text-sm">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-foreground/70" aria-hidden />{r}</li>
              ))}
            </ul>
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
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href={RESERVE_HREF} variant="lime" testId="mk-reserve-foot" className="w-full sm:w-auto">Start with a $490 seat</Cta>
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
