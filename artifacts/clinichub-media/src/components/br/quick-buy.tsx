/**
 * Self-serve quick buy (Nov 12 2026): pick a placement, pick a budget, see the
 * modelled views and starter CPM, then hand off to the EXISTING /buycalc
 * checkout (POST /v1/checkout -> Stripe). No new payment code, no new prices:
 * amounts come from the existing $190 look / $490 seat offers and starter CPMs
 * from overhaul/pricing.ts. Views are modelled estimates, never guaranteed.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { priceLabel, useCurrency } from "@/lib/currency";
import { trackCta } from "@/lib/track-cta";
import { SURFACES } from "../../../../api-server/src/lib/overhaul/model";
import { RATE_SURFACES, fmtViews } from "../../../../api-server/src/lib/overhaul/pricing";
import { PREMIUM_INQUIRY_KIND, PREMIUM_INQUIRY_MESSAGE, isPremiumPlacement } from "../../../../api-server/src/lib/premiumInquireOnly";
import { LeadForm } from "./lead-form";

type PlacementKey = (typeof SURFACES)[number]["key"];
type Sku = "reserve-490" | "hold-190";

/** Starter CPM per hub placement (same source as the rate card). */
const STARTER_CPM: Record<PlacementKey, number> = {
  post_purchase: RATE_SURFACES.find((s) => s.key === "post_purchase")!.cpmStarter[0],
  hub_home: RATE_SURFACES.find((s) => s.key === "landing")!.cpmStarter[0],
  product_services: RATE_SURFACES.find((s) => s.key === "products")!.cpmStarter[0],
  member_dashboard: RATE_SURFACES.find((s) => s.key === "dashboard")!.cpmStarter[0],
};

/** Closest existing /buycalc "Where it shows" value (the checkout's format_pref enum). */
const BUYCALC_FORMAT: Record<PlacementKey, string> = {
  post_purchase: "post_checkout",
  hub_home: "recovery_plan",
  product_services: "scheduled_service",
  member_dashboard: "member_hub",
};

/** The $490 seat is all media credit; views are modelled off the USD credit at the starter CPM. */
const SEAT_CREDIT_USD = 490;

export function modelledViews(placement: PlacementKey): number {
  return Math.round(((SEAT_CREDIT_USD / STARTER_CPM[placement]) * 1000) / 100) * 100;
}

export function quickBuyHref(placement: PlacementKey, sku: Sku, currency: string): string {
  const q = new URLSearchParams({ sku, format: BUYCALC_FORMAT[placement], currency });
  return `/buycalc?${q.toString()}#reserve`;
}

/** Self-serve default (Post-Purchase is inquire-only). */
export const QUICK_BUY_DEFAULT_PLACEMENT: PlacementKey = "product_services";

export function InquireBadge({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`ml-2 inline-flex items-center border px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider ${dark ? "border-background/60" : "border-current"}`} data-testid="inquire-badge">
      Inquire
    </span>
  );
}

type InquiryPicks = { placement?: string; sku?: string; block?: string; surfaces?: string; source: string };

/** Read a pack inquiry handed over from the rate-card pack picker (?inquire=pack&block=&surfaces=). */
function inquiryFromUrl(): InquiryPicks | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get("inquire") !== "pack") return null;
  return { block: q.get("block") ?? undefined, surfaces: q.get("surfaces") ?? undefined, source: "pack-picker" };
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-testid={testId}
      className={`min-h-12 w-full border px-4 py-3 text-left text-sm font-semibold transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-foreground/25 bg-white hover:border-foreground"}`}
    >
      {children}
    </button>
  );
}

export function QuickBuy() {
  const { currency } = useCurrency();
  const [placement, setPlacement] = useState<PlacementKey | null>(QUICK_BUY_DEFAULT_PLACEMENT);
  const [sku, setSku] = useState<Sku>("reserve-490");
  const [inquiry, setInquiry] = useState<InquiryPicks | null>(null);
  const inquiryRef = useRef<HTMLDivElement>(null);
  const premium = placement ? isPremiumPlacement(placement) : false;
  useEffect(() => {
    const fromUrl = inquiryFromUrl();
    if (fromUrl) setInquiry(fromUrl);
  }, []);
  useEffect(() => {
    if (inquiry) inquiryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [inquiry]);
  const cpm = placement ? STARTER_CPM[placement] : null;
  const views = placement ? modelledViews(placement) : null;
  const href = placement ? quickBuyHref(placement, sku, currency) : "#quick-buy";
  return (
    <div data-testid="quick-buy-wrap">
    <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]" data-testid="quick-buy">
      <div className="border border-foreground/15 bg-white p-5 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">1. Where should your ad show?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Placement">
          {SURFACES.map((s) => (
            <Chip key={s.key} on={placement === s.key} onClick={() => setPlacement(s.key)} testId={`qb-placement-${s.key}`}>
              {s.label}
              {isPremiumPlacement(s.key) ? <InquireBadge /> : null}
              <span className="block text-xs font-normal opacity-70">from ${STARTER_CPM[s.key]} CPM</span>
            </Chip>
          ))}
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-foreground/60">2. Pick your start</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Budget">
          <Chip on={sku === "reserve-490"} onClick={() => setSku("reserve-490")} testId="qb-sku-reserve-490">
            {priceLabel("reserve-490", currency)} · Category seat
            <span className="block text-xs font-normal opacity-70">All of it is media credit</span>
          </Chip>
          <Chip on={sku === "hold-190"} onClick={() => setSku("hold-190")} testId="qb-sku-hold-190">
            {priceLabel("hold-190", currency)} · 7-day look
            <span className="block text-xs font-normal opacity-70">Credits in full to the seat within 7 days</span>
          </Chip>
        </div>
      </div>
      <div className="flex flex-col border border-foreground bg-foreground p-5 text-background md:p-7" aria-live="polite" data-testid="qb-estimate">
        <p className="text-xs font-semibold uppercase tracking-wider text-background/60">3. Your estimate</p>
        {placement && cpm && views ? (
          sku === "reserve-490" ? (
            <>
              <p className="mt-2 font-display text-5xl text-accent" data-testid="qb-views">~{views.toLocaleString("en-US")}</p>
              <p className="text-sm text-background/75">estimated views (modelled) on {SURFACES.find((s) => s.key === placement)!.label}</p>
              <p className="mt-3 text-sm text-background/75">
                at a <b className="text-background">${cpm} CPM</b> starter rate, for {priceLabel("reserve-490", currency)} of media credit.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 font-display text-4xl text-accent">7-day look</p>
              <p className="mt-2 text-sm text-background/75">
                Build and see your placement first. Move to the {priceLabel("reserve-490", currency)} seat within 7 days and all {priceLabel("hold-190", currency)} credits over (about {views.toLocaleString("en-US")} modelled views at ${cpm} CPM), otherwise it is refunded.
              </p>
            </>
          )
        ) : (
          <p className="mt-2 text-sm text-background/75">Pick a placement to see modelled views and the starter CPM.</p>
        )}
        {premium ? (
          <button
            type="button"
            data-testid="qb-inquire"
            onClick={() => {
              trackCta("cta_book_call");
              setInquiry({ placement: placement ?? undefined, sku, source: "quick-buy" });
            }}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            Send inquiry <ArrowRight className="size-4" aria-hidden />
          </button>
        ) : (
        <a
          href={href}
          aria-disabled={!placement}
          data-testid="qb-checkout"
          onClick={(e) => {
            if (!placement) {
              e.preventDefault();
              document.querySelector<HTMLButtonElement>('[data-testid="qb-placement-post_purchase"]')?.focus();
              return;
            }
            trackCta(sku === "reserve-490" ? "cta_reserve_490" : "cta_hold_190", { offer: sku });
          }}
          className={`mt-6 inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-semibold transition-colors ${placement ? "bg-accent text-accent-foreground hover:bg-background hover:text-foreground" : "cursor-not-allowed bg-background/20 text-background/60"}`}
        >
          {placement ? `Continue to secure checkout · ${priceLabel(sku, currency)}` : "Pick a placement first"} <ArrowRight className="size-4" aria-hidden />
        </a>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-background/55">
          {premium ? `${PREMIUM_INQUIRY_MESSAGE} ` : "Next: brand, work email, then Stripe. "} Views are modelled estimates, not a guarantee. Fully refundable until 14 days before your launch date; your insertion order names the hub before anything runs.
        </p>
      </div>
    </div>
    {inquiry ? <PremiumInquiry ref={inquiryRef} picks={inquiry} currency={currency} /> : null}
    </div>
  );
}

function placementLabel(key?: string): string {
  return SURFACES.find((s) => s.key === key)?.label ?? "";
}

/** Prefilled inquiry for premium picks. Posts to the existing /v1/leads inquiry path (kind premium_inquiry). */
function PremiumInquiry({ picks, currency, ref }: { picks: InquiryPicks; currency: string; ref: React.Ref<HTMLDivElement> }) {
  const surfaces = (picks.surfaces ?? "").split(",").filter(Boolean);
  const summary = [
    picks.placement ? `Placement: ${placementLabel(picks.placement)}` : "",
    picks.sku ? `Start: ${priceLabel(picks.sku, currency as never)} ${picks.sku === "hold-190" ? "7-day look" : "category seat"}` : "",
    picks.block ? `View block: ${fmtViews(Number(picks.block))} views per surface` : "",
    surfaces.length ? `Surfaces: ${surfaces.map((k) => RATE_SURFACES.find((s) => s.key === k)?.short ?? k).join(", ")}` : "",
  ].filter(Boolean);
  return (
    <div ref={ref} className="mt-6 scroll-mt-24 border border-foreground bg-white p-5 md:p-7" data-testid="premium-inquiry">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
        Premium slot <InquireBadge />
      </p>
      <h3 className="mt-2 font-display text-2xl">Send an inquiry for this slot.</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{PREMIUM_INQUIRY_MESSAGE} No card is charged.</p>
      <div className="mt-5">
        <LeadForm
          kind={PREMIUM_INQUIRY_KIND}
          testId="form-premium-inquiry"
          submitLabel="Send inquiry"
          done={<p>Thanks. We'll reply with an insertion order for this slot. No card was charged.</p>}
          fields={[
            { name: "company", label: "Brand", required: true },
            { name: "email", label: "Work email", type: "email", required: true },
            { name: "website", label: "Website", type: "url", placeholder: "https://" },
            { name: "message", label: "Your picks", type: "textarea", defaultValue: summary.join("\n") },
            { name: "placement", label: "", type: "hidden", defaultValue: picks.placement ?? "" },
            { name: "sku", label: "", type: "hidden", defaultValue: picks.sku ?? "" },
            { name: "view_block", label: "", type: "hidden", defaultValue: picks.block ?? "" },
            { name: "surfaces", label: "", type: "hidden", defaultValue: picks.surfaces ?? "" },
            { name: "currency", label: "", type: "hidden", defaultValue: currency },
            { name: "source", label: "", type: "hidden", defaultValue: picks.source },
          ]}
        />
      </div>
    </div>
  );
}
