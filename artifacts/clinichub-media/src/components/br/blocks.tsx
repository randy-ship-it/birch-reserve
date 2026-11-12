import { ArrowUpRight, Building2, Megaphone, Store, Users } from "lucide-react";
import { BENCHMARKS, POSITIONING, SURFACES, TAM, areaLockGuaranteedViews, blendedHubCpmUsd, CPC_FLOOR_USD } from "../../../../api-server/src/lib/overhaul/model";
import { Modelled } from "./ui";

export const PATHS = [
  { group: "Advertise", who: "Brands", href: "/advertise/brands", Icon: Megaphone, line: "Lock in spend across co-branded hubs. Prepay and get bonus credit.", cta: "Brand spend commits" },
  { group: "Advertise", who: "Local businesses & studios", href: "/advertise/local", Icon: Store, line: "Lock down your area: up to 50% of hub display within 5 km of you.", cta: "Lock down my area" },
  { group: "Publish", who: "Brands", href: "/publish/brands", Icon: Building2, line: "Have a recovery audience? Apply for a co-branded hub. Or ask about display / CPC only.", cta: "Inquire to publish" },
  { group: "Publish", who: "Studios & retail", href: "/publish/studios", Icon: Users, line: "Activate your hub and earn $500 cash or $700+ in ad credit.", cta: "Activate my hub" },
] as const;

export function FourPaths() {
  return (
    <div className="grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-2 lg:grid-cols-4" data-testid="four-paths">
      {PATHS.map((p) => (
        <a key={p.href} href={p.href} className="group flex flex-col bg-background p-6 transition-colors hover:bg-foreground hover:text-background" data-testid={`path-${p.href.slice(1).replace("/", "-")}`}>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/50 group-hover:text-accent">{p.group}</span>
          <p.Icon className="mt-4 size-7" aria-hidden />
          <span className="mt-3 font-display text-2xl">{p.who}</span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground group-hover:text-background/75">{p.line}</span>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold">
            {p.cta} <ArrowUpRight className="size-4" />
          </span>
        </a>
      ))}
    </div>
  );
}

export function PositioningBand() {
  return (
    <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center" data-testid="positioning">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Only two kinds of inventory</p>
        <h2 className="mt-3 font-display text-3xl leading-tight md:text-5xl">We sell ad space in co-branded Recovery Brand hubs and health &amp; wellness business hubs. Nothing else.</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-background/25 p-5">
          <p className="font-display text-xl">Co-branded Recovery Brand hubs</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {POSITIONING.recoveryBrandVerticals.map((v) => (
              <li key={v.key} className={`border px-2.5 py-1 text-sm ${v.inQueue ? "border-background/30 text-background/60" : "border-accent text-accent"}`}>
                {v.label}
                {v.inQueue ? " · in queue" : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-background/25 p-5">
          <p className="font-display text-xl">Health &amp; wellness business hubs</p>
          <p className="mt-3 text-sm leading-relaxed text-background/75">Physio, mobility, gyms, studios and clinic hubs, each with our marketplace plugged in.</p>
        </div>
      </div>
    </div>
  );
}

export function SurfacesGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4" data-testid="surfaces-grid">
      {SURFACES.map((s, i) => (
        <article key={s.key} className="border border-foreground/15 bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">Surface {i + 1}</p>
          <h3 className="mt-2 font-display text-2xl">{s.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.blurb}</p>
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/50">Views / mo</dt>
              <dd className="font-semibold">{(s.monthly / 1e6).toFixed(1)}MM</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/50">Display</dt>
              <dd className="font-semibold">${s.cpmUsd} CPM</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-foreground/50">CPC</dt>
              <dd className="font-semibold">from ${CPC_FLOOR_USD.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Views <Modelled /> USD rate card, proposed.
          </p>
        </article>
      ))}
    </div>
  );
}

export function TamStrip({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  const muted = tone === "dark" ? "text-background/65" : "text-muted-foreground";
  return (
    <div className={`grid grid-cols-2 gap-6 ${compact ? "" : "md:grid-cols-4"}`} data-testid="tam-strip">
      {[
        { v: TAM.ordersLabel, l: TAM.ordersNote },
        { v: TAM.viewsLabel, l: TAM.viewsNote },
        { v: String(TAM.listedPartners), l: "listed partners" },
        { v: "4", l: "hub placements, display + CPC" },
      ].map((x) => (
        <div key={x.l}>
          <div className={`font-display ${compact ? "text-4xl" : "text-4xl md:text-5xl"}`}>{x.v}</div>
          <div className={`mt-1 text-sm ${muted}`}>{x.l}</div>
        </div>
      ))}
      <p className={`col-span-2 text-xs ${compact ? "" : "md:col-span-4"} ${muted}`}>
        Modelled from the TAM feed, read {TAM.readOn}:{" "}
        <a href={TAM.source} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
          scalehealth.ca/tam
        </a>
        . Partners are listed; views are modelled, not measured.
      </p>
    </div>
  );
}

export function MetaComparison() {
  const g = areaLockGuaranteedViews();
  return (
    <div data-testid="meta-comparison">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="py-3 pr-4 font-semibold"> </th>
              <th className="py-3 pr-4 font-semibold">Meta / public social</th>
              <th className="py-3 font-semibold">Birch Reserve hubs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="py-3 pr-4 font-medium">Who sees it</td>
              <td className="py-3 pr-4 text-muted-foreground">Anyone the auction picks in a feed</td>
              <td className="py-3">Customers and members of a brand or clinic they already chose</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium">Where it shows</td>
              <td className="py-3 pr-4 text-muted-foreground">Between friends’ posts and other ads</td>
              <td className="py-3">Inside the hub experience and right after checkout or booking</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium">CPM, health &amp; wellness</td>
              <td className="py-3 pr-4 text-muted-foreground">$20.70 USD (Meta, 2025)¹</td>
              <td className="py-3">
                ${blendedHubCpmUsd().toFixed(2)} USD rate card · ${g.effectiveCpmUsd.toFixed(2)} with an area lock <Modelled />
              </td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium">Post-purchase engagement</td>
              <td className="py-3 pr-4 text-muted-foreground">Not offered</td>
              <td className="py-3">Order-confirmation offers average 5.6% positive engagement (category benchmark, not ours)²</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium">Cost per lead, health &amp; fitness</td>
              <td className="py-3 pr-4 text-muted-foreground">$52.98 USD³</td>
              <td className="py-3">Reported per campaign with UTM links and promo codes. No claim until pilots report.</td>
            </tr>
            <tr>
              <td className="py-3 pr-4 font-medium">Bidding</td>
              <td className="py-3 pr-4 text-muted-foreground">Auction, price moves daily</td>
              <td className="py-3">Fixed price you lock in, with the right to keep pace if traffic grows</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ol className="mt-4 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
        {[BENCHMARKS[0], BENCHMARKS[4], BENCHMARKS[2]].map((b, i) => (
          <li key={b.metric}>
            {i + 1}. {b.metric}: {b.value}. Source:{" "}
            <a href={b.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {b.source}
            </a>
          </li>
        ))}
        <li>Our CPMs are a proposed rate card and our views are modelled from the TAM feed. Hub ads are expected to work better because of trust and timing; we will prove it with pilot reporting, not claim it.</li>
      </ol>
    </div>
  );
}
