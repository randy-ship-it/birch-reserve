/**
 * Trusted Agency Partners on the home page (Randy Nov 24 2026 t8289u: "love this for the landing
 * page to pop"; aligned to the /agencies rate-card model later the same day).
 * Same terms as /agencies, from shared constants: published rate card, standard 15%
 * agency commission off gross, agency sets resale, agency handles disclosure, direct buyers pay the card,
 * no undercutting of agency clients. Committed blocks get a further 10–20% off net, on top of
 * regular agency pricing; volume or term sets the exact rate.
 * No GTM or services promise; no counts; soft CTA to /agencies#talk, never a call push.
 */
import { ArrowRight, Check } from "lucide-react";
import { trackAttn } from "@/lib/attention";
import { siteName } from "@/lib/siteSkin";
import { ListPriceLine } from "@/components/br/agency-showcase";
import { AGENCY_RATE_CARD, AGENCY_TIERS, PARTNER_VALUE, PARTNER_VALUE_VS_AGENCY_PCT } from "../../../../api-server/src/lib/overhaul/agencyShowcase";

const PARTNER = AGENCY_TIERS.find((t) => t.key === "exclusive")!;

const TERMS = [
  AGENCY_RATE_CARD.resale,
  AGENCY_RATE_CARD.disclosure,
  AGENCY_RATE_CARD.direct,
  AGENCY_RATE_CARD.noUndercut,
] as const;

export function TrustedAgencyPartners() {
  return (
    <section id="trusted-agency-partners" className="scroll-mt-24 overflow-hidden border-y border-foreground/15 bg-background" data-testid="home-tap" aria-labelledby="tap-title">
      <div className="container mx-auto max-w-6xl px-4 py-14 md:py-20">
        <div className="grid items-end gap-8 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              For agencies <span aria-hidden className="hidden h-px w-8 bg-foreground/30 sm:block" /> <span className="hidden sm:inline">Partner program</span>
            </p>
            <h2 id="tap-title" className="mt-5 font-display text-5xl leading-[0.95] tracking-tight text-foreground sm:text-6xl md:text-7xl">
              {PARTNER.name.replace(/ partners$/i, "")} <em className="italic">Partners</em>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground md:text-xl">
              Reserved inventory for <span className="bg-accent px-1 text-foreground">a few agencies.</span>
            </p>
          </div>
          <div className="flex w-full max-w-[300px] items-center gap-4 bg-foreground p-4 md:max-w-[340px] md:p-5" data-testid="tap-badge" role="img" aria-label={`${siteName()} Trusted Agency Partner badge`}>
            <span aria-hidden className="grid size-12 shrink-0 place-items-center bg-accent md:size-14"><Check className="size-7 text-foreground" strokeWidth={3} /></span>
            <span className="min-w-0 text-background">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-background/60">{siteName()}</span>
              <span className="mt-1 block font-display text-xl leading-tight md:text-2xl">Trusted Agency Partner</span>
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-px border border-foreground bg-foreground lg:grid-cols-[1.15fr_1fr]">
          <div className="min-w-0 bg-background p-6 md:p-10" data-testid="tap-allocation">
            <h3 className="font-display text-2xl leading-tight text-foreground sm:text-3xl md:text-4xl">
              Half reserved. <em className="italic">Half open.</em>
            </h3>
            <div className="mt-6 grid grid-cols-2 border border-foreground">
              <div className="relative flex min-h-[200px] min-w-0 flex-col justify-between bg-foreground p-4 text-background md:min-h-[240px] md:p-6">
                <span aria-hidden className="absolute right-3 top-3 hidden size-7 place-items-center bg-accent md:right-5 md:top-5 md:grid"><Check className="size-4 text-foreground" strokeWidth={3} /></span>
                <span className="font-display text-5xl leading-none text-accent md:text-6xl">~50%</span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs">Reserved for partners</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-background/70 md:text-sm">Dedicated packages and newly activating hubs</span>
                </span>
              </div>
              <div className="flex min-h-[200px] min-w-0 flex-col justify-between bg-[repeating-linear-gradient(135deg,transparent_0_11px,rgba(7,26,57,0.09)_11px_12px)] p-4 text-foreground md:min-h-[240px] md:p-6">
                <span className="font-display text-5xl leading-none md:text-6xl">~50%</span>
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs">Open self-serve</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-foreground/70 md:text-sm">Direct buyers pay the rate card</span>
                </span>
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-snug text-muted-foreground" data-testid="tap-allocation-note">
              Of available dedicated and category inventory. Modelled split; inventory is still activating.
            </p>
          </div>

          <div className="min-w-0 bg-foreground p-6 text-background md:p-10" data-testid="tap-economics">
            <span className="inline-block border border-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent" data-testid="tap-illustrative">Written terms</span>
            <h3 className="mt-4 font-display text-2xl leading-tight sm:text-3xl md:text-4xl">What a partner <em className="italic">gets.</em></h3>
            <dl className="mt-6 border-t border-background/30">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-b border-background/15 py-4">
                <dt className="whitespace-nowrap font-display text-5xl leading-none tracking-tight sm:text-6xl text-accent">{PARTNER_VALUE_VS_AGENCY_PCT.lo}–{PARTNER_VALUE_VS_AGENCY_PCT.hi}%</dt>
                <dd className="text-sm leading-snug text-background/70">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Better value</span>
                  Than regular agency pricing, by committing to inventory
                </dd>
              </div>
            </dl>
            <ul className="mt-5 space-y-2 text-sm leading-snug text-background/75" data-testid="tap-terms">
              {TERMS.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-accent" />
                  {line}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-snug text-background/60" data-testid="tap-economics-note">
              {PARTNER_VALUE.line} {PARTNER_VALUE.fine} Regular agencies still earn the standard 15% agency commission off the rate card. Nothing runs until an insertion order names the placement.
            </p>
          </div>
        </div>

        <div className="mt-6" data-testid="tap-rate-card">
          <ListPriceLine />
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
