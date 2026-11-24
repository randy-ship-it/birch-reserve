/**
 * Trusted Agency Partners (home section, Randy Nov 24 2026 t8289u: "love this for the landing page to pop").
 * Built from the share set in /workspace/birch-tap/share: hero line, 50/50 allocation, illustrative economics, badge.
 * Rules: order desk for proprietary space, no services promised; economics always marked Illustrative; no counts;
 * soft CTA to the existing agency inquiry form (/agencies#talk), never a call push.
 */
import { ArrowRight, Check } from "lucide-react";
import { trackAttn } from "@/lib/attention";

const ROWS = [
  { n: "10%", op: "", k: "Cash", d: "Of media spend, as agency of record" },
  { n: "10–20%", op: "+", k: "Margin", d: "Buy reserved inventory below list" },
] as const;

export function TrustedAgencyPartners() {
  return (
    <section className="overflow-hidden border-y border-foreground/15 bg-background" data-testid="home-tap" aria-labelledby="tap-title">
      <div className="container mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              For agencies <span aria-hidden className="h-px w-8 bg-foreground/30" /> Trusted Agency Partners
            </p>
            <h2 id="tap-title" className="mt-5 font-display text-5xl leading-[0.95] tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Trusted Agency <em className="italic">Partners</em>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground md:text-xl">
              Reserved inventory for <span className="bg-accent px-1 text-foreground">a few agencies.</span>
            </p>
          </div>
          <img
            src="/trusted-agency-partner-badge.svg"
            alt="Birch Reserve Trusted Agency Partner badge"
            width={422}
            height={96}
            className="h-auto w-full max-w-[300px] md:max-w-[340px]"
            data-testid="tap-badge"
            loading="lazy"
          />
        </div>

        <div className="mt-10 grid gap-px border border-foreground bg-foreground lg:grid-cols-[1.15fr_1fr]">
          {/* Allocation */}
          <div className="min-w-0 bg-background p-6 md:p-10" data-testid="tap-allocation">
            <h3 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
              Half reserved. <em className="italic">Half open.</em>
            </h3>
            <div className="mt-6 grid grid-cols-2 border border-foreground">
              <div className="relative flex min-h-[200px] min-w-0 flex-col justify-between bg-foreground p-4 text-background md:min-h-[240px] md:p-6">
                <span aria-hidden className="absolute right-3 top-3 grid size-7 place-items-center bg-accent md:right-5 md:top-5"><Check className="size-4 text-foreground" strokeWidth={3} /></span>
                <span className="font-display text-5xl leading-none text-accent md:text-6xl">~50%</span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs">Reserved for partners</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-background/70 md:text-sm">Exclusive packages and newly activating hubs</span>
                </span>
              </div>
              <div className="flex min-h-[200px] min-w-0 flex-col justify-between bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(7,26,57,0.09)_11px_12px)] p-4 text-foreground md:min-h-[240px] md:p-6">
                <span className="font-display text-5xl leading-none md:text-6xl">~50%</span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs">Open self-serve</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-foreground/70 md:text-sm">Brands buy directly here</span>
                </span>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-snug text-muted-foreground" data-testid="tap-allocation-note">
              Of available exclusive and category inventory. Modelled split; inventory is still activating.
            </p>
          </div>

          {/* Economics */}
          <div className="min-w-0 bg-foreground p-6 text-background md:p-10" data-testid="tap-economics">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-3xl leading-tight md:text-4xl">What a partner <em className="italic">keeps.</em></h3>
              <span className="mt-1 shrink-0 border border-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent" data-testid="tap-illustrative">Illustrative</span>
            </div>
            <dl className="mt-6 border-t border-background/30">
              {ROWS.map((r) => (
                <div key={r.k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-background/15 py-4">
                  <dt className="whitespace-nowrap font-display text-4xl leading-none tracking-tight sm:text-5xl">
                    {r.op ? <span className="mr-1 align-top text-xl text-background/55">{r.op}</span> : null}{r.n}
                  </dt>
                  <dd className="text-sm leading-snug text-background/70">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-background">{r.k}</span>{r.d}
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 py-4">
                <dt className="whitespace-nowrap font-display text-4xl leading-none tracking-tight text-accent sm:text-5xl">
                  <span className="mr-1 align-top text-xl text-background/55">=</span>20–30%
                </dt>
                <dd className="text-sm leading-snug text-background/70">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Effective</span>On each client you place
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-snug text-background/60" data-testid="tap-economics-note">
              Illustrative example, modelled. Not a forecast or guarantee. Assumes the 10% is paid on list price. Nothing runs until an insertion order names the placement.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
          <a
            href="/agencies?ref=home_tap#talk"
            onClick={() => trackAttn("tap.cta")}
            className="inline-flex h-12 items-center gap-2 border border-foreground bg-accent px-6 text-sm font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            data-testid="tap-cta"
          >
            Ask about partner access <ArrowRight className="size-4" aria-hidden />
          </a>
          <p className="text-sm text-muted-foreground">Not a partner? You can still place clients self-serve.</p>
        </div>
      </div>
    </section>
  );
}
