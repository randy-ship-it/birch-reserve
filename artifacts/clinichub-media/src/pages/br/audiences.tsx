import { Lock, ShieldCheck, Sparkles } from "lucide-react";
import { LOOK_HREF, SeatCtas } from "@/components/br/pricing";
import { Cta, Eyebrow, Faq, H1, H2, JsonLd, Lede, Section, usePageMeta } from "@/components/br/ui";
import { trackCta } from "@/lib/track-cta";
import { BRAND_HUBS } from "../../../../api-server/src/lib/overhaul/model";
import {
  ARRIVAL_MIX,
  AUDIENCE_SNAPSHOT,
  BASIS_LABEL,
  BASIS_NOTE,
  CATEGORY_DEMAND,
  INTENT_LADDER,
  REGION_MIX,
  SEGMENTS,
  SOURCES,
  fmtOrdersShort,
  fmtPctBand,
  type Basis,
} from "../../../../api-server/src/lib/overhaul/audiences";

function BasisTag({ basis, tone = "light" }: { basis: Basis; tone?: "light" | "dark" }) {
  const cls =
    basis === "measured"
      ? "border-foreground bg-foreground text-background"
      : basis === "modelled"
        ? "border-foreground/30 bg-accent/60 text-foreground"
        : "border-foreground/25 bg-background text-foreground/70";
  const dark = tone === "dark" ? "border-background/40 bg-transparent text-background/80" : cls;
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider ${dark}`}
      title={BASIS_NOTE[basis]}
      data-basis={basis}
    >
      {BASIS_LABEL[basis]}
    </span>
  );
}

function Bar({ pct, ink = false }: { pct: number; ink?: boolean }) {
  return (
    <div className="h-2.5 w-full bg-foreground/10" aria-hidden>
      <div className={`h-full ${ink ? "bg-foreground" : "bg-accent"}`} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

const FAQ = [
  {
    q: "Where do these numbers come from?",
    a: "Three places, each labelled. Measured figures come from our own hub analytics and are shown as shares. Modelled figures are built from the customers of the brands launching on the network (the TAM feed at scalehealth.ca/tam). Estimates are benchmark ranges. None of it is audited delivery, and we say so on every number.",
  },
  {
    q: "Do brands ever see customer or patient data?",
    a: "No. Brands see aggregated, de-identified results at the cohort level: views, clicks, tagged visits, promo-code redemptions and attributed orders. Never names, contact details or health information.",
  },
  {
    q: "Is this a public ad network?",
    a: "No. Placements run inside a private, non-public member experience. Every brand is hand-picked to fit the audience, and we sell only a minority of the available space so it stays curated.",
  },
  {
    q: "How fresh is it?",
    a: `The modelled view was read ${AUDIENCE_SNAPSHOT.modelledReadOn}. Measured shares cover the ${AUDIENCE_SNAPSHOT.measuredWindow}. Both update as more launches go live, and ${AUDIENCE_SNAPSHOT.ordersLine}.`,
  },
];

export default function BrAudiences() {
  usePageMeta(
    "Audience insights | Birch Reserve",
    "What we know about the audiences behind the brand launches on Scale Health hubs and Calm Joints: recovery, longevity, sleep, physio patients, racquet players and MD-referral cohorts. Measured, modelled and estimated figures, labelled.",
  );
  const maxOrders = Math.max(...CATEGORY_DEMAND.map((c) => c.ordersYr));
  const maxBand = Math.max(...INTENT_LADDER.map((r) => r.hi));
  return (
    <div data-testid="br-audiences">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Birch Reserve audience insights",
          url: "https://birchreserve.net/audiences",
          publisher: { "@type": "Organization", name: "Birch Reserve", url: "https://birchreserve.net/" },
          about: SEGMENTS.map((s) => ({ "@type": "Audience", audienceType: s.name })),
        }}
      />

      {/* Hero */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <Eyebrow>Audience insights</Eyebrow>
            <H1>Know the audience before you buy the seat.</H1>
            <Lede>
              What we know about the people behind the brand launches going live on Scale Health hubs and Calm Joints, rolled up from their customers. Every number says where it comes from.
            </Lede>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="basis-legend">
              <BasisTag basis="measured" /> <span className="mr-2">first-party analytics</span>
              <BasisTag basis="modelled" /> <span className="mr-2">TAM feed</span>
              <BasisTag basis="estimated" /> <span>benchmarks</span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Cta href="#segments">See the segments</Cta>
              <Cta href={LOOK_HREF} variant="line" testId="audiences-hero-hold-190" onClick={() => trackCta("cta_hold_190", { offer: "hold-190" })}>
                Start with a $190 look
              </Cta>
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6 md:p-8">
            <div className="grid grid-cols-2 gap-x-6 gap-y-7">
              <div>
                <div className="font-display text-4xl md:text-5xl">20mm+</div>
                <div className="mt-1 text-sm text-muted-foreground">orders are being onboarded now</div>
                <div className="mt-2"><BasisTag basis="modelled" /></div>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl">{AUDIENCE_SNAPSHOT.launchBrands}</div>
                <div className="mt-1 text-sm text-muted-foreground">brand launches feeding the audience</div>
                <div className="mt-2"><BasisTag basis="measured" /></div>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl">{AUDIENCE_SNAPSHOT.racquetPages.length}</div>
                <div className="mt-1 text-sm text-muted-foreground">racquet-sport pages live on Calm Joints</div>
                <div className="mt-2"><BasisTag basis="measured" /></div>
              </div>
              <div>
                <div className="font-display text-4xl md:text-5xl">3</div>
                <div className="mt-1 text-sm text-muted-foreground">core pillars: {AUDIENCE_SNAPSHOT.pillars.join(", ")}</div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Launch feeders */}
      <Section tone="soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Built from launch customers</Eyebrow>
            <H2>The brands feeding the audience.</H2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Each launch brings its own customers into a private, co-branded hub. We roll them up into segments. Brands never see each other's customers.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-4" data-testid="launch-feeders">
          {BRAND_HUBS.map((h) => (
            <div key={h.key} className="flex flex-col gap-3 bg-background p-5">
              <div className="flex h-10 items-center">
                <img src={h.logo} alt={`${h.name} logo`} className="max-h-10 max-w-[140px] object-contain" loading="lazy" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">{h.recovery}</p>
              <p className="text-sm leading-snug">{h.audience}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Segments */}
      <Section id="segments">
        <Eyebrow>Audience segments</Eyebrow>
        <H2>Six audiences, one private network.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Recovery and Longevity are where the network started. Sleep is our newest pillar, and the audience is already there.
        </p>
        <div className="mt-10 grid gap-px border border-foreground/15 bg-foreground/15 md:grid-cols-2 lg:grid-cols-3">
          {SEGMENTS.map((s) => (
            <article key={s.key} className="flex flex-col bg-background p-6" data-testid={`segment-${s.key}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55">{s.pillar ?? "Cohort"}</p>
                {s.isNew ? (
                  <span className="inline-flex items-center gap-1 bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                    <Sparkles className="size-3" aria-hidden /> New pillar
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 font-display text-2xl leading-tight">{s.name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.who}</p>
              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Profile</dt>
                  <dd className="mt-1">
                    {s.profile} <BasisTag basis={s.profileBasis} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">What they buy</dt>
                  <dd className="mt-1">{s.buys}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Fed by</dt>
                  <dd className="mt-1">{s.feeders.join(" · ")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Brand fit</dt>
                  <dd className="mt-1">{s.fits}</dd>
                </div>
              </dl>
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span>
                  Purchase intent: <strong>{s.intent}</strong>
                </span>
                <BasisTag basis="estimated" />
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* Demand by category */}
      <Section tone="soft">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow>Demand signals</Eyebrow>
            <H2>Where the orders are.</H2>
            <p className="mt-4 text-muted-foreground">
              Orders a year by category across the launch partners' customers, with the core age band, gender skew and share on mobile.
            </p>
            <div className="mt-4">
              <BasisTag basis="modelled" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Read {AUDIENCE_SNAPSHOT.modelledReadOn} from{" "}
              <a href={AUDIENCE_SNAPSHOT.tamSource} className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                scalehealth.ca/tam
              </a>
              . Modelled, not audited.
            </p>
          </div>
          <div className="border border-foreground/15 bg-white" data-testid="category-demand">
            {CATEGORY_DEMAND.map((c) => (
              <div key={c.key} className="border-b border-border p-4 last:border-b-0 md:p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-semibold">{c.label}</p>
                  <p className="font-display text-2xl tabular-nums">{fmtOrdersShort(c.ordersYr)}</p>
                </div>
                <div className="mt-2">
                  <Bar pct={(c.ordersYr / maxOrders) * 100} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.age} · {c.skew} · {Math.round(c.mobile * 100)}% mobile · {c.intents}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Region + arrival (measured) */}
      <Section>
        <Eyebrow>Early network signals</Eyebrow>
        <H2>What the hubs are already telling us.</H2>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Measured on our own hubs over the {AUDIENCE_SNAPSHOT.measuredWindow}. Shares only, aggregated and de-identified. The network is early and these shift as launches go live.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="border border-foreground/15 bg-white p-6" data-testid="region-mix">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">Sessions by region</p>
              <BasisTag basis="measured" />
            </div>
            <div className="mt-6 space-y-4">
              {REGION_MIX.map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.pct}%</span>
                  </div>
                  <Bar pct={r.pct} ink />
                </div>
              ))}
            </div>
          </div>
          <div className="border border-foreground/15 bg-white p-6" data-testid="arrival-mix">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-2xl">How members arrive</p>
              <BasisTag basis="measured" />
            </div>
            <div className="mt-6 space-y-4">
              {ARRIVAL_MIX.map((r) => (
                <div key={r.label}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{r.label}</span>
                    <span className="font-semibold tabular-nums">{r.pct}%</span>
                  </div>
                  <Bar pct={r.pct} ink />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Purchase intent */}
      <Section tone="ink">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">Purchase intent</p>
            <h2 className="font-display text-3xl leading-tight tracking-tight text-background md:text-5xl">Reach them at the moment they act.</h2>
            <p className="mt-5 text-lg leading-relaxed text-background/75">
              Hub placements sit right after a purchase or booking and inside the member dashboard, where attention is highest. Benchmark click-through bands by moment:
            </p>
            <div className="mt-4">
              <BasisTag basis="estimated" tone="dark" />
            </div>
          </div>
          <div className="space-y-5" data-testid="intent-ladder">
            {INTENT_LADDER.map((r, i) => (
              <div key={r.moment}>
                <div className="mb-1.5 flex items-baseline justify-between gap-4">
                  <div>
                    <p className={`font-semibold ${i === INTENT_LADDER.length - 1 ? "text-background/60" : "text-background"}`}>{r.moment}</p>
                    <p className="text-xs text-background/60">{r.where}</p>
                  </div>
                  <p className="font-display text-2xl tabular-nums text-background">{fmtPctBand(r.lo, r.hi)}</p>
                </div>
                <div className="h-2.5 w-full bg-background/15" aria-hidden>
                  <div className={`h-full ${i === INTENT_LADDER.length - 1 ? "bg-background/40" : "bg-accent"}`} style={{ width: `${(r.hi / maxBand) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-background/60">Ranges, not promises. Your report shows what actually delivered.</p>
          </div>
        </div>
      </Section>

      {/* Sources + privacy */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Eyebrow>How we know</Eyebrow>
            <H2>Every number has a source.</H2>
            <div className="mt-8 overflow-x-auto border border-foreground/15 bg-white">
              <table className="w-full min-w-[520px] text-left text-sm" data-testid="sources-table">
                <thead className="bg-secondary/60 text-[11px] uppercase tracking-wider text-foreground/60">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Label</th>
                    <th className="px-4 py-3 font-semibold">Source</th>
                    <th className="px-4 py-3 font-semibold">What it covers</th>
                  </tr>
                </thead>
                <tbody>
                  {SOURCES.map((s) => (
                    <tr key={s.source} className="border-t border-border align-top">
                      <td className="px-4 py-3"><BasisTag basis={s.basis} /></td>
                      <td className="px-4 py-3 font-semibold">{s.source}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-4 self-end">
            {[
              { icon: ShieldCheck, t: "Aggregated and de-identified", d: "Cohort-level results only. No names, contact details or health information ever reach a brand." },
              { icon: Lock, t: "Private member experience", d: "Placements run inside non-public, co-branded hubs, not on the open web." },
              { icon: Sparkles, t: "Hand-picked curation", d: "Every brand is chosen to fit the audience it sits in front of." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4 border border-foreground/15 bg-white p-5">
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section tone="soft" id="start">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <Eyebrow>Start now</Eyebrow>
            <H2>Put your brand in front of the segment that fits.</H2>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Start with a $190 refundable 7-day look and see your placement first, or take a $490 category seat. Credit spends down over 6 months and unused credit is refundable. Want a category to yourself, or a premium slot? Send an inquiry and we'll quote it.
            </p>
            <SeatCtas className="mt-8" />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <a href="/match" className="underline underline-offset-4" data-testid="audiences-inquire">
                Send an inquiry: match my audience
              </a>
              <a href="/agencies#talk" className="underline underline-offset-4">
                Agency? 10% of media spend, paid in cash
              </a>
            </div>
          </div>
          <div>
            <Faq items={FAQ} />
          </div>
        </div>
      </Section>
    </div>
  );
}
