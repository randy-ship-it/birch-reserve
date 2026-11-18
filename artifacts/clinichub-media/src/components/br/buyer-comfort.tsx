/**
 * Buyer-comfort additions (Randy, Nov 17 2026 ET). Copy is shared with /buycalc via
 * api-server/src/lib/buyerComfort.ts. Additions only: nothing here replaces existing copy.
 */
import {
  BUYER_FAQ,
  CREATIVE_BRIEF_HREF,
  EARLY_SLOTS,
  FLIGHT_TIMELINE,
  LIVE_HUB_LINKS,
  MODELLING_NOTE,
  SAMPLE_IO_HREF,
  SAMPLE_IO_LINKS,
  SAMPLE_REPORT,
  SEE_THE_UNIT,
  SEE_THE_UNIT_IMAGE,
} from "../../../../api-server/src/lib/buyerComfort";

export function EarlySlots({ dark = false }: { dark?: boolean }) {
  return (
    <p className={`mt-3 max-w-2xl text-sm ${dark ? "text-background/80" : "text-foreground/80"}`} data-testid="early-slots">
      <strong className={dark ? "text-accent" : ""}>{EARLY_SLOTS.label}.</strong> {EARLY_SLOTS.line}
    </p>
  );
}

export function ModellingNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`} data-testid="modelling-note">
      {MODELLING_NOTE}
    </p>
  );
}

export function SampleIoLink({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm ${className}`}>
      <a href={SAMPLE_IO_HREF} className="font-semibold underline underline-offset-4" data-testid="sample-io-link">{SAMPLE_IO_LINKS.kitLabel}</a>
    </p>
  );
}

export function SeeTheUnit() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start" data-testid="see-the-unit">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">{SEE_THE_UNIT.kicker}</p>
        <h2 className="mt-2 font-display text-[1.75rem] leading-tight tracking-tight md:text-4xl">{SEE_THE_UNIT.title}</h2>
        <p className="mt-4 text-base leading-relaxed text-foreground/80">{SEE_THE_UNIT.body}</p>
        <p className="mt-4 text-sm font-semibold">{SEE_THE_UNIT.getTitle}</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
          <li>{SEE_THE_UNIT.gets[0]}</li>
          <li>
            {SEE_THE_UNIT.gets[1]}{" "}
            {LIVE_HUB_LINKS.map((h, i) => (
              <span key={h.href}>
                {i > 0 ? " and " : ""}
                <a href={h.href} target="_blank" rel="noopener" className="underline underline-offset-2">{h.label}</a>
              </span>
            ))}
            .
          </li>
          <li>
            The <a href={CREATIVE_BRIEF_HREF} className="underline underline-offset-2">creative brief</a> and the{" "}
            <a href={SAMPLE_IO_HREF} className="underline underline-offset-2">sample insertion order</a>, so you know what the next step asks for.
          </li>
          <li>
            A real person: <a href="tel:+16479316278" className="underline underline-offset-2">(647) 931-6278</a> or{" "}
            <a href="mailto:sales@silverbirchgrowth.com" className="underline underline-offset-2">sales@silverbirchgrowth.com</a>.
          </li>
        </ul>
        <p className="mt-4 text-sm text-foreground/80">{SEE_THE_UNIT.decide}</p>
      </div>
      <figure className="m-0 border border-foreground/20 bg-white p-2">
        <span className="mb-2 inline-block bg-accent px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-foreground">Illustrative</span>
        <img src={SEE_THE_UNIT_IMAGE} alt={SEE_THE_UNIT.imageAlt} width={1280} height={970} loading="lazy" decoding="async" className="block h-auto w-full" />
        <figcaption className="mt-2 text-xs text-muted-foreground">{SEE_THE_UNIT.caption}</figcaption>
      </figure>
    </div>
  );
}

export function FlightTimeline() {
  return (
    <div data-testid="flight-timeline">
      <ol className="grid gap-3 md:grid-cols-3">
        {FLIGHT_TIMELINE.steps.map((s) => (
          <li key={s.n} className="border border-foreground/20 bg-white p-4">
            <span className="font-display text-2xl text-foreground/40">{s.n}</span>
            <h3 className="mt-1 font-display text-lg">{s.t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">{FLIGHT_TIMELINE.refundTitle}</p>
      <div className="mt-3 grid gap-3 border-t-2 border-foreground pt-3 md:grid-cols-3">
        {FLIGHT_TIMELINE.refunds.map((r) => (
          <div key={r.k} className="text-sm">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="inline-block size-2.5 rounded-full border-2 border-foreground bg-accent" aria-hidden />
              {r.k}
            </p>
            <p className="mt-1 text-foreground/80">{r.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SampleReport() {
  return (
    <div data-testid="sample-report">
      <p className="text-sm text-foreground/80">{SAMPLE_REPORT.body}</p>
      <div className="relative mt-4 overflow-x-auto border border-foreground/20 bg-white">
        <span className="pointer-events-none absolute right-3 top-2 bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">Sample layout</span>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-foreground/20">
              {SAMPLE_REPORT.columns.map((c) => (
                <th key={c} className="px-3 py-2 pt-8 text-xs font-semibold uppercase tracking-wider text-foreground/60">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SAMPLE_REPORT.rows.map((r, i) => (
              <tr key={i} className="border-b border-border">
                {r.map((cell, j) => (
                  <td key={j} className={`px-3 py-2 ${j >= 3 ? "font-mono text-foreground/60" : ""}`}>{cell}</td>
                ))}
              </tr>
            ))}
            <tr className="font-semibold">
              {SAMPLE_REPORT.total.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j >= 3 ? "font-mono text-foreground/60" : ""}`}>{cell}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{SAMPLE_REPORT.caption}</p>
    </div>
  );
}

export function BuyerFaq() {
  return (
    <div className="space-y-2" data-testid="buyer-faq">
      {BUYER_FAQ.map((f) => (
        <details key={f.q} className="border border-foreground/20 bg-white p-4">
          <summary className="cursor-pointer font-semibold">{f.q}</summary>
          <p className="mt-2 text-sm text-foreground/80">
            {f.a}
            {f.link ? (
              <>
                {" "}
                <a href={f.link.href} className="font-semibold underline underline-offset-2">{f.link.label}</a>.
              </>
            ) : null}
          </p>
        </details>
      ))}
    </div>
  );
}

export { SAMPLE_REPORT, FLIGHT_TIMELINE };
