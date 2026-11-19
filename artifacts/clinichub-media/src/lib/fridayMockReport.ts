/**
 * PREVIEW-ONLY mock of Friday's brand-report.v1 (contract: /workspace/birch-friday-contract/brand-intake-v1.md).
 * Shape follows the contract; values come from Birch's shared modules so the preview is honest about its source.
 * Every object carries mock: true and the UI labels it. Never used on birchreserve.net.
 */
import type { FridayReport, ReportView } from "./fridayBrandIntake";
import type { IntakePayload } from "../../../api-server/src/lib/overhaul/brandIntake";
import { CHANNEL_TILES, PROPOSED_ANCHOR_HUBS, RATE_PLACEMENTS, hubFit, projectPublisher } from "../../../api-server/src/lib/overhaul/brandIntake";
import { KIT_CALC_CONFIG, kitCalc } from "../../../api-server/src/lib/kitCalc";
import { toBirchCategory } from "../../../api-server/src/lib/kitCalc/fridayV12";

const FK: Record<string, string> = { "scale-hubs": "hubs", "calm-joints": "calm_joints", "street-team": "street_team", "retail-network": "retail" };
const lh = (r: readonly [number, number]) => ({ low: r[0], high: r[1] });

export function mockReport(payload: IntakePayload, body: Record<string, unknown>, view: ReportView, version: number, updated: string, roles: string[], mirror?: "published" | "held"): FridayReport {
  const calc = body.calculator as { avg_cart_usd?: number; orders_per_month?: number; purchases_per_year?: number; margin_band?: string } | undefined;
  const k = payload.kit_calculator;
  const c = kitCalc({ aovUsd: k?.aov_usd ?? calc?.avg_cart_usd ?? 0, monthlyOrders: k?.monthly_orders ?? calc?.orders_per_month ?? 0, purchasesPerYear: k?.purchases_per_year_range ?? calc?.purchases_per_year ?? 1, marginBand: k?.margin_band ?? calc?.margin_band ?? "" });
  const missing = calc ? [] : ["avg_cart_usd", "orders_per_month", "purchases_per_year", "margin_band"];
  const cat = toBirchCategory(k?.category ?? "recovery");
  const fits = hubFit(cat);
  const report: FridayReport = {
    schema: "brand-report.v1",
    brand: { name: k?.brand_label ?? "Your brand" },
    version,
    updated,
    roles,
    view,
    status: { public_mirror: mirror ?? "published", kits_pending: 0 },
    ltv: {
      label: "Estimate",
      model: "ltv-v1",
      inputs: calc ?? {},
      lifetime_years: { low: KIT_CALC_CONFIG.ltvHorizonYears.lo, high: KIT_CALC_CONFIG.ltvHorizonYears.hi, placeholder: true },
      missing,
      needs_input: missing.length > 0,
      gp_per_order_usd: missing.length ? null : lh(c.gpPerOrderUsd),
      gp_ltv_usd: missing.length ? null : lh(c.ltvGpUsd),
      monthly_gp_usd: missing.length ? null : lh(c.current.monthlyGpUsd),
      formula: "avg cart × margin band × purchases/yr × lifetime years (lifetime is a placeholder)",
    },
    demand_fit: {
      label: "Estimate · subject to human confirmation",
      channels: CHANNEL_TILES.map((t, i) => ({ key: FK[t.key]!, name: t.name, fit: [80, 50, 50, 50][i]!, fit_label: i === 0 ? "Good fit (mock)" : "Possible fit (mock)", subject_to_human_confirmation: true })),
      anchor_hubs: PROPOSED_ANCHOR_HUBS.map((h) => {
        const f = fits.find((x) => x.key === h.key)!;
        return { key: h.key, name: h.name, status: h.live ? "Live" : "In queue", confirmed_anchor: false, fit: f.fit === "Likely fit" ? 80 : 40, fit_label: `${f.fit === "Likely fit" ? "Good fit" : "Possible fit"} (mock)`, reason: h.what, subject_to_human_confirmation: true };
      }),
    },
    channels: CHANNEL_TILES.map((t) => ({ key: FK[t.key]!, name: t.name, figures: t.key === "retail-network" ? ["120+ retail locations", "1MM+ recovery customers", "Canada + USA"] : t.stats.map((s) => `${s.v} ${s.l}`), figures_label: "network figures / targets", fit: 0, fit_label: "", line: t.line, image: "image" in t ? t.image : null })),
    placements: RATE_PLACEMENTS.map((r) => ({ key: r.key, label: r.label, fit: 0, fit_label: "", cpm_usd: lh(r.cpm), cpc_usd: lh(r.cpc), needs_rate: false })),
    // v1.2 §5 shape. Birch has no access to Friday's TAM, so the mock is always needs_input (honest, labelled mock).
    demand_opportunity: { label: "Estimate", model: "scale-tam-demand-v1", needs_input: true, missing: calc ? ["scale_demand_unavailable"] : ["avg_cart_usd", "scale_demand_unavailable"], category: null, scale_demand_orders_yr: null, capture_share: { min: 0.01, max: 0.25, placeholder: true }, annual_usd: null, monthly_usd: null, mock: true },
    mock: true,
  };
  if (view === "publisher" && payload.publisher) {
    const p = projectPublisher({ on: Object.fromEntries(payload.publisher.surfaces.map((s) => [s.key, s.on])), mode: payload.publisher.mode, sizeX: payload.publisher.size_x, conversionPct: payload.publisher.conversion_pct, valuePerConversionUsd: payload.publisher.value_per_conversion_usd });
    report.role_data = { publisher: { surfaces: p.rows.filter((r) => r.on).map((r) => ({ surface: r.key, payout_usd: lh(r.payoutUsd), needs_rate: !r.priced })), config: { base_share: 0.35, tiers: "placeholder" }, mock: true } };
  }
  if (view === "supplier" && payload.supplier) report.role_data = { supplier: { first_look: payload.supplier.categories.filter((c) => c.state !== "off").map((c) => ({ category: c.key, choice: c.state, status: "pending_review" })), status: "pending_review" } };
  if (view === "sponsor" && payload.sponsor) report.role_data = { sponsor: { skus: payload.sponsor.interest, status: "pending_review" } };
  return report;
}

/** Labelled SAMPLE for /intake: a fictional "Example brand" with example inputs. Not a real brand, never sent to Friday. */
export function sampleReport(): FridayReport {
  const payload = {
    kit_calculator: { brand_label: "Example brand", category: "recovery_devices" },
    publisher: { mode: "display", size_x: 1, conversion_pct: 1, value_per_conversion_usd: 0, surfaces: [{ key: "post_purchase", on: true }, { key: "home", on: true }, { key: "product", on: true }, { key: "newsletter", on: true }, { key: "social", on: true }] },
  } as unknown as IntakePayload;
  const body = { calculator: { avg_cart_usd: 80, orders_per_month: 500, purchases_per_year: 2.5, margin_band: "30_50" } };
  const r = mockReport(payload, body, "publisher", 1, "2026-11-18T12:00:00.000Z", ["advertiser", "publisher"]);
  r.brand = { name: "Example brand", domain: "example-brand.test" };
  return r;
}

/** Fast-mode defaults (labelled on screen). Not the brand's numbers; "Add detail" replaces them. */
export const QUICK_DEFAULTS = { aov_usd: 80, orders_per_month: 500, repeat_band: "2_3", repeat_label: "2–3 a year", purchases_per_year: 2, margin_band: "30_50", margin_label: "30–50%" } as const;
/**
 * Instant on-page "Quick estimate from your website + defaults": the shared calculator, channel tiles and anchor
 * set, computed in the browser from Friday's v1.3 site auto-fill (when present) and the defaults above. Birch never
 * fetches the brand's site itself. Never sent to Friday as data.
 */
export function quickReport(o: { roles: string[]; category: string; host: string; name?: string | null; aovUsd?: number | null }): FridayReport {
  const payload = {
    kit_calculator: { brand_label: o.host, category: o.category },
    publisher: { mode: "display", size_x: 1, conversion_pct: 1, value_per_conversion_usd: 0, surfaces: ["post_purchase", "home", "product", "member_dashboard", "newsletter"].map((key) => ({ key, on: true })) },
  } as unknown as IntakePayload;
  const body = { calculator: { avg_cart_usd: o.aovUsd ?? QUICK_DEFAULTS.aov_usd, orders_per_month: QUICK_DEFAULTS.orders_per_month, purchases_per_year: QUICK_DEFAULTS.purchases_per_year, margin_band: QUICK_DEFAULTS.margin_band } };
  const r = mockReport(payload, body, o.roles.includes("publisher") ? "publisher" : "brand", 1, new Date().toISOString(), o.roles);
  const unmock = (s: string) => s.replace(/\s*\(mock\)/g, "");
  r.brand = { name: o.name || o.host, domain: o.host };
  if (r.demand_fit) {
    r.demand_fit.channels = r.demand_fit.channels.map((c) => ({ ...c, fit_label: unmock(c.fit_label) }));
    r.demand_fit.anchor_hubs = r.demand_fit.anchor_hubs.map((h) => ({ ...h, fit_label: unmock(h.fit_label) }));
  }
  r.demand_opportunity = { label: "Estimate", needs_input: true, missing: ["scale_demand_unavailable"] };
  r.mock = false; // labelled as a quick estimate instead
  return r;
}
