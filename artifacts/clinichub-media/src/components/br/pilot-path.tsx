/** Hero path (Randy, Nov 18 2026 10:13 PM ET): kit form + $190 pilot + proof + report + 3 steps. Copy in overhaul/pilotPath.ts. */
import { ArrowRight, Bot, Download, FileText, Sparkles } from "lucide-react";
import { AGENT_LINE, CATEGORY_AUDIENCES, EARLY_RATE_BADGE, EARLY_RATE_FINE, HUB_SHOTS_FINE, HUB_SURFACE_SHOTS, PILOT_HERO, REPORTING, THREE_STEPS } from "../../../../api-server/src/lib/overhaul/pilotPath";
import { SampleReport } from "@/components/br/buyer-comfort";
import { InfoPop } from "@/components/br/intake-kit";

export function PilotHero({ testId = "pilot-hero", headingLevel = 2 }: { testId?: string; headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? "h1" : "h2";
  return (
    <section data-testid={testId} className="relative overflow-hidden border-b border-border/70 bg-[#0b1f3a] text-white">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-[28rem] rounded-full bg-lime-300/30 blur-3xl" />
      <div className="container relative mx-auto grid gap-8 px-4 py-10 md:py-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0b1f3a]"><Sparkles className="size-3.5" />{PILOT_HERO.kicker}</p>
          <H className="mt-3 font-display text-4xl leading-[1.02] md:text-6xl">{PILOT_HERO.title}</H>
          <p className="mt-3 text-lg text-lime-200 md:text-xl">{PILOT_HERO.sub}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={PILOT_HERO.kitHref} data-testid={`${testId}-kit`} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-lime-300 px-7 text-base font-bold text-[#0b1f3a] shadow-lg shadow-lime-500/30 transition hover:bg-white"><Download className="size-5" />Get my Monetization Kit</a>
            <a href={PILOT_HERO.lookHref} data-testid={`${testId}-look`} className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-white/80 px-7 text-base font-bold transition hover:bg-white hover:text-[#0b1f3a]">Start the $190 USD look <ArrowRight className="size-5" /></a>
          </div>
          <p className="mt-4 max-w-xl text-sm text-white/80" data-testid={`${testId}-terms`}>{PILOT_HERO.lookTerms}</p>
          <p className="mt-2 text-xs text-white/60">
            <InfoPop dark title="How your money comes back" label="Refund and credit terms" testId={`${testId}-refunds`}>
              {PILOT_HERO.refunds.map((r) => <p key={r.k}><strong>{r.k}.</strong> {r.d}</p>)}
              <p className="mt-2">{PILOT_HERO.decide}</p>
            </InfoPop>
            <span className="ml-2">Live hubs: {PILOT_HERO.liveHubs.map((h, i) => <span key={h.href}>{i ? " · " : ""}<a href={h.href} target="_blank" rel="noopener" className="underline underline-offset-2">{h.label}</a></span>)}</span>
          </p>
          <AgentLine className="mt-4 text-white/80" />
        </div>
        <AnnotatedShot shot={HUB_SURFACE_SHOTS[0]} compact />
      </div>
    </section>
  );
}

type Shot = (typeof HUB_SURFACE_SHOTS)[number];
export function AnnotatedShot({ shot, compact = false }: { shot: Shot; compact?: boolean }) {
  return (
    <figure className="m-0" data-testid={`hub-shot-${shot.key}`}>
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
        <img src={shot.src} alt={shot.alt} width={1440} height={900} loading="lazy" decoding="async" className="block h-auto w-full" />
        {shot.notes.map((n) => (
          <div key={n.n} className="absolute rounded-lg border-2 border-dashed border-lime-500 bg-lime-300/20" style={{ left: `${n.x}%`, top: `${n.y}%`, width: `${n.w}%`, height: `${n.h}%` }}>
            <span className="absolute -left-2.5 -top-2.5 inline-flex size-6 items-center justify-center rounded-full bg-[#0b1f3a] text-xs font-bold text-lime-300 shadow">{n.n}</span>
          </div>
        ))}
        <span className="absolute right-2 top-2 rounded bg-[#0b1f3a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">Illustrative</span>
      </div>
      <figcaption className={`mt-2 grid gap-1 text-xs ${compact ? "text-white/75" : "text-muted-foreground"}`}>
        <span className="font-semibold">{shot.hub}</span>
        {shot.notes.map((n) => <span key={n.n}><strong>{n.n} · {n.label}.</strong> {n.d}</span>)}
        <span className="opacity-80">{HUB_SHOTS_FINE}</span>
      </figcaption>
    </figure>
  );
}

export function HubShots() {
  return (
    <section className="border-b border-border/70 bg-background" data-testid="hub-shots">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Real hub surfaces</p>
        <h2 className="font-display text-3xl md:text-5xl">Where your card would sit.</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-2">{HUB_SURFACE_SHOTS.map((s) => <AnnotatedShot key={s.key} shot={s} />)}</div>
      </div>
    </section>
  );
}

export function EarlyRateBadge() {
  return <span data-testid="early-rate-badge" title={EARLY_RATE_FINE} className="inline-flex self-start items-center rounded-full bg-lime-300 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0b1f3a]">{EARLY_RATE_BADGE}</span>;
}

export function CategoryCards() {
  return (
    <section id="categories" className="scroll-mt-20 border-b border-border/70 bg-[#f7f5f0]" data-testid="category-cards">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">8 open categories</p>
            <h2 className="font-display text-3xl md:text-5xl">Who your seat reaches.</h2>
          </div>
          <p className="max-w-sm text-xs text-muted-foreground">No reach numbers here: your IO sizes views against live hub supply. <InfoPop title="Early rate" label="Early rate" testId="early-rate-pop"><p>{EARLY_RATE_FINE}</p></InfoPop></p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_AUDIENCES.map((c) => (
            <article key={c.key} data-testid={`category-card-${c.key}`} className="flex flex-col rounded-2xl border border-foreground/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <EarlyRateBadge />
              <h3 className="mt-3 font-display text-2xl leading-tight">{c.name}</h3>
              <p className="mt-2 text-sm"><span className="font-semibold">Who: </span>{c.who}</p>
              <p className="mt-1 text-sm"><span className="font-semibold">Why now: </span>{c.timing}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{c.also.map((a) => <span key={a} className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] font-semibold">{a}</span>)}</div>
              <a href={c.post.href} className="mt-auto pt-4 text-sm font-semibold underline underline-offset-4"><FileText className="mr-1 inline size-3.5" />{c.post.label}</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReportingBlock() {
  return (
    <section id="sample-report-hero" className="scroll-mt-20 border-b border-border/70 bg-background" data-testid="reporting-block">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{REPORTING.kicker}</p>
        <h2 className="font-display text-3xl md:text-5xl">{REPORTING.title}</h2>
        <div className="mt-4 flex flex-wrap gap-2">{REPORTING.metrics.map((m) => <span key={m} className="rounded-full bg-[#0b1f3a] px-3 py-1 text-xs font-bold text-lime-300">{m}</span>)}</div>
        <p className="mt-3 text-sm text-muted-foreground">{REPORTING.aggregate}</p>
        <p className="mt-2 inline-block rounded-xl bg-lime-100 px-3 py-2 text-sm font-semibold text-[#0b1f3a]" data-testid="pilot-reporting-commitment">{REPORTING.commitment}</p>
        <div className="mt-6"><SampleReport /></div>
      </div>
    </section>
  );
}

export function ThreeSteps() {
  return (
    <section className="border-b border-border/70 bg-[#f7f5f0]" data-testid="three-steps">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">{THREE_STEPS.kicker}</p>
        <h2 className="font-display text-3xl md:text-5xl">{THREE_STEPS.title}</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {THREE_STEPS.steps.map((s, i) => (
            <li key={s.n} className="relative rounded-2xl bg-white p-5 shadow-sm">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-[#0b1f3a] font-display text-xl text-lime-300">{s.n}</span>
              <h3 className="mt-3 font-display text-2xl">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              {i < 2 ? <ArrowRight aria-hidden className="absolute -right-3 top-1/2 hidden size-6 -translate-y-1/2 text-foreground/40 md:block" /> : null}
            </li>
          ))}
        </ol>
        <a href={THREE_STEPS.sampleIoHref} data-testid="three-steps-sample-io" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4"><FileText className="size-4" />{THREE_STEPS.sampleIoLabel}</a>
      </div>
    </section>
  );
}

export function AgentLine({ className = "" }: { className?: string }) {
  return <p className={`flex items-center gap-2 text-sm ${className}`} data-testid="agent-line"><Bot className="size-4" aria-hidden /><a href={AGENT_LINE.href} className="underline underline-offset-4">{AGENT_LINE.text}</a></p>;
}

/** Entry-point strip for existing pages (home, /media-buyers, /agencies, /media-kit). */
export function KitEntry({ from }: { from: string }) {
  return (
    <section data-testid={`kit-entry-${from}`} className="border-b border-border/70 bg-lime-200">
      <div className="container mx-auto flex flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
        <p className="font-display text-xl text-[#0b1f3a] md:text-2xl">Get your personalized Monetization Kit: revenue + exposure, in four numbers. <span className="text-sm font-sans text-[#0b1f3a]/70">Estimate</span></p>
        <a href="/brand-kit#my-kit" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0b1f3a] px-6 text-sm font-bold text-lime-300"><Download className="size-4" />Get my Monetization Kit</a>
      </div>
    </section>
  );
}
