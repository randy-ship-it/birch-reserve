import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { LOOK_HREF, RESERVE_HREF } from "@/components/br/pricing";

/**
 * Prime-time path (Randy, Nov 13 2026 9:41 PM ET): someone fresh from an ad-sales
 * email understands the offer and reserves space in under 60 seconds.
 * Broad positioning (Randy, Nov 14 2026 8:38 AM ET): buyers get a share of display
 * space across our growing hub network, curated as hubs launch. No public category
 * grid and no seat counts. Prices come from /availability.json so the label is in
 * the buyer's checkout currency (CAD in Canada, USD elsewhere).
 */

export const SALES_PHONE_DISPLAY = "(647) 931-6278";
export const SALES_PHONE_HREF = "tel:+16479316278";
export const SALES_EMAIL = "sales@silverbirchgrowth.com";
export const LIVE_HUB_URL = "https://www.scalehealth.ca/integrity";
export const LIVE_HUB_IMAGE = "/hub-gallery/integrity.webp";

type CategoryStatus = "open" | "waitlist";
export type Availability = {
  seatsOpen: number;
  seatsTotal: number;
  categories: Array<{ slug: string; label: string; status: CategoryStatus }>;
  seatLabel: string;
  lookLabel: string;
};

/** Hub brands in the network today; more launch over time. */
export const NETWORK_HUBS = ["Scale Health", "Calm Joints"] as const;

export function useAvailability(): Availability | null {
  const [a, setA] = useState<Availability | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/availability.json", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || typeof d.seats_open !== "number" || typeof d.seats_total !== "number") return;
        const cur = String(d.currency ?? "USD").toUpperCase();
        const label = (sku: string, fb: string) => d.prices?.[sku]?.[cur]?.label ?? fb;
        setA({
          seatsOpen: d.seats_open,
          seatsTotal: d.seats_total,
          categories: Array.isArray(d.categories) ? d.categories : [],
          seatLabel: label("reserve-490", "$490 USD"),
          lookLabel: label("hold-190", "$190 USD"),
        });
      })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);
  return a;
}

/** Price labels in the buyer's checkout currency; bare USD figures until /availability.json answers. */
export function priceLabels(a: Availability | null): { seat: string; look: string } {
  return { seat: a?.seatLabel ?? "$490", look: a?.lookLabel ?? "$190" };
}

/** The network strip: hub names and limited early access. No category grid, no seat counts. */
export function AvailabilityStrip({ dark = false }: { a?: Availability | null; dark?: boolean }) {
  return (
    <div data-testid="avail-strip">
      <p className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-semibold ${dark ? "border-accent text-background" : "border-foreground bg-white"}`}>
        <span className="relative inline-flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#3b9b00] opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-[#3b9b00]" />
        </span>
        <span data-testid="avail-count"><strong className={dark ? "text-accent" : ""}>Limited early placements</strong> · curated as hubs launch</span>
      </p>
      <ul className="mt-3 flex flex-wrap gap-2" data-testid="network-hubs">
        {NETWORK_HUBS.map((h) => (
          <li key={h} className={`border px-3 py-2 text-[13px] font-semibold leading-tight ${dark ? "border-background/25" : "border-foreground/20 bg-white"}`}>{h}</li>
        ))}
        <li className={`border border-dashed px-3 py-2 text-[13px] font-semibold leading-tight ${dark ? "border-background/30 text-background/70" : "border-foreground/25 text-foreground/60"}`}>+ more hubs launching</li>
      </ul>
    </div>
  );
}

export function PrimeHero() {
  const a = useAvailability();
  const p = priceLabels(a);
  return (
    <section className="border-b border-border/70 bg-foreground text-background" data-testid="prime-hero">
      <div className="container mx-auto px-5 pb-10 pt-8 md:px-6 md:pb-16 md:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Birch Reserve · Display space across private health &amp; wellness hubs</p>
        <h1 className="mt-3 max-w-4xl font-display text-[2.2rem] leading-[1.03] tracking-tight md:text-[4rem]" data-testid="prime-h1">
          Put your brand inside private health and wellness hubs.
        </h1>
        <p className="mt-3 font-display text-xl text-background/80 md:text-3xl" data-testid="prime-scarcity">A growing network. Limited early placements. No bidding.</p>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-background/80" data-testid="prime-what">
          Reserve a share of display space across our growing network of private, members-only hubs: {NETWORK_HUBS.join(", ").replace(/, ([^,]*)$/, " and $1")}, with more on the way. Placements are curated as each hub launches.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={RESERVE_HREF} data-testid="prime-cta-seat" className="inline-flex h-14 items-center justify-center gap-2 bg-accent px-6 text-base font-semibold text-accent-foreground transition-colors hover:bg-background hover:text-foreground">
            Reserve your space — {p.seat} <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href={LOOK_HREF} data-testid="prime-cta-look" className="inline-flex h-14 items-center justify-center gap-2 border border-background/50 px-6 text-base font-semibold text-background transition-colors hover:bg-background hover:text-foreground">
            Take a 7-day look — {p.look} <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <div className="mt-6">
          <AvailabilityStrip dark />
        </div>
        <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-background/80">
          <a href="/media-kit" className="font-semibold text-accent underline underline-offset-4" data-testid="prime-see-seats">See the media kit</a>
          <a href="#request" className="underline underline-offset-4" data-testid="prime-request-link">Ask about a placement</a>
          <a href={SALES_PHONE_HREF} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline" data-testid="prime-phone"><Phone className="size-3.5" aria-hidden />{SALES_PHONE_DISPLAY}</a>
          <a href={`mailto:${SALES_EMAIL}?subject=Birch%20Reserve%20seat`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline" data-testid="prime-email"><Mail className="size-3.5" aria-hidden />{SALES_EMAIL}</a>
        </p>
        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-background/60">
          {p.seat} reserves your share of display space across the network: 100% media credit until the insertion order (IO), fully refundable until 14 days before launch. The {p.look} look gives you 7 days to see your placement and converts in full to the reserve, or is refunded. Premium slots ($25K–$50K, inquire only) add a larger share, priority placement and exclusivity. No impression guarantees. Aggregate reporting only.
        </p>
      </div>
    </section>
  );
}

export function FaceBeforeFlight({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-6 ${compact ? "" : "lg:grid-cols-[1fr_1.1fr] lg:items-center"}`} data-testid="face-before-flight">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/60">Proof</p>
        <h2 className="mt-2 font-display text-[1.9rem] leading-tight tracking-tight md:text-5xl">See the face before the flight.</h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
          Open a live hub right now. This is the private, members-only experience your brand sits inside: placements curated hub by hub, next to the brand members already trust. No feed, no auction.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a href={LIVE_HUB_URL} target="_blank" rel="noopener" data-testid="face-live-hub" className="inline-flex h-12 items-center justify-center gap-2 bg-foreground px-6 text-sm font-semibold text-background transition-colors hover:bg-accent hover:text-accent-foreground">
            Open the live Integrity Fitness hub <ArrowRight className="size-4" aria-hidden />
          </a>
          <a href="https://physio.drhonow.com" target="_blank" rel="noopener" className="inline-flex h-12 items-center justify-center gap-2 border border-foreground/25 px-6 text-sm font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background">
            Or the DR-HO'S physio hub <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Live hubs, shown as they are today. Your placement and hub are named on your IO before anything runs.</p>
      </div>
      <a href={LIVE_HUB_URL} target="_blank" rel="noopener" className="group block border border-foreground/15 bg-white p-2 shadow-sm" aria-label="Open the live Integrity Fitness × Scale Health hub">
        <img src={LIVE_HUB_IMAGE} alt="Integrity Fitness × Scale Health members-only hub, live" width={1440} height={900} loading="lazy" decoding="async" className="block h-auto w-full" />
        <span className="mt-2 flex items-center justify-between px-1 pb-1 text-xs text-muted-foreground">
          <span>scalehealth.ca/integrity · live</span>
          <span className="font-semibold text-foreground group-hover:underline">Open ↗</span>
        </span>
      </a>
    </div>
  );
}

export function FounderNote() {
  return (
    <div className="border border-foreground/15 bg-white p-5 md:p-6" data-testid="founder-note">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/55">Who's behind it</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">
        Birch Reserve is run by Silver Birch Growth Inc. in Toronto. You deal with the founder, Randy Gilling, directly: no reseller and no ad network in between.
      </p>
      <p className="mt-3 text-sm">
        <a href="https://silverbirchgrowth.com" target="_blank" rel="noopener" className="font-semibold underline underline-offset-4">silverbirchgrowth.com</a>
      </p>
    </div>
  );
}

export function CategoryRequestForm({ path = "/", defaultCategory = "" }: { path?: string; defaultCategory?: string }) {
  const [state, setState] = useState<{ status: "idle" | "sending" | "done" | "error"; msg?: string }>({ status: "idle" });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setState({ status: "sending" });
    let utm: Record<string, string> = {};
    try {
      const q = new URLSearchParams(window.location.search);
      utm = { utm_source: q.get("utm_source") ?? "", utm_medium: q.get("utm_medium") ?? "", utm_campaign: q.get("utm_campaign") ?? "" };
    } catch {
      /* ignore */
    }
    try {
      const r = await fetch("/v1/category-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, path, utm }) });
      const o = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (r.ok && o.ok) {
        setState({ status: "done", msg: `Got it. Your request is in. We'll reply to ${data.email} shortly. No card was charged.` });
        return;
      }
      setState({ status: "error", msg: o.error ?? `We could not send that. Call ${SALES_PHONE_DISPLAY} or email ${SALES_EMAIL}.` });
    } catch {
      setState({ status: "error", msg: `We could not send that. Call ${SALES_PHONE_DISPLAY} or email ${SALES_EMAIL}.` });
    }
  }
  const done = state.status === "done";
  const input = "h-12 w-full border border-foreground/25 bg-white px-3 text-base text-foreground outline-none focus:border-foreground focus:ring-2 focus:ring-accent disabled:opacity-60";
  return (
    <form onSubmit={submit} noValidate className="relative border border-foreground bg-white p-5 md:p-6" data-testid="category-request-form">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/55">No card needed</p>
      <h3 className="mt-1 font-display text-2xl md:text-3xl">Ask about a placement</h3>
      <p className="mt-1 text-sm text-muted-foreground">Want to talk first, need something custom, or interested in a premium slot? Tell us your brand and what you sell. Our sales team gets it right away.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/70">Brand name</span>
          <input name="brand" required maxLength={160} autoComplete="organization" className={input} disabled={done} data-testid="cr-brand" />
        </label>
        <input type="hidden" name="category" value={defaultCategory || "other"} data-testid="cr-category" />
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/70">Work email</span>
          <input name="email" type="email" required autoComplete="email" className={input} disabled={done} data-testid="cr-email" />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-foreground/70">What you sell, timing or questions <span className="normal-case tracking-normal text-foreground/50">(optional)</span></span>
          <textarea name="notes" maxLength={1000} rows={3} className="w-full border border-foreground/25 bg-white p-3 text-base outline-none focus:border-foreground focus:ring-2 focus:ring-accent disabled:opacity-60" disabled={done} data-testid="cr-notes" />
        </label>
      </div>
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>Company website<input name="company_website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button type="submit" disabled={done || state.status === "sending"} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 bg-foreground px-6 text-sm font-semibold text-background transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-70" data-testid="cr-submit">
        {state.status === "sending" ? "Sending…" : done ? "Request sent" : "Send request"} {done ? null : <ArrowRight className="size-4" aria-hidden />}
      </button>
      <p role="status" aria-live="polite" className={`mt-3 min-h-5 text-sm font-semibold ${state.status === "error" ? "text-[#b42318]" : "text-[#2f6b00]"}`} data-testid="cr-message">{state.msg ?? ""}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Or call <a className="underline" href={SALES_PHONE_HREF}>{SALES_PHONE_DISPLAY}</a> · <a className="underline" href={`mailto:${SALES_EMAIL}`}>{SALES_EMAIL}</a>
      </p>
    </form>
  );
}
