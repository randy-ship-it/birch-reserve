/**
 * Offer ladder, rising in order (Nov 21 2026, attention review: "raise the stakes as you go"). Only prices that
 * already exist: look and reserve from the live price labels, sponsorship credit from DEPOSIT_TIERS, premium inquire-only.
 * Credit, not a performance promise; nothing is charged here.
 */
import { ArrowRight } from "lucide-react";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";
import { trackAttn } from "@/lib/attention";
import { trackCta } from "@/lib/track-cta";
import { DEPOSIT_TIERS } from "../../../../api-server/src/lib/sponsorKit";

const k = (n: number) => (n >= 1000 ? `$${n / 1000}K` : `$${n}`);

export function OfferStairs({ look, seat, testId = "offer-stairs" }: { look: string; seat: string; testId?: string }) {
  const lo = DEPOSIT_TIERS[0]!.usd;
  const hi = DEPOSIT_TIERS[DEPOSIT_TIERS.length - 1]!.usd;
  const steps = [
    { key: "look" as const, n: "1", price: look, name: "7-day look", line: "See it on a hub. Converts to a reserve or is refunded.", href: LOOK_HREF, h: "md:h-[150px]", tone: "bg-white text-[#0b1f3a] border border-[#0b1f3a]/15", cta: () => trackCta("cta_hold_190", { offer: "hold-190" }) },
    { key: "reserve" as const, n: "2", price: seat, name: "Category placement", line: "Your slot, as media credit toward your insertion order.", href: RESERVE_HREF, h: "md:h-[190px]", tone: "bg-lime-200 text-[#0b1f3a]", cta: () => trackCta("cta_reserve_490", { offer: "reserve-490" }) },
    { key: "sponsor" as const, n: "3", price: `${k(lo)}–${k(hi)}`, name: "Sponsor", line: "Prepaid credit with bonus credit, across more hubs.", href: "/sponsor", h: "md:h-[230px]", tone: "bg-[#0E3B2A] text-white", cta: () => undefined },
    { key: "premium" as const, n: "4", price: "$25,000–$1.5M USD", name: "Blocks", line: "Larger share and priority placement. Inquire only. We write the IO.", href: "/media-kit#premium", h: "md:h-[270px]", tone: "bg-[#0b1f3a] text-white", cta: () => undefined },
  ];
  return (
    <div data-testid={testId}>
      <ol className="grid grid-cols-2 items-end gap-3 md:grid-cols-4">
        {steps.map((s) => (
          <li key={s.key} className="flex">
            <a
              href={s.href}
              onClick={() => { trackAttn(`ladder.${s.key}`); s.cta(); }}
              className={`group flex min-h-[150px] w-full flex-col ${s.h} justify-between rounded-2xl p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${s.tone}`}
              data-testid={`stair-${s.key}`}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">Step {s.n} · {s.name}</span>
              <span className="mt-1 block font-display text-3xl leading-none md:text-4xl">{s.price}</span>
              <span className="mt-2 block text-[13px] leading-snug opacity-80">{s.line}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold">{s.key === "premium" ? "Inquire" : s.key === "sponsor" ? "See tiers" : "Start"} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden /></span>
            </a>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12px] text-foreground/55">Prices in USD. Every dollar is media credit. Results are not guaranteed.</p>
    </div>
  );
}
