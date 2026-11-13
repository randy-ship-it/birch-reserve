/**
 * Rate card v2 blocks (Nov 12 2026): Meta hook, 5-surface rate card, view-block
 * pack picker, scenario calculator, prove-it-then-raise ladder, seat CTAs.
 * All numbers come from api-server/src/lib/overhaul/pricing.ts and are
 * labelled illustrative estimates. Checkout stays on the existing /buycalc flow.
 */
import { useMemo, useState } from "react";
import { trackCta } from "@/lib/track-cta";
import {
  BLENDED,
  CHANNEL_BENCHMARKS,
  ESTIMATE_NOTE,
  META_CPM,
  RATE_SURFACES,
  SCENARIO_STOPS,
  VIEW_BLOCKS,
  bundleDiscountPct,
  fmtRange,
  fmtUsd,
  fmtViews,
  quotePack,
  scenario,
  type RateSurface,
} from "../../../../api-server/src/lib/overhaul/pricing";
import { Cta } from "./ui";
import { isPremiumViewBlock } from "../../../../api-server/src/lib/premiumInquireOnly";
import { InquireBadge } from "./quick-buy";
import { PlacementDialog, PlacementTrigger, type PlacementKey } from "./placement-example";

export const RESERVE_HREF = "/buycalc?sku=reserve-490#reserve";
export const LOOK_HREF = "/buycalc?sku=hold-190#reserve";

export function Estimate({ children = "Illustrative estimate" }: { children?: string }) {
  return (
    <span
      className="ml-1 inline-flex items-center border border-current px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider opacity-80"
      title={ESTIMATE_NOTE}
    >
      {children}
    </span>
  );
}

/** Primary seat CTAs: the existing Stripe checkout ($490 category prepay, $190 7-day look). */
export function SeatCtas({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      <Cta href={RESERVE_HREF} testId="cta-reserve-490" onClick={() => trackCta("cta_reserve_490", { offer: "reserve-490" })}>
        Reserve my category · $490 credit
      </Cta>
      <Cta
        href={LOOK_HREF}
        variant={tone === "dark" ? "lineDark" : "line"}
        testId="cta-hold-190"
        onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })}
      >
        7-day look · $190
      </Cta>
    </div>
  );
}

/** Near-hero hook: Meta CPM vs hub starter CPM. */
export function MetaHook() {
  const landing = RATE_SURFACES[0]!;
  const post = RATE_SURFACES[4]!;
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center" data-testid="meta-hook">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Same people. Half the price.</p>
        <h2 className="font-display text-3xl leading-tight tracking-tight text-background md:text-5xl">
          You&apos;re already paying Meta {fmtRange(META_CPM)} CPM for cold recovery audiences.
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-background/75">
          Reach the same people already inside the recovery hub, one brand per category, starting at roughly half the price.
        </p>
        <SeatCtas tone="dark" className="mt-8" />
        <a href="#rates" className="mt-4 inline-block text-sm text-background/70 underline underline-offset-4 hover:text-background">
          See every rate first
        </a>
      </div>
      <div className="border border-background/20 p-5 md:p-7">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-background/55">Meta, health &amp; wellness</p>
            <p className="mt-1 font-display text-4xl text-background/80 md:text-5xl">{fmtRange(META_CPM)}</p>
            <p className="text-xs text-background/55">CPM, cold audience, auction</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Birch hubs, starting at</p>
            <p className="mt-1 font-display text-4xl text-accent md:text-5xl">~${BLENDED.starterCpm}</p>
            <p className="text-xs text-background/55">blended CPM, members inside the hub</p>
          </div>
        </div>
        <div className="mt-6 space-y-2 border-t border-background/15 pt-4 text-sm text-background/80">
          <p>Landing pages from <b className="text-background">${landing.cpmStarter[0]} CPM</b>. Post-purchase from <b className="text-background">${post.cpmStarter[0]} CPM</b>.</p>
          <p>Category exclusive: one brand per recovery category, fixed price, no auction.</p>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-background/50">
          <Estimate /> {ESTIMATE_NOTE}
        </p>
      </div>
    </div>
  );
}

/** Five-surface rate card: starter ranges only (no later-rate numbers in public copy). */
export function RateCardV2() {
  const [ex, setEx] = useState<PlacementKey | null>(null);
  return (
    <div data-testid="rate-card-v2">
      <p className="mb-3 text-xs text-muted-foreground">Tap or hover a surface to see an example placement inside a hub.</p>
      {/* Mobile: one card per surface */}
      <div className="grid gap-3 md:hidden">
        {RATE_SURFACES.map((s) => (
          <article key={s.key} onClick={() => setEx(s.key)} className="cursor-pointer border border-foreground/15 bg-white p-4 transition-colors active:bg-muted/60">
            <h3 className="font-display text-xl"><PlacementTrigger k={s.key} onOpen={setEx}>{s.label}</PlacementTrigger></h3>
            <p className="mt-1 text-xs text-muted-foreground">{s.where}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Starting at</dt>
                <dd className="font-semibold">${s.cpmStarter[0]} CPM</dd>
                <dd className="text-xs text-muted-foreground">${s.cpcStarter[0].toFixed(2)} CPC</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-foreground/55">Starter range</dt>
                <dd className="text-foreground/70">{fmtRange(s.cpmStarter)} CPM</dd>
                <dd className="text-xs text-muted-foreground">{fmtRange(s.cpcStarter, 2)} CPC</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="py-3 pr-4 font-semibold">Surface</th>
              <th className="py-3 pr-4 font-semibold">Display, starting at</th>
              <th className="py-3 pr-4 font-semibold">CPC, starting at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {RATE_SURFACES.map((s) => (
              <tr key={s.key} onClick={() => setEx(s.key)} className="cursor-pointer transition-colors hover:bg-muted/50">
                <td className="py-4 pr-4">
                  <PlacementTrigger k={s.key} onOpen={setEx} className="font-medium">{s.label}</PlacementTrigger>
                  <span className="block text-xs text-muted-foreground">{s.where}</span>
                </td>
                <td className="py-4 pr-4">
                  <span className="font-display text-2xl">${s.cpmStarter[0]}</span> <span className="text-xs text-muted-foreground">CPM (fill range {fmtRange(s.cpmStarter)})</span>
                </td>
                <td className="py-4 pr-4">
                  <span className="font-semibold">${s.cpcStarter[0].toFixed(2)}</span> <span className="text-xs text-muted-foreground">({fmtRange(s.cpcStarter, 2)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        USD. <Estimate /> {ESTIMATE_NOTE} Starter rates apply while a placement is new; rates may step up only after campaign reporting shows the placement performs.
      </p>
      <PlacementDialog open={ex} onClose={() => setEx(null)} />
    </div>
  );
}

/** View-block pack picker: surfaces × block size → "starting at" price, bundle discount, CTAs. */
export function PackPicker() {
  const [keys, setKeys] = useState<RateSurface["key"][]>(["landing", "products"]);
  const [block, setBlock] = useState<number>(250_000);
  const q = useMemo(() => quotePack(keys, block), [keys, block]);
  const metaMid = (q.metaUsd[0] + q.metaUsd[1]) / 2;
  const savePct = metaMid > 0 ? Math.round((1 - q.startingUsd / metaMid) * 100) : 0;
  const toggle = (k: RateSurface["key"]) => setKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const ioHref = `mailto:sales@silverbirchgrowth.com?subject=${encodeURIComponent("Birch Reserve IO request")}&body=${encodeURIComponent(
    `Pack: ${fmtViews(block)} views on ${keys.length} surface(s) (${RATE_SURFACES.filter((s) => keys.includes(s.key)).map((s) => s.short).join(", ")}).\nStarting estimate: ${fmtUsd(q.startingUsd)} USD.\nBrand / category:\nTiming:\n`,
  )}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]" data-testid="pack-picker">
      <div className="border border-foreground/15 bg-white p-5 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">1. Pick surfaces</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Surfaces">
          {RATE_SURFACES.map((s) => {
            const on = keys.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                className={`min-h-11 border px-3.5 py-2 text-sm font-semibold transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-foreground/25 bg-white hover:border-foreground"}`}
                data-testid={`pack-surface-${s.key}`}
              >
                {s.short} <span className="font-normal opacity-70">${s.cpmStarter[0]}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-foreground/60">2. Views per surface</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="View block">
          {VIEW_BLOCKS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={block === b}
              onClick={() => setBlock(b)}
              className={`min-h-12 border text-base font-semibold transition-colors ${block === b ? "border-foreground bg-accent text-accent-foreground" : "border-foreground/25 bg-white hover:border-foreground"}`}
              data-testid={`pack-block-${b}`}
            >
              {fmtViews(b)}
              {isPremiumViewBlock(b) ? <InquireBadge /> : null}
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Bundles: 2 surfaces {bundleDiscountPct(2)}% off · 3 surfaces {bundleDiscountPct(3)}% off · 4+ surfaces {bundleDiscountPct(4)}% off.
        </p>
      </div>
      <div className="flex flex-col border border-foreground bg-foreground p-5 text-background md:p-7" aria-live="polite" data-testid="pack-quote">
        <p className="text-xs font-semibold uppercase tracking-wider text-background/60">Your pack, starting at</p>
        {keys.length ? (
          <>
            <p className="mt-2 font-display text-5xl text-accent">{fmtUsd(q.startingUsd)}</p>
            <p className="mt-1 text-sm text-background/70">
              {fmtViews(q.views)} views · ~${q.effectiveCpm.toFixed(2)} CPM{q.discountPct ? ` · ${q.discountPct}% bundle discount` : ""}
            </p>
            <dl className="mt-5 space-y-2 border-t border-background/15 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-background/60">Same views on Meta</dt>
                <dd>{fmtUsd(q.metaUsd[0])}–{fmtUsd(q.metaUsd[1])}</dd>
              </div>
              {savePct > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-background/60">Vs Meta midpoint</dt>
                  <dd className="font-semibold text-accent">~{savePct}% less</dd>
                </div>
              ) : null}
            </dl>
          </>
        ) : (
          <p className="mt-2 text-sm text-background/70">Pick at least one surface.</p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {/* View blocks are in PREMIUM_INQUIRE_ONLY: the pack itself is never paid by card. */}
          {isPremiumViewBlock(block) ? (
            <Cta href={`/?inquire=pack&block=${block}&surfaces=${encodeURIComponent(keys.join(","))}#quick-buy`} testId="pack-inquire">
              Send inquiry
            </Cta>
          ) : (
            <Cta href={ioHref} testId="pack-io">
              {q.needsIo ? "Request an IO for this pack" : "Get this pack on an IO"}
            </Cta>
          )}
          <Cta href={RESERVE_HREF} variant="lineDark" testId="pack-reserve" onClick={() => trackCta("cta_reserve_490", { offer: "reserve-490" })}>
            Start with a $490 category prepay
          </Cta>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-background/50">
          The $490 prepay holds your category and is all media credit toward the pack. Starter rates hold for your first period; rates may step up later only once a placement proves out. <Estimate /> The IO sets the final rate.
        </p>
      </div>
    </div>
  );
}

/** Scenario calculator: views slider (100k → 1B), blended starter vs Meta (starter only). */
export function ScenarioCalculator() {
  const [i, setI] = useState(3);
  const views = SCENARIO_STOPS[i]!;
  const s = scenario(views);
  const max = s.metaUsd[1] || 1;
  const bars: Array<{ label: string; lo: number; hi: number; tone: string }> = [
    { label: "Meta, same views", lo: s.metaUsd[0], hi: s.metaUsd[1], tone: "bg-foreground/35" },
    { label: "Birch starter", lo: s.starterUsd, hi: s.starterUsd, tone: "bg-accent" },
  ];
  const scaleMax = max;
  return (
    <div className="border border-foreground/15 bg-white p-5 md:p-8" data-testid="scenario-calculator">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Views</p>
          <p className="font-display text-5xl" data-testid="scenario-views">{fmtViews(views)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Birch starter estimate</p>
          <p className="font-display text-5xl text-foreground" data-testid="scenario-starter">{fmtUsd(s.starterUsd)}</p>
        </div>
      </div>
      <label className="mt-6 block">
        <span className="sr-only">Views</span>
        <input
          type="range"
          min={0}
          max={SCENARIO_STOPS.length - 1}
          step={1}
          value={i}
          onChange={(e) => setI(Number(e.target.value))}
          className="h-11 w-full accent-[hsl(var(--foreground))]"
          aria-valuetext={`${fmtViews(views)} views`}
          data-testid="scenario-slider"
        />
      </label>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>100k</span>
        <span>1M</span>
        <span>100M</span>
        <span>1B</span>
      </div>
      <div className="mt-6 space-y-3">
        {bars.map((b) => (
          <div key={b.label} className="grid grid-cols-[110px_1fr] items-center gap-3 text-sm md:grid-cols-[150px_1fr_130px]">
            <span className="font-medium">{b.label}</span>
            <span className="relative h-4 bg-secondary">
              <span className={`absolute inset-y-0 left-0 ${b.tone}`} style={{ width: `${Math.max(1.5, (b.hi / scaleMax) * 100)}%`, opacity: b.lo === b.hi ? 1 : 0.85 }} />
            </span>
            <span className="col-start-2 text-xs text-muted-foreground md:col-start-auto md:text-right md:text-sm md:text-foreground">
              {b.lo === b.hi ? fmtUsd(b.lo) : `${fmtUsd(b.lo)}–${fmtUsd(b.hi)}`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Straight-line illustration at ~${BLENDED.starterCpm} blended starter CPM and Meta at {fmtRange(META_CPM)}. <Estimate /> Not a forecast of available inventory or delivery; large volumes are sold on an IO against live hub supply.
      </p>
    </div>
  );
}

/** Prove-it-then-raise explainer. */
export function ProveItLadder() {
  const steps = [
    { n: "1", t: "Start at starter rates", d: "Your first period runs at the starting-at rates above. Hold your category with the $490 prepay, all of it media credit." },
    { n: "2", t: "We report, you judge", d: "Views, clicks, UTM-tagged visits and promo-code redemptions per hub and surface. Aggregate only, no patient data." },
    { n: "3", t: "Rates rise only when it's proven", d: "A placement's rate can step up only after reporting shows it performs. Your locked deposit keeps its rate for its term." },
  ];
  return (
    <ol className="grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-3" data-testid="prove-it-ladder">
      {steps.map((s) => (
        <li key={s.n} className="bg-background p-6 md:p-8">
          <span className="inline-flex size-9 items-center justify-center bg-accent font-display text-lg text-accent-foreground">{s.n}</span>
          <h3 className="mt-4 font-display text-2xl">{s.t}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

/** Channel benchmark ranges (planning estimates). */
export function ChannelBenchmarks() {
  return (
    <div className="overflow-x-auto" data-testid="channel-benchmarks">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b-2 border-foreground">
            <th className="py-3 pr-4 font-semibold">Channel</th>
            <th className="py-3 pr-4 font-semibold">CPM</th>
            <th className="py-3 font-semibold">CPC</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {CHANNEL_BENCHMARKS.map((c) => (
            <tr key={c.key}>
              <td className="py-3 pr-4 font-medium">{c.label}</td>
              <td className="py-3 pr-4 text-muted-foreground">{c.cpm ? fmtRange(c.cpm) : "n/a"}</td>
              <td className="py-3 text-muted-foreground">{c.cpc ? `${fmtRange(c.cpc, 2)}${"cpcPlus" in c && c.cpcPlus ? "+" : ""}` : "n/a"}</td>
            </tr>
          ))}
          <tr>
            <td className="py-3 pr-4 font-semibold">Birch hubs (starting at)</td>
            <td className="py-3 pr-4 font-semibold">${RATE_SURFACES[0]!.cpmStarter[0]}–{RATE_SURFACES[4]!.cpmStarter[1]} by surface</td>
            <td className="py-3 font-semibold">${RATE_SURFACES[0]!.cpcStarter[0].toFixed(2)}–{RATE_SURFACES[4]!.cpcStarter[1].toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        USD. <Estimate>Planning ranges</Estimate> Typical 2026 ranges we use for planning, not audited benchmarks. Logged-in, first-party audiences typically price 25–40% above open inventory, and endemic direct deals can run well above open programmatic.
      </p>
    </div>
  );
}
