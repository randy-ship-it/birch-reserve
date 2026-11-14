/**
 * Agency-first home sections (Nov 12 2026, Randy via Emma 7:34 PM ET).
 * Numbers come only from api-server/src/lib/overhaul/agencyShowcase.ts, which re-uses
 * figures already on the site. Views are modelled; placeholders render as placeholders.
 */
import type { ReactNode } from "react";
import { Cta } from "./ui";
import { InquireBadge } from "./quick-buy";
import {
  AGENCY_EXAMPLES,
  AGENCY_SHARE,
  BRAND_BONUS_LINE,
  INVENTORY_LINE,
  SELL_ASSUMPTION_LINE,
  SELL_ASSUMPTION_PCT,
  SPEC_ROWS,
  SPEND_DOWN_MONTHS,
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
              Agencies: place a client inside the health hubs. <em className="not-italic text-foreground/55">Keep {AGENCY_SHARE.pct}% of the spend.</em>
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
                { v: TAM.ordersLabel, l: "orders being onboarded", t: "Modelled" },
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
                <span className="text-background/70">Agency of record earns, in cash</span>
                <span className="text-right font-semibold text-accent">{usd(ex.cash)}</span>
              </div>
            </div>
            <ul className="mt-6 space-y-2 border-t border-background/15 pt-5 text-sm text-background/80">
              <li>{AGENCY_SHARE.timing}</li>
              <li>One prepay can be split across clients; each client gets its own IO and reporting.</li>
              <li className="text-background/60">{BRAND_BONUS_LINE}</li>
            </ul>
            <a href="#agency-payouts" className="mt-6 inline-block text-sm text-background/70 underline underline-offset-4 hover:text-background">
              How agency payouts work
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
                <td className="px-5 py-4">{r.inquire ? "Inquiry → IO" : <>Card <span className="whitespace-nowrap">($190 / $490)</span> or IO</>}</td>
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
            <>{TAM.ordersLabel} orders being onboarded <Tag>Modelled</Tag></>,
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
            <>Pre-flight views are modelled from the TAM feed (scalehealth.ca/tam) and labelled that way. Campaign results come from your UTMs and codes.</>,
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
  { t: "Brief", d: "Send the client and picks through the agency form or a quick-buy inquiry. Small tests can start self-serve on the $190 look or the $490 reserve." },
  { t: "Draft IO", d: "We reply with hub fit and a draft insertion order naming the hub, surface, format, category and dates." },
  { t: "Sign & prepay", d: "Seats pay by card. Post-Purchase, 100K+ view blocks and exclusive locks go on the IO by inquiry." },
  { t: "Traffic", d: "Creative, UTMs and an optional promo code. Exact position is confirmed on the IO." },
  { t: "Flight", d: `Credit spends down on live hubs over the ${SPEND_DOWN_MONTHS} months after the deposit lands.` },
  { t: "Report", d: "Per-hub, per-surface reporting. The $490 seat is fully refundable until 14 days before the launch date on the IO." },
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

/** How agency payouts work: the stated share, worked examples, and marked placeholders. */
export function AgencyPayouts() {
  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]" data-testid="agency-payouts">
      <div>
        <p className="font-display text-7xl leading-none tabular-nums md:text-8xl">
          {AGENCY_SHARE.pct}%
        </p>
        <p className="mt-4 max-w-md text-base leading-relaxed text-foreground/80">{AGENCY_SHARE.line}</p>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{BRAND_BONUS_LINE}</p>
      </div>
      <div className="border border-foreground/15 bg-white">
        <table className="w-full border-collapse text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b border-foreground/80 text-[11px] uppercase tracking-wider text-foreground/60">
              <th className="px-4 py-3 font-semibold md:px-5">Client buy</th>
              <th className="px-4 py-3 text-right font-semibold md:px-5">Prepaid</th>
              <th className="px-4 py-3 text-right font-semibold md:px-5">Agency cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {AGENCY_EXAMPLES.map((e) => (
              <tr key={e.label}>
                <td className="px-4 py-3 md:px-5">{e.label}</td>
                <td className="px-4 py-3 text-right md:px-5">{usd(e.spend)}</td>
                <td className="px-4 py-3 text-right font-semibold md:px-5">
                  {usd(e.cash)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="divide-y divide-border border-t border-foreground/15 text-sm" data-testid="agency-payout-terms">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
            <dt className="text-foreground/75">Paid in</dt>
            <dd className="font-semibold">Cash</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
            <dt className="text-foreground/75">When</dt>
            <dd className="font-semibold">{AGENCY_SHARE.timing}</dd>
          </div>
        </dl>
        <p className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground md:px-5">{AGENCY_SHARE.pct}% of media spend, paid in cash to the agency of record. Examples use prices already on the site.</p>
      </div>
    </div>
  );
}
