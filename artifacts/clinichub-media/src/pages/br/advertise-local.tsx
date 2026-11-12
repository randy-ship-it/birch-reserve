import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Lock, MapPin } from "lucide-react";
import { MetaComparison } from "@/components/br/blocks";
import { SlotLadder } from "@/components/br/slot-ladder";
import { Cta, Eyebrow, Faq, Field, H1, H2, JsonLd, Lede, Modelled, Section, inputClass, postJson, useOverhaulStatus, usePageMeta } from "@/components/br/ui";
import { AREA_LOCK, quoteAreaLock, type AreaQuote, type Currency } from "../../../../api-server/src/lib/overhaul/model";

const CATEGORIES = ["Physiotherapy / rehab", "Chiropractic", "Massage therapy", "Gym / fitness studio", "Yoga / pilates studio", "Nutrition / dietitian", "Health food / grocery", "Wellness clinic / naturopath", "Recovery studio (sauna, cold plunge)", "Footwear / orthotics retail", "Pet care / pet store", "Other health & wellness"];

const FAQ = [
  { q: "What does “up to 50%” mean?", a: `We hold up to ${AREA_LOCK.standardSharePct}% of the display slots shown to hub members within ${AREA_LOCK.radiusKm} km of your postal code for your category. In dense downtown cores (for example Toronto M5, downtown Montreal, Vancouver V6B/V6C/V6E and major US downtowns) the cap is ${AREA_LOCK.denseCoreSharePct}% because so many businesses share the same blocks.` },
  { q: "When does my term start?", a: "Your 1 to 6 month term starts the day your displays go live, not the day you pay." },
  { q: "What if traffic in my area grows?", a: "Your share grows with it. You keep the right to keep pace: more views in your area are offered to you first, at your locked discount, before anyone else can buy them." },
  { q: "What do I get for the deposit?", a: `The full deposit becomes media credit at ${AREA_LOCK.discountPct}% off the rate card, plus a guaranteed number of page views across hubs. The view count is modelled from the TAM feed today; final guarantee terms are being confirmed.` },
  { q: "Is it exclusive?", a: "Yes, by category in your area: while your lock is active we won't sell another lock in your category within your radius." },
];

export default function BrAdvertiseLocal() {
  usePageMeta("Lock down my area | Birch Reserve", `Hold up to ${AREA_LOCK.standardSharePct}% of hub display within ${AREA_LOCK.radiusKm} km of your postal code for 1–6 months. $${AREA_LOCK.priceCad.toLocaleString()} CAD / $${AREA_LOCK.priceUsd.toLocaleString()} USD deposit.`);
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [postal, setPostal] = useState(params.get("postal") ?? "");
  const [term, setTerm] = useState(3);
  const [submitted, setSubmitted] = useState(params.get("postal") ?? "");
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(params.get("lock") === "success" ? "Payment received. Your area is locked; we'll email your launch checklist." : params.get("lock") === "cancelled" ? "Checkout cancelled. Your quote is still here." : null);
  const [busy, setBusy] = useState(false);
  const status = useOverhaulStatus();
  const quote = useMemo(() => (submitted ? quoteAreaLock(submitted, term) : null), [submitted, term]);
  const ok = quote && quote.ok ? (quote as AreaQuote) : null;
  const currency: Currency = ok?.currency ?? "cad";
  useEffect(() => {
    if (ok) document.getElementById("quote")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [ok?.area.code]);

  const onCheck = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(postal);
  };
  const onLock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!ok) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setCheckoutMsg(null);
    try {
      const r = await postJson<{ url?: string; error?: string }>("/v1/area/checkout", { postal: ok.area.code, term, category: fd.get("category"), business: fd.get("business"), website: fd.get("website"), email: fd.get("email"), agree: fd.get("agree") === "on", currency: ok.currency });
      if (r.ok && r.data.url) {
        window.location.href = r.data.url;
        return;
      }
      setCheckoutMsg(r.data.error ?? "Couldn't open checkout.");
    } catch {
      setCheckoutMsg("Couldn't open checkout. Email sales@silverbirchgrowth.com.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="br-advertise-local">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Offer", name: "Birch Reserve area lock", description: `Up to ${AREA_LOCK.standardSharePct}% of hub display within ${AREA_LOCK.radiusKm} km for 1-6 months`, priceSpecification: [{ "@type": "PriceSpecification", price: AREA_LOCK.priceCad, priceCurrency: "CAD" }, { "@type": "PriceSpecification", price: AREA_LOCK.priceUsd, priceCurrency: "USD" }], seller: { "@type": "Organization", name: "Birch Reserve" }, url: "https://birchreserve.net/advertise/local" }} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <Eyebrow>Advertise · Local businesses &amp; studios</Eyebrow>
            <H1>Lock down my area.</H1>
            <Lede>
              Put your postal code in. Hold up to <strong>{AREA_LOCK.standardSharePct}%</strong> of hub display within <strong>{AREA_LOCK.radiusKm} km</strong> of you ({AREA_LOCK.denseCoreSharePct}% in busy city centres), for <strong>1 to 6 months</strong> from when your displays start.
            </Lede>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                `$${AREA_LOCK.priceCad.toLocaleString()} CAD or $${AREA_LOCK.priceUsd.toLocaleString()} USD deposit, exclusive in your category`,
                `All of it becomes ad credit at ${AREA_LOCK.discountPct}% off the rate card`,
                "Guaranteed page views across hubs (modelled today)",
                "If traffic grows, you keep the right to keep pace with spend",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Lock className="mt-0.5 size-4 shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-foreground/15 bg-white p-6 md:p-8" id="quote">
            <form onSubmit={onCheck} className="flex flex-col gap-3 sm:flex-row sm:items-end" data-testid="area-form">
              <div className="flex-1">
                <Field label="Postal code or ZIP">
                  <input value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="L4C 3G5 or 98052" className={inputClass} data-testid="area-postal" />
                </Field>
              </div>
              <button className="h-12 bg-foreground px-6 text-sm font-semibold text-background hover:bg-accent hover:text-accent-foreground" data-testid="area-check">
                <MapPin className="mr-1 inline size-4" /> Check my area
              </button>
            </form>
            <div className="mt-5">
              <Field label={`Spend term: ${term} month${term === 1 ? "" : "s"} from display start`}>
                <input type="range" min={1} max={6} value={term} onChange={(e) => setTerm(Number(e.target.value))} className="w-full accent-[hsl(var(--foreground))]" data-testid="area-term" />
              </Field>
            </div>
            {quote && !quote.ok ? <p className="mt-4 text-sm text-destructive">{quote.error}</p> : null}
            {ok ? (
              <div className="mt-6" data-testid="area-quote">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                  <p className="font-display text-2xl">
                    {ok.area.area} · {ok.area.density === "dense_core" ? "Dense downtown core" : ok.area.density === "rural" ? "Rural area" : "Standard area"}
                  </p>
                  <p className="text-sm font-semibold">
                    Up to {ok.sharePct}% of display · {ok.radiusKm} km
                  </p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/55">Deposit</dt>
                    <dd className="font-display text-3xl">${ok.price.toLocaleString()} <span className="text-base">{ok.currency.toUpperCase()}</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/55">Ad credit at rate card</dt>
                    <dd className="font-display text-3xl">${ok.creditAtRateCard.toLocaleString()}</dd>
                    <dd className="text-xs text-muted-foreground">{ok.discountPct}% off</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/55">Guaranteed page views <Modelled /></dt>
                    <dd className="font-display text-3xl">{ok.guaranteedViews.toLocaleString()}</dd>
                    <dd className="text-xs text-muted-foreground">across hubs · ${ok.effectiveCpm.toFixed(2)} {ok.currency.toUpperCase()} per 1,000</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-foreground/55">Your locked local views <Modelled /></dt>
                    <dd className="font-display text-3xl">{ok.lockedMonthly.toLocaleString()}</dd>
                    <dd className="text-xs text-muted-foreground">a month, within {ok.radiusKm} km</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Over {ok.termMonths} month{ok.termMonths === 1 ? "" : "s"}: about {ok.localOverTerm.toLocaleString()} local views at your share{ok.networkTopUp > 0 ? `; the remaining ${ok.networkTopUp.toLocaleString()} guaranteed views come from matched members across the hub network` : ", more than the guarantee"}.
                </p>
                <form onSubmit={onLock} className="mt-6 grid gap-3 border-t border-border pt-5 md:grid-cols-2" data-testid="area-lock-form">
                  <Field label="Business name">
                    <input name="business" required className={inputClass} />
                  </Field>
                  <Field label="Category">
                    <select name="category" required className={inputClass} defaultValue="">
                      <option value="" disabled>
                        Choose…
                      </option>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Website (optional)">
                    <input name="website" className={inputClass} />
                  </Field>
                  <Field label="Work email">
                    <input name="email" type="email" required className={inputClass} />
                  </Field>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground md:col-span-2">
                    <input type="checkbox" name="agree" required className="mt-0.5" /> I agree to the draft area-lock terms (exclusive in my category and radius; term starts at display start; credit refundable before any ad runs). Terms are being finalized.
                  </label>
                  <button type="submit" disabled={busy} className="h-12 bg-accent text-sm font-semibold text-accent-foreground hover:bg-foreground hover:text-background disabled:opacity-60 md:col-span-2" data-testid="area-lock-submit">
                    {busy ? "Opening checkout…" : status?.areaLockCheckout ? `Lock ${ok.area.area} for $${ok.price.toLocaleString()} ${ok.currency.toUpperCase()}` : `Hold ${ok.area.area} (checkout opens at launch)`}
                  </button>
                </form>
              </div>
            ) : null}
            {checkoutMsg ? <p className="mt-4 bg-secondary/60 p-3 text-sm" data-testid="area-msg">{checkoutMsg}</p> : null}
          </div>
        </div>
      </Section>

      <Section tone="soft" id="slots">
        <Eyebrow>Smaller, non-exclusive slots</Eyebrow>
        <H2>Not ready to lock an area? Start smaller.</H2>
        <Lede>Bigger deposits buy the rate down. Credit is open-dated and works on any hub surface.</Lede>
        <div className="mt-10">
          <SlotLadder currency={currency} audience="local" />
        </div>
      </Section>

      <Section>
        <Eyebrow>Why hubs beat the feed</Eyebrow>
        <H2>Local members, inside a brand they trust.</H2>
        <div className="mt-10">
          <MetaComparison />
        </div>
      </Section>

      <Section tone="soft">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <H2>Area lock, plainly.</H2>
            <div className="mt-6">
              <Cta href="/match" variant="line">Check my audience match first</Cta>
            </div>
          </div>
          <Faq items={FAQ} />
        </div>
      </Section>
    </div>
  );
}
