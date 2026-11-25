/**
 * Agency-first home sections (Nov 12 2026, Randy via Emma 7:34 PM ET).
 * Numbers come only from api-server/src/lib/overhaul/agencyShowcase.ts, which re-uses
 * figures already on the site. Views are modelled; placeholders render as placeholders.
 */
import type { ReactNode } from "react";
import { Cta } from "./ui";
import { InquireBadge } from "./quick-buy";
import { priceFor, useCurrency } from "@/lib/currency";
import { ChevronDown } from "lucide-react";
import { skinText } from "@/lib/siteSkin";
import { priceLadder } from "../../../../api-server/src/lib/priceLadder";
import {
  AGENCY_CLIENT_TEST,
  AGENCY_DISCOUNT_EXAMPLE,
  AGENCY_DISCOUNT_PCT,
  AGENCY_EXAMPLES,
  AGENCY_RATE_CARD,
  AGENCY_RATE_RULES,
  AGENCY_SHARE,
  AGENCY_TIERS,
  EXCLUSIVE_PARTNER_PERKS,
  type AgencyTierKey,
  BRAND_BONUS_LINE,
  BUY_PATHS,
  GOAL_PLAN,
  INVENTORY_LINE,
  PLAIN_TERMS,
  SELL_ASSUMPTION_LINE,
  SELL_ASSUMPTION_PCT,
  SPEC_ROWS,
  SPEND_DOWN_MONTHS,
  agencyPayoutRows,
} from "../../../../api-server/src/lib/overhaul/agencyShowcase";
import { POSITIONING, TAM } from "../../../../api-server/src/lib/overhaul/model";

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

function Kicker({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${dark ? "text-background/55" : "text-foreground/55"}`}>{children}</p>;
}

function Tag({ children, tone = "line" }: { children: ReactNode; tone?: "line" | "lime" | "dark" }) {
  const t = tone === "lime" ? "bg-accent text-accent-foreground" : tone === "dark" ? "border border-background/35 text-background/75" : "border border-foreground/25 text-foreground/70";
  return <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t}`}>{children}</span>;
}

/**
 * In plain terms (Nov 18 2026 daily scan): five forwardable answers that define the category.
 * Copy lives in PLAIN_TERMS (api-server) so the server head can emit the same Q&As as FAQPage JSON-LD.
 */
export function PlainTerms() {
  return (
    <ol className="grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-2" data-testid="plain-terms">
      {PLAIN_TERMS.map((t, i) => (
        <li key={t.key} className={`min-w-0 bg-background p-6 ${i === PLAIN_TERMS.length - 1 && PLAIN_TERMS.length % 2 ? "md:col-span-2" : ""}`}>
          <Kicker>{String(i + 1).padStart(2, "0")}</Kicker>
          <h3 className="mt-2 font-display text-2xl leading-tight">{t.q}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.a}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Plan by goal (Nov 17 2026 daily scan): map a client brief to the placement that fits.
 * Rates come from SPEC_ROWS via GOAL_PLAN; labelled illustrative starting rates.
 */
export function GoalPlanner() {
  return (
    <div data-testid="goal-planner">
      <div className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-4">
        {GOAL_PLAN.map((g) => (
          <article key={g.key} className="flex flex-col bg-background p-5 md:p-6" data-testid={`goal-${g.key}`}>
            <div className="flex items-start justify-between gap-2">
              <Kicker>Goal</Kicker>
              {g.inquire ? <InquireBadge /> : <Tag>Self-serve</Tag>}
            </div>
            <h3 className="mt-1 font-display text-2xl leading-tight">{g.goal}</h3>
            <p className="mt-2 text-sm text-foreground/80">{g.brief}</p>
            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Placement</dt>
                <dd className="font-semibold">{g.label}</dd>
                <dd className="text-xs text-muted-foreground">{g.moment}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Starting at (USD)</dt>
                <dd className="tabular-nums">${g.cpmFloorUsd} CPM · ${g.cpcFloorUsd.toFixed(2)} CPC</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Reported as</dt>
                <dd>{g.measure}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">How to buy</dt>
                <dd>{g.buy}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Starting rates are illustrative planning estimates, not a quote. Reporting is aggregate only. One IO can mix goals; it names each hub, surface and date before anything runs.</p>
    </div>
  );
}

/** Hero: what the inventory is, plus the agency economics card. */
export function AgencyHero() {
  const ex = AGENCY_EXAMPLES[1]!;
  return (
    <section className="border-b border-border/70 bg-background" data-testid="agency-hero">
      <div className="container mx-auto px-6 pb-14 pt-12 md:pb-20 md:pt-20">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <p className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/60">
              For agencies &amp; media buyers <span aria-hidden className="h-px w-6 bg-foreground/30" /> First-party health inventory
            </p>
            <h2 className="font-display text-[2.1rem] leading-[1.04] tracking-tight md:text-[3.5rem]">
              Agencies: place a client inside the health hubs. <em className="not-italic text-foreground/55">A written {AGENCY_SHARE.pct}% off the rate card.</em>
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground" data-testid="agency-inventory-line">
              {INVENTORY_LINE} Fixed starting rates, the surface named on the IO, and UTM and promo-code reporting per hub.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="/agencies#talk" testId="hero-agency" className="w-full sm:w-auto">Place a client</Cta>
              <Cta href="#inventory" variant="line" testId="hero-spec" className="w-full sm:w-auto">See the spec sheet</Cta>
              <Cta href="#quick-buy" variant="ink" testId="hero-buy" className="w-full sm:w-auto">Buy self-serve</Cta>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Brands: <a className="underline underline-offset-2" href="/match" data-testid="hero-match">match your audience</a> · Local:{" "}
              <a className="underline underline-offset-2" href="/advertise/local" data-testid="hero-lock">Lock down my area · Inquire</a> ·{" "}
              <a className="underline underline-offset-2" href="/sample-io">Sample IO</a>
            </p>
            <dl className="mt-10 grid grid-cols-2 gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-4" data-testid="agency-kpis">
              {[
                { v: "4", l: "hub placements, display + CPC", t: "Spec" },
                { v: `$${Math.min(...SPEC_ROWS.map((r) => r.cpmFloorUsd))}`, l: "CPM, starting at", t: "Estimate" },
                { v: `${SELL_ASSUMPTION_PCT}%`, l: "of display space sold", t: "Assumption" },
              ].map((k) => (
                <div key={k.l} className="bg-background p-4">
                  <dt className="sr-only">{k.l}</dt>
                  <dd className="font-display text-3xl tabular-nums md:text-4xl">{k.v}</dd>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground">{k.l}</dd>
                  <dd className="mt-2"><Tag>{k.t}</Tag></dd>
                </div>
              ))}
            </dl>
          </div>
          <aside className="border border-foreground bg-foreground p-6 text-background md:p-8" data-testid="agency-economics">
            <Kicker dark>Agency economics</Kicker>
            <p className="mt-3 font-display text-6xl leading-none text-accent tabular-nums md:text-7xl">
              {AGENCY_SHARE.pct}%
            </p>
            <p className="mt-3 text-base leading-relaxed text-background/80">{AGENCY_SHARE.line}</p>
            <div className="mt-6 border-t border-background/15 pt-5">
              <p className="text-xs uppercase tracking-wider text-background/55">Worked example</p>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 text-sm tabular-nums">
                <span className="text-background/70">Client prepays: {ex.label}</span>
                <span className="text-right">{usd(ex.spend)}</span>
                <span className="text-background/70">Agency pays (10% off list)</span>
                <span className="text-right font-semibold text-accent">{usd(ex.spend - ex.cash)}</span>
              </div>
            </div>
            <ul className="mt-6 space-y-2 border-t border-background/15 pt-5 text-sm text-background/80">
              <li>{AGENCY_SHARE.timing}</li>
              <li>One prepay can be split across clients; each client gets its own IO and reporting.</li>
              <li className="text-background/60">{BRAND_BONUS_LINE}</li>
            </ul>
            <a href="#agency-payouts" className="mt-6 inline-block text-sm text-background/70 underline underline-offset-4 hover:text-background">
              How the discount works
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

/** Inventory and placements spec table. */
export function InventorySpec() {
  return (
    <div data-testid="inventory-spec">
      {/* Mobile: one card per placement */}
      <div className="grid gap-3 md:hidden">
        {SPEC_ROWS.map((r) => (
          <article key={r.key} className="border border-foreground/15 bg-white p-4" data-testid={`spec-card-${r.key}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl leading-tight">{r.label}</h3>
              {r.inquire ? <InquireBadge /> : <Tag>Self-serve</Tag>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.moment}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm tabular-nums">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">CPM from</dt>
                <dd className="font-semibold">${r.cpmFloorUsd}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">CPC from</dt>
                <dd className="font-semibold">${r.cpcFloorUsd.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Buy</dt>
                <dd className="font-semibold">{r.inquire ? "IO" : "Card or IO"}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Unit: {r.unit}</p>
          </article>
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden overflow-x-auto border border-foreground/15 bg-white md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/80 text-[11px] uppercase tracking-wider text-foreground/60">
              <th className="px-5 py-3 font-semibold">Placement</th>
              <th className="px-5 py-3 font-semibold">Moment</th>
              <th className="px-5 py-3 font-semibold">Unit</th>
              <th className="px-5 py-3 font-semibold">Formats</th>
              <th className="px-5 py-3 text-right font-semibold">CPM from</th>
              <th className="px-5 py-3 text-right font-semibold">CPC from</th>
              <th className="px-5 py-3 font-semibold">How to buy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {SPEC_ROWS.map((r) => (
              <tr key={r.key} data-testid={`spec-row-${r.key}`}>
                <td className="px-5 py-4 font-medium">
                  {r.label}
                  {r.inquire ? <InquireBadge /> : null}
                </td>
                <td className="px-5 py-4 text-muted-foreground">{r.moment}</td>
                <td className="px-5 py-4 text-muted-foreground">{r.unit}</td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">Display · CPC</td>
                <td className="px-5 py-4 text-right font-display text-xl tabular-nums">${r.cpmFloorUsd}</td>
                <td className="px-5 py-4 text-right tabular-nums">${r.cpcFloorUsd.toFixed(2)}</td>
                <td className="px-5 py-4">{r.inquire ? "Inquiry → IO" : <>Card <span className="whitespace-nowrap">($190 / $490 USD)</span> or IO</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-2 text-[11px] leading-relaxed text-muted-foreground md:grid-cols-2">
        <p>
          USD starting rates <Tag>Estimate</Tag> Illustrative planning estimates, not sold rates or measured delivery. Rates step up only once reporting shows a placement performs. Motion :15 is also available as a format on the IO.
        </p>
        <p data-testid="sell-assumption">
          <Tag>Assumption</Tag> {SELL_ASSUMPTION_LINE} Post-Purchase, 100K+ view blocks and any exclusive category or area lock are inquire-only.
        </p>
      </div>
    </div>
  );
}

function Card({ k, title, children, testId }: { k: string; title: string; children: ReactNode; testId?: string }) {
  return (
    <article className="flex flex-col border border-foreground/15 bg-white p-6 md:p-7" data-testid={testId}>
      <Kicker>{k}</Kicker>
      <h3 className="mt-2 font-display text-2xl leading-tight">{title}</h3>
      <div className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">{children}</div>
    </article>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[12px_1fr] gap-2">
          <span aria-hidden className="mt-2 h-px w-2.5 bg-foreground/50" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** Audience & targeting, measurement & reporting, brand safety. */
export function InsiderGrid() {
  const verticals = POSITIONING.recoveryBrandVerticals.map((v) => (v.inQueue ? `${v.label} (in queue)` : v.label)).join(", ");
  return (
    <div className="grid gap-px border border-foreground/15 bg-foreground/15 lg:grid-cols-3" data-testid="insider-grid">
      <Card k="01 · Audience & targeting" title="Members in a buying moment." testId="insider-audience">
        <Bullets
          items={[
            <>Co-branded Recovery Brand hubs: {verticals}.</>,
            <>{POSITIONING.businessHubs}.</>,
            <>Target by hub, by advertiser category, by placement, and by moment: after checkout, while browsing, or behind login.</>,
            <>Local reach: a 5 km area around a postal code, by inquiry.</>,
          ]}
        />
      </Card>
      <Card k="02 · Measurement & reporting" title="Reported per hub and surface." testId="insider-measurement">
        <Bullets
          items={[
            <>Views, clicks, UTM-tagged visits and promo-code redemptions, per hub and per surface.</>,
            <>Your UTM parameters on every placement; a promo code if you want one.</>,
            <>Pre-flight view estimates are modelled and labelled that way. Campaign results come from your UTMs and codes.</>,
            <>Aggregate reporting only.</>,
          ]}
        />
      </Card>
      <Card k="03 · Brand safety" title="Closed, co-branded environments." testId="insider-safety">
        <Bullets
          items={[
            <>Ads run only inside co-branded hubs, not on an open exchange. Fixed price, no auction.</>,
            <>The IO names the hub and surface before anything runs. Creative and exact position are set on the IO.</>,
            <>No patient or personal health data. No clinical pixels. Aggregate reporting only.</>,
            <>After the IO, cancellation and makegoods follow IAB.</>,
            <>No guarantees of reach, clicks or sales.</>,
          ]}
        />
      </Card>
    </div>
  );
}

const IO_STEPS = [
  { t: "Brief", d: "Send the client and picks through the agency form or a quick-buy inquiry. Small tests can start self-serve on the $190 USD look or the $490 USD reserve." },
  { t: "Draft IO", d: "We reply with hub fit and a draft insertion order naming the hub, surface, format, category and dates." },
  { t: "Sign & prepay", d: "Seats pay by card. Post-Purchase, 100K+ view blocks and exclusive locks go on the IO by inquiry." },
  { t: "Traffic", d: "Creative, UTMs and an optional promo code. Exact position is confirmed on the IO." },
  { t: "Flight", d: `Credit spends down on live hubs over the ${SPEND_DOWN_MONTHS} months after the deposit lands.` },
  { t: "Report", d: "Per-hub, per-surface reporting. The $490 USD seat is fully refundable until 14 days before the launch date on the IO." },
];

export function IoProcess() {
  return (
    <div data-testid="io-process">
      <ol className="grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-6">
        {IO_STEPS.map((s, i) => (
          <li key={s.t} className="bg-background p-5">
            <span className="font-display text-sm tabular-nums text-foreground/50">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-1 font-display text-xl">{s.t}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Cta href="/sample-io" variant="line" testId="io-sample">Read the sample IO</Cta>
        <Cta href="/agencies#talk" variant="ink" testId="io-agency">Request a draft IO</Cta>
      </div>
    </div>
  );
}

/** How the discount works: the stated share, worked examples, and marked placeholders. */
export function AgencyPayouts() {
  const { currency, prices } = useCurrency();
  const cur = currency === "cad" ? "CAD" : "USD";
  const rows = agencyPayoutRows(priceFor("reserve-490", currency, prices), cur);
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" data-testid="agency-payouts">
      <div>
        <p className="font-display text-7xl leading-none tabular-nums md:text-8xl">
          {AGENCY_SHARE.pct}%
        </p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/80">{AGENCY_SHARE.line}</p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{BRAND_BONUS_LINE}</p>
      </div>
      <div className="border border-foreground/15 bg-white" data-currency-fixed data-testid="agency-payout-table">
        <table className="w-full border-collapse text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-foreground/80 text-[11px] uppercase tracking-wider text-foreground/60">
              <th className="px-4 py-3 font-semibold md:px-5">Client buy</th>
              <th className="px-4 py-3 text-right font-semibold md:px-5">Prepaid ({cur})</th>
              <th className="px-4 py-3 text-right font-semibold md:px-5">Agency pays ({cur})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((e) => (
              <tr key={e.key} data-testid={`agency-payout-${e.key}`}>
                <td className="px-4 py-3 md:px-5">{e.label}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right md:px-5">{e.spend}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold md:px-5">{e.pays}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="divide-y divide-border border-t border-foreground/15 text-sm" data-testid="agency-payout-terms">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
            <dt className="text-foreground/75">Discount</dt>
            <dd className="font-semibold">Written 10% off list</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
            <dt className="text-foreground/75">When</dt>
            <dd className="font-semibold">{AGENCY_SHARE.timing}</dd>
          </div>
        </dl>
        <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground md:px-5">Written {AGENCY_SHARE.pct}% discount off the published rate card. Examples use prices already on the site. What you charge the client is yours.</p>
      </div>
    </div>
  );
}

/** Two ways to buy (Nov 24 2026): card (self-serve) vs insertion order (managed), same rows side by side. */
type BuyPathCol = { key: string; kicker: string; price: string; sub: string };
type BuyPathData = { card: BuyPathCol; io: BuyPathCol; rows: ReadonlyArray<{ k: string; card: string; io: string }> };
const AGENCY_BUY_LABELS = { reserve: "Reserve for a client · $490 USD", look: "or the $190 USD 7-day look", io: "Request a draft IO" };

/** Card vs IO compare. Defaults to the /agencies copy; /media-buyers passes its own data (no agency row) and labels. */
export function BuyPaths({ reserveHref, lookHref, ioHref = "#talk", paths = BUY_PATHS, labels = AGENCY_BUY_LABELS, testId = "agency-buy-paths" }: { reserveHref: string; lookHref: string; ioHref?: string; paths?: BuyPathData; labels?: typeof AGENCY_BUY_LABELS; testId?: string }) {
  const cols = [paths.card, paths.io] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid={testId}>
      {cols.map((c) => {
        const card = c.key === "card";
        return (
          <article key={c.key} data-testid={`buy-path-${c.key}`} className={`flex flex-col bg-white p-5 md:p-6 ${card ? "border-2 border-foreground" : "border border-foreground/20"}`}>
            <Kicker>{c.kicker}</Kicker>
            <p className="mt-2 font-display text-4xl leading-none tabular-nums">{c.price}</p>
            <p className="mt-2 text-sm text-foreground/70">{c.sub}</p>
            <dl className="mt-5 divide-y divide-border border-y border-border text-sm">
              {paths.rows.map((r) => (
                <div key={r.k} className="grid grid-cols-[6.25rem_1fr] gap-3 py-2.5 md:grid-cols-[7.5rem_1fr]">
                  <dt className="text-foreground/60">{r.k}</dt>
                  <dd className="font-medium">{card ? r.card : r.io}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex flex-col gap-2 sm:mt-auto sm:pt-5">
              {card ? (
                <>
                  <Cta href={reserveHref} variant="lime" testId="buy-path-reserve" className="w-full">{labels.reserve}</Cta>
                  <a href={lookHref} data-testid="buy-path-look" className="text-center text-sm font-semibold underline underline-offset-2">{labels.look}</a>
                </>
              ) : (
                <>
                  {/* Design (PR #433 carried, Nov 25): a matching secondary link keeps both buttons on one line at desktop. */}
                  <Cta href={ioHref} variant="ink" testId="buy-path-io" className="w-full">{labels.io}</Cta>
                  <a href="/sample-io" data-testid="buy-path-sample-io" className="text-center text-sm font-semibold underline underline-offset-2">or read the sample IO first</a>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/**
 * Inventory canister (Randy, Nov 24 2026 12:57 PM ET, t543u): one tank of hub inventory, three outlets for the three
 * buyer types. Pure CSS grid (no image), so each band lines up with its outlet at any width. List price = the live ladder.
 */
const TIER_STYLE: Record<AgencyTierKey, { band: string; card: string; dot: string }> = {
  direct: { band: "bg-[#e7ecf3]", card: "border-[#0b1f3a]/20 bg-white", dot: "bg-[#0b1f3a]/40" },
  agency: { band: "bg-[#0b1f3a]", card: "border-[#0b1f3a] bg-white", dot: "bg-[#0b1f3a]" },
  exclusive: { band: "bg-lime-300", card: "border-[#0b1f3a] bg-lime-100", dot: "bg-lime-500" },
};

export const LIST_PRICE_HREF = "/media-kit#start-small";

export function ListPriceLine({ className = "" }: { className?: string }) {
  const steps = priceLadder("usd");
  const short: Record<string, string> = { "hold-190": "7-day look", "reserve-490": "reserve", exclusive: "exclusive reserve" };
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 text-[13px] text-foreground/70 ${className}`} data-testid="agency-list-price">
      <b className="mr-1 text-[#0b1f3a]">List price =</b>
      {steps.map((s) => (
        <span key={s.key} className="rounded-full border border-[#0b1f3a]/20 bg-white px-2.5 py-1"><b className="text-[#0b1f3a]">{s.price}</b> {short[s.key] ?? s.name}</span>
      ))}
      <a href={LIST_PRICE_HREF} className="ml-1 font-semibold text-[#0b1f3a] underline underline-offset-2">See the ladder</a>
    </div>
  );
}

export function InventoryCanister() {
  const n = AGENCY_TIERS.length;
  return (
    <figure className="mx-auto w-full max-w-3xl" data-testid="agency-canister" aria-label="One tank of hub inventory with three outlets: direct brands, agencies and exclusive inventory partners">
      <div className="grid grid-cols-[4.25rem_1.25rem_minmax(0,1fr)] md:grid-cols-[8.5rem_3.5rem_minmax(0,1fr)]">
        {/* Lid + label */}
        <div className="col-start-1 flex flex-col items-center">
          <span className="mb-1 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-[#0b1f3a]/70 md:text-[11px]">Hub inventory</span>
          <span className="block h-4 w-full rounded-[50%] border-2 border-[#0b1f3a] bg-white md:h-6" aria-hidden />
        </div>
        <span className="col-span-2" aria-hidden />
        {AGENCY_TIERS.map((t, i) => {
          const st = TIER_STYLE[t.key];
          const last = i === n - 1;
          return (
            <div key={t.key} className="contents" data-testid={`canister-${t.key}`}>
              <div className={`col-start-1 -mt-2 flex items-center justify-center border-x-2 border-[#0b1f3a] pt-2 md:-mt-3 md:pt-3 ${st.band} ${last ? "rounded-b-[1.75rem] border-b-2 md:rounded-b-[3rem]" : "border-b border-b-[#0b1f3a]/25"}`}>
                <span className={`font-display text-2xl md:text-4xl ${t.key === "agency" ? "text-white" : "text-[#0b1f3a]"}`}>{i + 1}</span>
              </div>
              <div className="relative flex items-center" aria-hidden>
                <span className="block h-[3px] w-full bg-[#0b1f3a]" />
                <span className={`absolute right-0 size-2.5 rounded-full md:size-3 ${st.dot} ring-2 ring-white`} />
              </div>
              <div className={`my-1.5 rounded-xl border-2 p-3 md:my-2 md:p-4 ${st.card}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-display text-lg leading-tight text-[#0b1f3a] md:text-2xl">{t.name}</p>
                  {t.badge ? <span className="rounded-full bg-[#0b1f3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">{t.badge}</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] md:text-[13px]">
                  <span className="rounded-full border border-[#0b1f3a]/25 bg-white px-2.5 py-1 font-semibold text-[#0b1f3a]">Pay: {t.pay.charAt(0).toLowerCase() + t.pay.slice(1)}{t.key === "exclusive" ? "*" : ""}</span>
                  {t.key === "direct" ? null : <span className="rounded-full bg-[#0b1f3a] px-2.5 py-1 font-semibold text-white">{t.keep}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3"><ListPriceLine /></figcaption>
    </figure>
  );
}

/** Three tier cards under the canister. Brands + agencies go to the existing checkout; exclusive partners send a bid. */
export function AgencyTierCards({ reserveHref, buyHref, bidHref = "#talk", ioHref = "#talk" }: { reserveHref: string; buyHref: string; bidHref?: string; ioHref?: string }) {
  const io = `$${AGENCY_CLIENT_TEST.lo / 1000}K–$${AGENCY_CLIENT_TEST.hi / 1000}K USD`;
  return (
    <div className="grid gap-4 md:grid-cols-3" data-testid="agency-tier-cards">
      {AGENCY_TIERS.map((t, i) => {
        const st = TIER_STYLE[t.key];
        return (
          <article key={t.key} data-testid={`tier-${t.key}`} className={`flex flex-col rounded-2xl border-2 p-5 ${st.card}`}>
            <div className="flex items-center justify-between gap-2">
              <Kicker>{`Tier ${i + 1}`}</Kicker>
              {t.badge ? <span className="rounded-full bg-[#0b1f3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">{t.badge}</span> : null}
            </div>
            <h3 className="mt-1 font-display text-2xl leading-tight text-[#0b1f3a]">{t.name}</h3>
            <p className="mt-1 text-sm text-foreground/70">{t.who}</p>
            <dl className="mt-4 divide-y divide-[#0b1f3a]/10 border-y border-[#0b1f3a]/10 text-sm">
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-2"><dt className="text-foreground/60">You pay</dt><dd className="font-semibold text-[#0b1f3a]">{t.pay}</dd></div>
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 py-2"><dt className="text-foreground/60">You get</dt><dd className="font-semibold text-[#0b1f3a]">{t.keep}</dd></div>
            </dl>
            <div className="mt-5 flex flex-col gap-2 md:mt-auto md:pt-5">
              {t.key === "direct" ? (
                <Cta href={buyHref} variant="line" testId="tier-direct-cta" className="w-full">Buy ads now</Cta>
              ) : t.key === "agency" ? (
                <>
                  <Cta href={reserveHref} variant="ink" testId="tier-agency-cta" className="w-full">Reserve for a client · $490 USD</Cta>
                  <a href={ioHref} data-testid="tier-agency-io" className="text-center text-[13px] font-semibold text-[#0b1f3a] underline underline-offset-2">or a {io} client test on an insertion order (IO)</a>
                </>
              ) : (
                <Cta href={bidHref} variant="ink" testId="tier-exclusive-cta" className="w-full">Send a bid or interest</Cta>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** "What exclusive partners get" (Randy t8307u). The prior example card is unlinked for now (Randy t552u). */
export function ExclusivePerks() {
  return (
    <details open className="group rounded-2xl border-2 border-[#0b1f3a] bg-white" data-testid="exclusive-perks" id="exclusive-partners">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-[#0b1f3a] md:px-5 [&::-webkit-details-marker]:hidden">
        <span>* What exclusive partners get</span>
        <ChevronDown className="size-5 shrink-0 transition group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="space-y-2.5 border-t border-[#0b1f3a]/15 p-4 text-sm text-foreground/80 md:p-5">
        {EXCLUSIVE_PARTNER_PERKS.map((p) => (
          <li key={p} className="flex gap-2"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-lime-500" aria-hidden />{skinText(p)}</li>
        ))}
        <li className="pt-1 text-[12px] text-foreground/60">Partners buy at the same written 10% discount off the published rate card.</li>
      </ul>
    </details>
  );
}

/** Two buyer lanes + six ground rules + the published rate-card ladder (Randy, Nov 24 2026). */
export function AgencyRateCardModel() {
  return (
    <div data-testid="agency-rate-card-model">
      <div className="grid gap-px border border-foreground bg-foreground md:grid-cols-2">
        <article className="bg-background p-6 md:p-8" data-testid="lane-direct">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Direct buyers</p>
          <h3 className="mt-3 font-display text-3xl leading-tight text-foreground md:text-4xl">Pay the rate card.</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">A brand buying space for itself pays the published list price. No agency discount.</p>
        </article>
        <article className="bg-foreground p-6 text-background md:p-8" data-testid="lane-agency">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-background/55">Agencies, brokers &amp; resellers</p>
          <h3 className="mt-3 font-display text-3xl leading-tight md:text-4xl">{AGENCY_DISCOUNT_PCT}% off, in writing.</h3>
          <p className="mt-3 text-sm leading-relaxed text-background/75">{AGENCY_RATE_CARD.line} {AGENCY_RATE_CARD.resale} {AGENCY_RATE_CARD.disclosure}</p>
        </article>
      </div>
      <ol className="mt-6 grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-3" data-testid="agency-rate-rules">
        {AGENCY_RATE_RULES.map((r, i) => (
          <li key={r.k} className="bg-background p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
            <p className="mt-2 font-display text-xl leading-tight text-foreground">{r.k}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5"><ListPriceLine /></div>
    </div>
  );
}

/** Illustrative $10,000 USD worked example of the 10% written discount. */
export function AgencyDiscountExample() {
  const e = AGENCY_DISCOUNT_EXAMPLE;
  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
  const rows = [
    { k: "Rate card", n: usd(e.list) },
    { k: "Written 10% discount", n: `−${usd(e.discount)}` },
    { k: "Agency pays", n: usd(e.agencyPays), accent: true },
  ] as const;
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" data-testid="agency-discount-example">
      <div>
        <span className="inline-block border border-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]" data-testid="agency-illustrative">Illustrative example</span>
        <p className="mt-5 font-display text-6xl leading-none tracking-tight text-foreground md:text-7xl">{e.discountPct}%</p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/80">{AGENCY_RATE_CARD.line}</p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{AGENCY_RATE_CARD.resale} {AGENCY_RATE_CARD.disclosure} {AGENCY_RATE_CARD.noUndercut}</p>
      </div>
      <div className="border border-foreground bg-foreground text-background">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-4 border-b border-background/15 px-5 py-4 last:border-b-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-background/60">{r.k}</span>
            <span className={`font-display text-3xl leading-none tabular-nums md:text-4xl ${"accent" in r && r.accent ? "text-accent" : ""}`}>{r.n}</span>
          </div>
        ))}
        <p className="border-t border-background/15 px-5 py-3 text-[12px] leading-snug text-background/65">{e.note}</p>
      </div>
    </div>
  );
}
