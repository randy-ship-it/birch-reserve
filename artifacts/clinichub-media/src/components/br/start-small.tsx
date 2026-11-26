/**
 * "Start small from $190" path (Randy, Nov 19 2026 ET): small advertisers and
 * agency client tests next to the big slots. One tier card, minimal copy, small
 * print in expanders. USD only. No new payment code: the $190 look and $490
 * reserve hand off to the EXISTING /buycalc flow; starter blocks and agency
 * client tests are request-only, with the deposit collected at confirmation.
 * Views are modelled, never guaranteed. Never imply zero demand.
 */
import { Cta, Eyebrow, H2 } from "@/components/br/ui";
import { trackCta } from "@/lib/track-cta";
import { quotePack, fmtUsd } from "../../../../api-server/src/lib/overhaul/pricing";

export const STARTER_BLOCK = quotePack(["landing"], 100_000);
export const AGENCY_TEST_USD = { low: 1_000, high: 5_000 } as const;

type Tier = {
  key: "look" | "seat" | "block" | "agency";
  eyebrow: string;
  price: string;
  name: string;
  line: string;
  cta: string;
  href: string;
  note: string;
};

function utm(href: string, page: string, key: string): string {
  const [path, hash] = href.split("#");
  const sep = path!.includes("?") ? "&" : "?";
  return `${path}${sep}utm_source=birchreserve&utm_medium=start-small&utm_campaign=${encodeURIComponent(`${page}-${key}`)}${hash ? `#${hash}` : ""}`;
}

export function startSmallTiers(): Tier[] {
  return [
    { key: "look", eyebrow: "7-day look", price: "$190 USD", name: "See it before you commit", line: "Your placement, live in a hub for 7 days.", cta: "Start the 7-day look", href: "/buycalc?sku=hold-190#reserve", note: "Card checkout" },
    { key: "seat", eyebrow: "Category seat", price: "$490 USD", name: "Your named category seat", line: "All $490 is media credit for your category.", cta: "Reserve my seat", href: "/buycalc?sku=reserve-490#reserve", note: "Card checkout" },
    { key: "block", eyebrow: "Starter view block", price: `From ${fmtUsd(STARTER_BLOCK.startingUsd)} USD`, name: "100K modelled views", line: "One hub surface at the starter rate.", cta: "Request a block", href: "/?inquire=pack&block=100000&surfaces=landing#quick-buy", note: "Deposit collected at confirmation" },
    { key: "agency", eyebrow: "Agency client test", price: "$1K–$5K USD", name: "Test a client in the hubs", line: "One IO per client. Standard 15% agency commission off the gross rate card.", cta: "Request a client test", href: "/agencies#talk", note: "Deposit collected at confirmation" },
  ];
}

const SMALL_PRINT = [
  { q: "Refund terms", a: "Every deposit is 100% media credit. Ask by email and the full amount goes back to your card any time before activation, which today means up to 14 days before the launch date on your insertion order (IO). The $190 look converts in full to the $490 seat within 7 days, or is refunded. After launch, unused credit can be extended or refunded under your IO." },
  { q: "What you get", a: "A share of display space across a growing network of private health and wellness hubs, curated as hubs launch. The IO names the hub and placement before anything runs. Views are modelled estimates at the starter rate, not a guarantee. Reporting is aggregate: views, clicks, UTM visits and promo-code redemptions. No PHI, no clinical pixels." },
  { q: "Agencies", a: "Prepay a $1,000–$5,000 USD client test. Each client gets its own IO and reporting. Agencies earn the standard 15% agency commission off the gross rate card. You set your own resale price and handle your own client disclosure. Refundable on the same terms as every deposit." },
  { q: "Bigger budgets", a: "Premium slots ($25,000–$1.5M) and area locks are by inquiry. Start small now and move up any time; your credit carries over." },
];

export function StartSmall({ page, highlight = "seat", id = "start-small", heading = true }: { page: string; highlight?: Tier["key"]; id?: string; heading?: boolean }) {
  const tiers = startSmallTiers();
  return (
    <div id={id} className="scroll-mt-20" data-testid="start-small">
      {heading ? (
        <>
          <Eyebrow>Start small</Eyebrow>
          <H2>Start small from $190. Fully refundable deposit.</H2>
          <p className="mt-4 max-w-2xl text-muted-foreground">Pick a size. Nothing runs until you approve the IO.</p>
        </>
      ) : null}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="start-small-tiers">
        {tiers.map((t) => {
          const on = t.key === highlight;
          return (
            <article key={t.key} data-testid={`start-small-${t.key}`} className={`flex flex-col p-5 ${on ? "border-2 border-foreground bg-foreground text-background" : "border border-foreground/20 bg-white"}`}>
              <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${on ? "text-background/60" : "text-foreground/55"}`}>{t.eyebrow}</p>
              <p className="mt-2 font-display text-4xl leading-none">{t.price}</p>
              <p className="mt-3 font-semibold">{t.name}</p>
              <p className={`mt-1 text-sm ${on ? "text-background/80" : "text-foreground/75"}`}>{t.line}</p>
              <p className={`mt-3 text-xs font-semibold ${on ? "text-accent" : "text-foreground/70"}`}>Fully refundable deposit</p>
              <div className="mt-5 sm:mt-auto sm:pt-5">
                <Cta
                  href={utm(t.href, page, t.key)}
                  variant={on ? "lime" : "ink"}
                  className="w-full"
                  testId={`start-small-${t.key}-cta`}
                  onClick={() => {
                    if (t.key === "look") trackCta("cta_hold_190", { offer: "hold-190" });
                    if (t.key === "seat") trackCta("cta_reserve_490", { offer: "reserve-490" });
                  }}
                >
                  {t.cta}
                </Cta>
                <p className={`mt-2 text-[11px] ${on ? "text-background/60" : "text-muted-foreground"}`}>{t.note}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-4 grid gap-x-8 md:grid-cols-2" data-testid="start-small-fine">
        {SMALL_PRINT.map((s) => (
          <details key={s.q} className="border-b border-border py-3 text-sm">
            <summary className="cursor-pointer font-semibold">{s.q}</summary>
            <p className="mt-2 leading-relaxed text-muted-foreground">{s.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">USD. Views are modelled estimates, not a guarantee.</p>
    </div>
  );
}
