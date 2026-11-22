/**
 * The one pricing component (BR-15 move 4, Randy, Nov 21 2026 3:34 PM ET: "it is based on where you are coming from").
 * Same steps and copy as the server pages (api-server/src/lib/priceLadder.ts), in the visitor's currency:
 * $190 look → $490 reserve → $1,900 exclusive reserve that locks a $5K–$50K package; $25K–$50K premium is inquire-only.
 */
import { siteUrl } from "@/lib/siteSkin";
import { ArrowRight } from "lucide-react";
import { CurrencyToggle } from "@/components/currency-toggle";
import { useCurrency } from "@/lib/currency";
import { PREMIUM_RANGE, priceLadder } from "../../../../api-server/src/lib/priceLadder";

export function PriceLadder({ title = "Every step, in your currency", premiumHref = "#premium", dark = false }: { title?: string; premiumHref?: string; dark?: boolean }) {
  const { currency } = useCurrency();
  const steps = priceLadder(currency);
  const abs = (href: string) => (href.startsWith("/") ? `${siteUrl(href)}${href.includes("?") ? "&" : "?"}currency=${currency}` : href);
  return (
    <section data-testid="price-ladder" data-currency={currency} aria-label="Prices" className="my-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`font-display text-2xl leading-tight md:text-3xl ${dark ? "text-white" : "text-[#071A39]"}`}>{title}</h2>
        <CurrencyToggle />
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key} className={`relative flex flex-col gap-1 rounded-lg border p-4 ${dark ? "border-white/20 bg-white/[0.04] text-white" : "border-[#D9DDE3] bg-white text-[#071A39]"}`} data-testid={`ladder-${s.key}`}>
            <span className={`absolute right-3 top-3 font-mono text-xs ${dark ? "text-white/50" : "text-[#6B7785]"}`}>{i + 1}</span>
            <b className="text-2xl font-semibold tabular-nums">{s.price}</b>
            <span className="text-sm font-semibold">{s.name}</span>
            <span className={`flex-1 text-[13px] leading-snug ${dark ? "text-white/70" : "text-[#4D5B6A]"}`}>{s.line}</span>
            <a href={abs(s.href)} className="mt-1 inline-flex min-h-10 items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline">{s.cta} <ArrowRight className="size-4" aria-hidden /></a>
          </li>
        ))}
      </ol>
      <p className={`mt-3 text-[13px] ${dark ? "text-white/70" : "text-[#4D5B6A]"}`}>
        Premium slots, {PREMIUM_RANGE}, are the top of the range: one brand, priority placement, set on an insertion order. <a href={premiumHref} className="font-semibold underline underline-offset-2">Inquire</a>.
      </p>
    </section>
  );
}
