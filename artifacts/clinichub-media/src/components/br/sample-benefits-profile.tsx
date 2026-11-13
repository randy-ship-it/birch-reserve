/**
 * Illustrative partner audience profile. All figures are sample ranges.
 * Never name a real benefits partner on this surface.
 */
import {
  SAMPLE_AGE,
  SAMPLE_BALANCE,
  SAMPLE_CHANNEL,
  SAMPLE_CLAIM_CATEGORIES,
  SAMPLE_GENDER,
  SAMPLE_INDUSTRY,
  SAMPLE_MEMBER_BAND,
  SAMPLE_PLAN_TIER,
  SAMPLE_PROFILE_BADGE,
  SAMPLE_PROFILE_HOWTO,
  SAMPLE_PROFILE_KIND,
  SAMPLE_PROFILE_TITLE,
  SAMPLE_REGION,
  SAMPLE_SEASONALITY,
  SAMPLE_USAGE,
  fmtPctRange,
  type SampleShare,
} from "../../../../api-server/src/lib/overhaul/sampleBenefitsProfile";

function SampleTag({ className = "", testId }: { className?: string; testId?: string }) {
  return (
    <span
      className={`inline-flex items-center border-2 border-foreground bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-foreground ${className}`}
      {...(testId ? { "data-testid": testId } : {})}
    >
      {SAMPLE_PROFILE_BADGE}
    </span>
  );
}

function RangeBar({ rows }: { rows: SampleShare[] }) {
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const mid = (r.lo + r.hi) / 2;
        return (
          <div key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{fmtPctRange(r.lo, r.hi)}</span>
            </div>
            <div className="h-2.5 w-full bg-foreground/10" aria-hidden>
              <div className="h-full bg-accent" style={{ width: `${Math.max(4, Math.min(100, mid))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SampleBenefitsProfile({ standalone = false }: { standalone?: boolean }) {
  return (
    <div className="overflow-x-hidden" data-testid="sample-benefits-profile">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {standalone ? null : <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Partner audience profile</p>}
          <h2 className="mt-2 font-display text-3xl leading-tight tracking-tight md:text-5xl">
            {SAMPLE_PROFILE_TITLE}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{SAMPLE_PROFILE_KIND}</p>
        </div>
        <SampleTag testId="sample-profile-badge" />
      </div>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        A sample of the aggregated, anonymized picture a benefits administrator typically already has. Every figure is an illustrative range, not a real book of business and not measured delivery.
      </p>

      <div className="mt-8 grid gap-px border border-foreground/15 bg-foreground/15 sm:grid-cols-3" data-testid="sample-profile-kpis">
        <div className="bg-background p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Member count band</p>
          <p className="mt-2 font-display text-3xl leading-tight">{SAMPLE_MEMBER_BAND}</p>
          <div className="mt-3"><SampleTag /></div>
        </div>
        <div className="bg-background p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Paramedical usage</p>
          <p className="mt-2 text-sm leading-relaxed">{SAMPLE_USAGE.anyParamedical}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{SAMPLE_USAGE.physio}</p>
          <div className="mt-3"><SampleTag /></div>
        </div>
        <div className="bg-background p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">Digital vs in-person</p>
          <p className="mt-2 text-sm leading-relaxed">{SAMPLE_CHANNEL.inPerson}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{SAMPLE_CHANNEL.digital}</p>
          <div className="mt-3"><SampleTag /></div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Employer industry mix</p>
            <SampleTag />
          </div>
          <RangeBar rows={SAMPLE_INDUSTRY} />
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Province / region mix</p>
            <SampleTag />
          </div>
          <RangeBar rows={SAMPLE_REGION} />
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Age bands</p>
            <SampleTag />
          </div>
          <RangeBar rows={SAMPLE_AGE} />
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Gender split</p>
            <SampleTag />
          </div>
          <RangeBar rows={SAMPLE_GENDER} />
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Plan tier</p>
            <SampleTag />
          </div>
          <RangeBar rows={SAMPLE_PLAN_TIER} />
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Top claim categories</p>
            <SampleTag />
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Share of paramedical claims, not of all members.</p>
          <RangeBar rows={SAMPLE_CLAIM_CATEGORIES} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Annual paramedical balance</p>
            <SampleTag />
          </div>
          <p className="text-sm leading-relaxed">{SAMPLE_BALANCE.usedByClaimants}.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{SAMPLE_BALANCE.unusedBudget}.</p>
        </div>
        <div className="border border-foreground/15 bg-white p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-display text-2xl">Seasonality</p>
            <SampleTag />
          </div>
          <p className="text-sm leading-relaxed">{SAMPLE_SEASONALITY}</p>
        </div>
      </div>

      <p className="mt-8 border border-foreground/15 bg-secondary/40 p-5 text-sm leading-relaxed" data-testid="sample-profile-howto">
        {SAMPLE_PROFILE_HOWTO}
      </p>
      {standalone ? null : (
        <p className="mt-4 text-sm">
          <a href="/audiences/sample-profile" className="underline underline-offset-4" data-testid="sample-profile-standalone">
            Open this sample on its own page
          </a>
        </p>
      )}
    </div>
  );
}

