import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Check, Mail, Phone } from "lucide-react";
import { Cta, usePageMeta } from "@/components/br/ui";
import { PlacementVisual, type PlacementKey } from "@/components/br/placement-example";
import { BOOK_CALL_MAILTO_HREF, openRandyChat } from "@/lib/book-call";
import {
  AGENCY_CREDIT_PCT,
  FRIDAY_COCKPIT_URL,
  MEDIA_KIT_CATEGORIES,
  MEDIA_KIT_CPM,
  MEDIA_KIT_EXAMPLES,
  MEDIA_KIT_NETWORK_FALLBACK,
  MEDIA_KIT_OFFERS,
  agencyCredit,
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
  "Refundable until IO activation.",
  "Aggregate UTM reporting only. No personal data is shared.",
  "One exclusive seat per category.",
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
    "Prepaid media credit for one exclusive category seat inside co-branded Scale Health Network hubs. $10K Test Rail or $35K–$75K Category Lock. Modelled volumes, no guarantees.",
  );
  const net = useNetwork();
  const [rail, lockLo, lockHi] = MEDIA_KIT_EXAMPLES as [ReturnType<typeof kitExample>, ReturnType<typeof kitExample>, ReturnType<typeof kitExample>];
  const lockOffer = MEDIA_KIT_OFFERS.categoryLock;
  const agencyEx = agencyCredit(lockOffer.spendLo);
  const cpm = `~$${MEDIA_KIT_CPM.lo}–${MEDIA_KIT_CPM.hi} CPM`;

  return (
    <div className="media-kit overflow-x-hidden" data-testid="br-media-kit">
      {/* Hero */}
      <section className="border-b border-border/70 bg-background">
        <div className="container mx-auto max-w-5xl px-5 pb-10 pt-10 md:px-6 md:pb-14 md:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Media kit · Nov 2026</p>
          <h1 className="mt-3 font-display text-[2.15rem] leading-[1.05] tracking-tight md:text-6xl">One category. One brand. Inside the hubs.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/80" data-testid="mk-what">
            Birch Reserve is prepaid media credit for one exclusive category seat inside co-branded Scale Health Network hubs: recovery, longevity, nutrition, women’s and men’s health, and more.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href="/buycalc" variant="lime" testId="mk-reserve-hero" className="w-full sm:w-auto">Reserve a category</Cta>
            <BookCall variant="line" testId="mk-call-hero" />
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

      {/* Rate cards */}
      <Block id="rates" eyebrow="Entry rates · non-partner brands" title="Two ways in">
        <div className="grid gap-4 md:grid-cols-2" data-testid="mk-rate-cards">
          <article className="flex flex-col border border-foreground/20 bg-white p-5 md:p-6" data-testid="mk-card-rail">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Try it</p>
            <h3 className="mt-1 font-display text-2xl">{MEDIA_KIT_OFFERS.testRail.name}</h3>
            <p className="mt-3 font-display text-5xl leading-none">{usdK(rail.spend)}</p>
            <p className="mt-2 text-sm font-semibold">+{rail.bonusPct}% bonus credit = {usd(rail.credit)} of credit</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Prove your category before you lock it</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span>About {millions(rail.imprLo)}–{millions(rail.imprHi)} impressions at {cpm} <Tag>Modelled</Tag></span></li>
            </ul>
          </article>
          <article className="flex flex-col border-2 border-foreground bg-white p-5 md:p-6" data-testid="mk-card-lock">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">Own it</p>
              <Tag tone="lime">{lockOffer.months}-month exclusive</Tag>
            </div>
            <h3 className="mt-1 font-display text-2xl">{lockOffer.name}</h3>
            <p className="mt-3 font-display text-5xl leading-none">{usdK(lockLo.spend)}–{usdK(lockHi.spend)}</p>
            <p className="mt-2 text-sm font-semibold">+{lockLo.bonusPct}% bonus credit = {usd(lockLo.credit)}–{usd(lockHi.credit)} of credit</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/80">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Your category is yours alone for {lockOffer.months} months</li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden /><span>About {millions(lockLo.imprLo)}–{millions(lockHi.imprHi)} impressions at {cpm} <Tag>Modelled</Tag></span></li>
            </ul>
          </article>
        </div>

        <h3 className="mt-8 font-display text-xl">The math</h3>
        <div className="mt-3 divide-y divide-border border-y border-border text-sm" data-testid="mk-math">
          {MEDIA_KIT_EXAMPLES.map((e) => (
            <div key={e.spend} className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 py-3 sm:grid-cols-[9rem_1fr_auto]">
              <span className="font-semibold">You prepay {usdK(e.spend)}</span>
              <span className="text-right text-foreground/80 sm:text-left">+{e.bonusPct}% → <strong>{usd(e.credit)}</strong> credit</span>
              <span className="col-span-2 text-muted-foreground sm:col-span-1 sm:text-right">
                at ${MEDIA_KIT_CPM.lo}–{MEDIA_KIT_CPM.hi} CPM ≈ {millions(e.imprLo)}–{millions(e.imprHi)} impressions
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Effective {cpm} is a modelled estimate. Impressions = credit ÷ CPM × 1,000. Final rate, currency and term are set on your IO.
        </p>
      </Block>

      {/* Categories */}
      <Block id="categories" eyebrow="Open categories" title="Categories open now, one brand each" tone="soft">
        <ul className="flex flex-wrap gap-2" data-testid="mk-categories">
          {MEDIA_KIT_CATEGORIES.map((c) => (
            <li key={c} className="border border-foreground/20 bg-white px-3 py-2 text-sm font-medium">{c}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-foreground/80">One brand per category, first come. When a category is locked, it’s closed to competitors for the term.</p>
      </Block>

      {/* Agency + rules */}
      <Block id="agencies" eyebrow="For agencies" title={`Place a client, keep ${AGENCY_CREDIT_PCT.lo}–${AGENCY_CREDIT_PCT.hi}% as credit`}>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-foreground/20 bg-white p-5" data-testid="mk-agency">
            <p className="text-sm text-foreground/80">Bring a brand into an open category. You keep {AGENCY_CREDIT_PCT.lo}–{AGENCY_CREDIT_PCT.hi}% of their prepaid spend as media credit.</p>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Example:</span> client takes a {usdK(lockOffer.spendLo)} Category Lock → you keep <strong>{usd(agencyEx.lo)}–{usd(agencyEx.hi)}</strong> in credit.
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
            <a className="inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline" href="tel:+16479316278" data-testid="mk-phone">
              <Phone className="size-4" aria-hidden /> (647) 931-6278
            </a>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Cta href="/buycalc" variant="lime" testId="mk-reserve-foot" className="w-full sm:w-auto">Reserve a category</Cta>
            <Cta href={BOOK_CALL_MAILTO_HREF} variant="lineDark" testId="mk-call-foot" className="w-full sm:w-auto" onClick={bookCall}>Book a call</Cta>
          </div>
          <p className="mt-8 border-t border-background/20 pt-4 text-xs text-background/65" data-testid="mk-footnote">
            Estimates are modelled; terms on IO. Volumes come from partner-provided data and stated assumptions, not audited delivery.
          </p>
        </div>
      </section>
    </div>
  );
}
