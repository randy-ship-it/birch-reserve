/**
 * Street 100 additions (Randy, Nov 21 2026): "What $100 gets you today", the measured sample report, and the premium spend-down example.
 * All numbers come from the live rate card / ad-event store / pricing modules. Modelled where labelled. No guarantees.
 */
import { skinChat } from "@/lib/siteSkin";
import { useEffect, useState } from "react";
import { Check, Mail, Phone } from "lucide-react";
import { HUNDRED_NOTE, HUNDRED_ROWS, HUNDRED_TITLE } from "../../../../api-server/src/lib/overhaul/hundred";
import { SPEND_DOWN_MAX_MONTHS } from "../../../../api-server/src/lib/inventoryPlan";
import { MEDIA_KIT_CPM, MEDIA_KIT_OFFERS, kitExample, usd } from "../../../../api-server/src/lib/overhaul/mediaKit";
import { HUB_DEMAND_LINE, HUB_DEMAND_SUB, HUB_EARN_LINE, HUB_EARN_TITLE, HUB_PROOF_PATH, HUB_PROOF_TERMS } from "../../../../api-server/src/lib/overhaul/hubEarn";
import { openRandyChat } from "@/lib/book-call";

export function WhatHundredGets() {
  return (
    <details className="group mt-4 max-w-xl rounded-2xl border border-foreground/20 bg-white px-4 py-1" data-testid="what-100">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{HUNDRED_TITLE}</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">$100 credit</span>
      </summary>
      <ul className="divide-y divide-border text-sm">
        {HUNDRED_ROWS.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3 py-2">
            <span>{r.label} <span className="text-xs text-muted-foreground">${r.cpm} CPM</span></span>
            <b className="text-right">about {r.views.toLocaleString("en-US")} views</b>
          </li>
        ))}
      </ul>
      <p className="pb-3 pt-2 text-xs text-muted-foreground">{HUNDRED_NOTE}</p>
    </details>
  );
}

type Report = { available: boolean; from?: string; to?: string; days?: number; totalViews?: number; totalClicks?: number; surfaces?: Array<{ key: string; label: string; views: number; clicks: number }>; source: string };

const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Real measured aggregate. Renders nothing until the store has real (non-test) events. */
export function MeasuredReport() {
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => {
    fetch("/v1/ads/sample-report").then((x) => x.json()).then(setR).catch(() => setR(null));
  }, []);
  if (!r?.available || !r.surfaces?.length) return null;
  return (
    <div className="mt-6 rounded-2xl border border-foreground/20 bg-white p-5" data-testid="measured-report">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Measured on a live hub</p>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-accent-foreground">{fmtDay(r.from!)}{r.from !== r.to ? ` – ${fmtDay(r.to!)}` : ""}</span>
      </div>
      <p className="mt-2 font-display text-2xl">{r.totalViews!.toLocaleString("en-US")} views{r.totalClicks ? ` · ${r.totalClicks.toLocaleString("en-US")} clicks` : ""}</p>
      <div className="mt-3 divide-y divide-border text-sm">
        {r.surfaces.map((s) => (
          <div key={s.key} className="flex items-baseline justify-between gap-3 py-2">
            <span>{s.label}</span>
            <span className="text-right">{s.views.toLocaleString("en-US")} views{s.clicks ? ` · ${s.clicks.toLocaleString("en-US")} UTM-tagged visits` : ""}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{skinChat("Anonymized aggregate. Counted by the Birch ad server on live hubs;")} test and QA traffic excluded. Clicks land on the brand's site tagged by surface (utm_content). A sample of what your report looks like, not a forecast or a guarantee.</p>
    </div>
  );
}

/** Two annotated real placements (screenshots captured from the live hubs). */
export function YourCardHere() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2" data-testid="your-card-here">
      {[
        { src: "/proof/drhos-card-here.jpg", alt: "DR-HO'S hub with a marked space labelled 'your card here'", cap: "DR-HO'S, the booking confirmation" },
        { src: "/proof/sole-card-here.jpg", alt: "SOLE hub with a marked space labelled 'your card here'", cap: "SOLE, the member page" },
      ].map((s) => (
        <figure key={s.src} className="overflow-hidden rounded-2xl border border-foreground/20 bg-white">
          <img src={s.src} alt={s.alt} loading="lazy" className="block h-auto w-full" />
          <figcaption className="px-4 py-2 text-xs text-muted-foreground">{s.cap}. Real hub, marked to show where your card sits.</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Illustrative only, built from the actual pricing rules: 100% of payment is media credit, paced over up to 6 months, 12-month validity. */
export function PremiumSpendDown() {
  const spend = MEDIA_KIT_OFFERS.premium.spendLo;
  const ex = kitExample(spend, 0);
  const perMonth = Math.round(spend / SPEND_DOWN_MAX_MONTHS);
  const k = (n: number) => `${(n / 1_000_000).toFixed(1)}M`;
  return (
    <details className="group mt-5 rounded-2xl bg-background/10 px-4 py-1 text-sm text-background" data-testid="premium-spend-down">
      <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold [&::-webkit-details-marker]:hidden">Example: how a {usd(spend)} slot spends down</summary>
      <ul className="space-y-2 pb-2 text-background/85">
        <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />You prepay {usd(spend)} USD. All of it is media credit.</li>
        <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Your IO names the hubs and sets the pacing: for example about {usd(perMonth)} a month over {SPEND_DOWN_MAX_MONTHS} months, or faster.</li>
        <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Modelled: about {k(ex.imprLo)}–{k(ex.imprHi)} impressions in total at ${MEDIA_KIT_CPM.lo}–${MEDIA_KIT_CPM.hi} CPM.</li>
        <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />Credit stays valid for 12 months from payment.</li>
      </ul>
      <p className="pb-3 text-xs text-background/65">An example, not a quote or a guarantee. Inquire only: no card purchase, and nothing runs until the IO names the hub. Aggregate reporting only.</p>
      <div className="flex flex-col gap-2 pb-4 sm:flex-row">
        <a href="tel:+16479316278" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground"><Phone className="size-4" aria-hidden /> (647) 931-6278</a>
        <a href="mailto:randy@scalehealth.ca?subject=Premium%20slot%20inquiry" className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-background/45 px-5 text-sm font-semibold"><Mail className="size-4" aria-hidden /> Email sales</a>
        <button type="button" onClick={() => openRandyChat({ reason: "book-a-call" })} className="inline-flex h-11 items-center justify-center rounded-full border border-background/45 px-5 text-sm font-semibold">Talk to Randy</button>
      </div>
    </details>
  );
}

/** Hub-owner demand message + "Activate your own hub, earn $100" (terms expandable). */
export function HubDemandCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-foreground/15 bg-white p-4 ${className}`} data-testid="hub-demand">
      <p className="font-display text-xl leading-snug">{HUB_DEMAND_LINE}</p>
      <p className="mt-1 text-sm text-foreground/75">{HUB_DEMAND_SUB}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-accent/70 px-3 py-2.5">
        <span className="text-sm font-bold">{HUB_EARN_TITLE}</span>
        <a href={HUB_PROOF_PATH} data-testid="hub-proof-cta" className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background">Send my proof</a>
      </div>
      <p className="mt-2 text-sm text-foreground/75">{HUB_EARN_LINE}</p>
      <details className="mt-1 text-xs text-foreground/65">
        <summary className="flex min-h-10 cursor-pointer items-center font-semibold">Terms</summary>
        <ul className="list-disc space-y-1 pl-5 pb-2">{HUB_PROOF_TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
      </details>
    </div>
  );
}
