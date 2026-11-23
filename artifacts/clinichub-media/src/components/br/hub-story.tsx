/**
 * Hub story blocks (Randy, Nov 23 2026 8:16 and 8:21 AM ET). Short, visual, details in expanders. Every block reads the
 * one hub ladder (api-server/src/lib/hubLadder.ts) and the existing proof content; no new figures, no new claims.
 *   OwnTheMoment  the card sits on the page already open, right after the booking or purchase (example mocks on two Live hubs)
 *   FourSteps     look or reserve -> mock on a live hub -> sign the insertion order -> flight runs, aggregate report
 *   SeeTheProof   Measured / Estimate / Illustrative / Internal testing, each linked to what already exists
 * Words are skin-neutral, so the Scale mirror speaks as Scale Health with the same blocks.
 */
import { ArrowRight } from "lucide-react";
import { HubMock } from "@/components/br/two-lane";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { siteUrl } from "@/lib/siteSkin";
import { REGION_MIX, AUDIENCE_SNAPSHOT } from "../../../../api-server/src/lib/overhaul/audiences";
import { IO_EXPLAINER } from "../../../../api-server/src/lib/ioExplain";
import { HUB_MOCKS } from "@/lib/hub-mocks";

const NAVY = "#0b1f3a";

export function OwnTheMoment({ testId = "own-the-moment" }: { testId?: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">Own the moment</p>
      <h2 className="mt-1 max-w-3xl font-display text-3xl leading-tight text-[#0b1f3a] md:text-4xl">The card sits on the page already open, right after the booking or purchase.</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["drho", "sole"] as const).map((k) => (
          <figure key={k} className="min-w-0" data-testid={`${testId}-${k}`}>
            <HubMock brand="" logo={null} hub={k} category="Your category" badge="Example mockup" />
            <figcaption className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-foreground/70">
              <span className="rounded-full border border-[#F1D58F] bg-[#FFF4DB] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8A5A00]">Example mockup</span>
              <span className="font-semibold text-[#0b1f3a]">{HUB_MOCKS[k].name}</span>
              <span>· {HUB_MOCKS[k].surface}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-foreground/60">Illustrative mockups, not live ads. Your insertion order names the hub and surface before anything runs.</p>
    </div>
  );
}

export function FourSteps({ look, seat, testId = "four-steps" }: { look: string; seat: string; testId?: string }) {
  const steps = [
    { n: "1", title: `${look} look or ${seat} reserve`, line: "Media credit, not a fee. The look converts to a reserve or is refunded.", href: LOOK_HREF },
    { n: "2", title: "See the mock on a live hub", line: "Your card on DR-HO'S or SOLE, shown as an example mockup.", href: RESERVE_HREF },
    { n: "3", title: "Sign the insertion order (IO)", line: "It names the hub, surface, category and dates. Nothing runs until the IO is signed and approved.", href: undefined },
    { n: "4", title: "The flight runs, you get the report", line: "Aggregate report only. First measured reports coming soon.", href: undefined },
  ];
  return (
    <div data-testid={testId}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">How buying works</p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n} className="relative min-w-0 rounded-2xl border border-[#0b1f3a]/10 bg-white p-4 pl-16 shadow-sm sm:pl-4 sm:pt-16" data-testid={`${testId}-${s.n}`}>
            <span className="absolute left-4 top-4 grid size-9 place-items-center rounded-full font-display text-lg font-bold text-lime-300" style={{ background: NAVY }} aria-hidden>{s.n}</span>
            <span className="block text-base font-bold leading-snug text-[#0b1f3a]">{s.title}</span>
            <span className="mt-1 block text-[13px] leading-snug text-foreground/70">{s.line}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12px] leading-snug text-foreground/65" data-testid={`${testId}-refund`}>
        The {look} look is credited to the reserve if you convert within 7 days, otherwise refunded. The reserve is media credit, fully refundable until 14 days before the launch date on your insertion order. Nothing runs until the IO. Not a guarantee of views, clicks or results.
      </p>
      <details className="mt-2 rounded-xl border border-[#0b1f3a]/10 bg-white px-3 py-2 text-[13px]" data-testid={`${testId}-io`}>
        <summary className="cursor-pointer font-semibold text-[#0b1f3a]">What is an insertion order (IO)?</summary>
        <p className="mt-1.5 leading-snug text-foreground/75">{IO_EXPLAINER}</p>
      </details>
    </div>
  );
}

type Tag = "Measured" | "Estimate" | "Illustrative, not results" | "Internal testing, not ad results";
const TAG_CLS: Record<Tag, string> = {
  Measured: "bg-[#BFF3D6] text-[#0B6B43]",
  Estimate: "border border-[#F1D58F] bg-[#FFF4DB] text-[#8A5A00]",
  "Illustrative, not results": "border border-[#F1D58F] bg-[#FFF4DB] text-[#8A5A00]",
  "Internal testing, not ad results": "bg-[#0b1f3a]/10 text-[#0b1f3a]",
};

export function SeeTheProof({ testId = "see-the-proof", id = "see-the-proof" }: { testId?: string; id?: string }) {
  const geo = REGION_MIX.slice(0, 2).map((r) => `${r.label} ${r.pct}%`).join(" · ");
  const cards: { tag: Tag; title: string; line: string; href: string; cta: string }[] = [
    { tag: "Illustrative, not results", title: "Example flight report", line: "The layout you get after a flight. Round example numbers, aggregate only. First measured reports coming soon.", href: "/media-kit#flight-report", cta: "See the layout" },
    { tag: "Estimate", title: "Estimated performance ranges", line: "Based on comparables, not our results. Not a guarantee.", href: "/media-kit#performance-ranges", cta: "See the ranges" },
    { tag: "Measured", title: "Hub session geography", line: `${geo} of located hub sessions, ${AUDIENCE_SNAPSHOT.measuredWindow}. Shares only.`, href: "/audiences#signals", cta: "See the shares" },
    { tag: "Measured", title: "Launch brands feeding the audience", line: "Brand launches on the hubs, shown with the audiences they bring.", href: "/audiences#signals", cta: "See the audiences" },
    { tag: "Internal testing, not ad results", title: "Partnership bot, 19-day example", line: "Our $3,500 USD setup runs the same bot we use: a virtual care partner went from first email to ready to sign in 19 days.", href: "/gtm-bot", cta: "See the example" },
  ];
  return (
    <div data-testid={testId} id={id}>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/55">See the proof</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a key={c.title} href={siteUrl(c.href)} data-mirror-keep className="group flex min-w-0 flex-col rounded-2xl border border-[#0b1f3a]/10 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" data-testid={`${testId}-${c.tag === "Measured" ? "measured" : "other"}`}>
            <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${TAG_CLS[c.tag]}`}>{c.tag}</span>
            <span className="mt-2 block text-base font-bold leading-snug text-[#0b1f3a]">{c.title}</span>
            <span className="mt-1 block flex-1 text-[13px] leading-snug text-foreground/70">{c.line}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#0b1f3a]">{c.cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-foreground/60">Measured means counted on our own hubs. Estimates, ranges and example layouts are labelled and are not results or guarantees.</p>
    </div>
  );
}
